import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createRequire } from 'node:module';
import path from 'node:path';
import { z, ZodTypeAny } from 'zod';

import { logger } from '../logger.js';
import { UPSTREAMS, UpstreamSpec } from './registry.js';

/**
 * One mounted upstream - the live Client/Transport pair plus what we registered from it.
 * Returned to the entrypoint so it can close transports on shutdown.
 */
export interface UpstreamHandle {
  spec: UpstreamSpec;
  client: Client;
  transport: StdioClientTransport;
  toolNames: string[];
  resourceUris: string[];
  promptNames: string[];
}

/** Module-scoped state used by the mount layer. */
const resourceOwners = new Map<string, UpstreamSpec>();
let shuttingDown = false;

/**
 * Own version, read once from this package's package.json. Forwarded to upstream MCP servers as
 * the connecting client's version so their logs are useful when debugging which parent
 * connected. Falls back to '0.0.0' if the lookup fails for any reason - non-fatal.
 */
const OWN_VERSION = readOwnVersion();
function readOwnVersion(): string {
  try {
    const require = createRequire(import.meta.url);
    // The compiled artifact lives at build/upstreams/mount.js, so the package.json is two levels up.
    const pkg = require('../../package.json') as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/** Called from the entrypoint's shutdown handler before closing transports. */
export function markShutdown(): void {
  shuttingDown = true;
}

/**
 * Test-only: reset module state so successive `mountUpstream` calls in tests are independent.
 *
 * Callers must also construct a fresh `McpServer` for each mount - this only resets the
 * module-scoped registry/flags, not anything already registered on a server instance.
 */
export function _resetForTesting(): void {
  resourceOwners.clear();
  shuttingDown = false;
}

/**
 * Spawn each registered upstream MCP server, list its tools/resources/prompts, and re-publish
 * them on `server` under namespaced names (resources keep their original URI; collisions throw).
 *
 * Throws on any failure - the caller is expected to log and exit non-zero. On partial failure
 * (some upstreams already mounted, later one throws) every already-mounted transport is closed
 * before the error propagates, so no child process is leaked.
 *
 * `onHandle` is called synchronously as each mount completes, before the next one starts. The
 * entrypoint uses this to expose each handle to its signal handlers immediately, so a SIGINT
 * arriving mid-`mountUpstreams` can still close every child that made it past connect. Without
 * this callback, the caller only sees handles after the whole array resolves.
 *
 * The optional `upstreams` parameter exists for tests; production callers pass nothing and the
 * module-level `UPSTREAMS` list is used.
 */
export async function mountUpstreams(
  server: McpServer,
  upstreams: ReadonlyArray<UpstreamSpec> = UPSTREAMS,
  onHandle?: (handle: UpstreamHandle) => void
): Promise<UpstreamHandle[]> {
  // Cheap insurance against typos in the registry: two upstreams sharing a prefix would silently
  // collide on every same-named tool/prompt and behave non-deterministically. Detect at startup
  // so the failure mode is "server fails to boot with a clear error", not "calls misroute".
  const seenPrefixes = new Set<string>();
  for (const spec of upstreams) {
    if (seenPrefixes.has(spec.prefix)) {
      throw new Error(
        `Duplicate upstream prefix "${spec.prefix}" in registry - prefixes must be unique.`
      );
    }
    seenPrefixes.add(spec.prefix);
  }

  const handles: UpstreamHandle[] = [];
  try {
    for (const spec of upstreams) {
      const handle = await mountUpstream(server, spec);
      handles.push(handle);
      onHandle?.(handle);
    }
  } catch (error) {
    // A later mount threw. Every handle collected so far owns a live child - tear them down
    // before propagating so we don't leak orphans. Detach onclose/onerror first: close() awaits
    // the child's 'close' event which fires this transport's onclose synchronously (SDK
    // stdio.js), and defaultOnUpstreamExit would call process.exit(1) inside the await,
    // swallowing the original error before it reaches the caller.
    for (const h of handles) {
      h.transport.onclose = undefined;
      h.transport.onerror = undefined;
      try {
        await h.transport.close();
      } catch {
        /* best-effort */
      }
    }
    throw error;
  }
  return handles;
}

/** Options accepted by mountUpstream - used by tests to override defaults. */
export interface MountOptions {
  /** Override bin resolution. Used by tests pointing at a fixture script. */
  binPath?: string;
  /**
   * Called when the upstream's transport closes or errors after mount. Defaults to a fail-fast
   * handler that calls `process.exit(1)`. Tests pass a no-op so the test process survives.
   */
  onUpstreamExit?: (spec: UpstreamSpec, reason: 'close' | Error) => void;
}

const defaultOnUpstreamExit = (spec: UpstreamSpec, reason: 'close' | Error): void => {
  if (shuttingDown) return;
  if (reason === 'close') {
    console.error(`[${spec.label}] upstream exited unexpectedly`);
  } else {
    console.error(`[${spec.label}] upstream error: ${stringifyError(reason)}`);
  }
  process.exit(1);
};

export async function mountUpstream(
  server: McpServer,
  spec: UpstreamSpec,
  options: MountOptions = {}
): Promise<UpstreamHandle> {
  const binPath = options.binPath ?? resolveUpstreamBin(spec);
  const onExit = options.onUpstreamExit ?? defaultOnUpstreamExit;
  logger.debug(`[${spec.label}] spawning ${binPath}`);

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [binPath],
    stderr: 'pipe',
  });

  const client = new Client(
    { name: 'ui5-webcomponents-mcp-server', version: OWN_VERSION },
    { capabilities: {} }
  );

  try {
    await client.connect(transport);
  } catch (error) {
    // Symmetric with the post-connect failure path: the spawned child must not leak even when
    // the very first handshake fails. Detach onclose/onerror before closing so the fail-fast
    // handler doesn't fire during the awaited close and swallow this error via process.exit.
    transport.onclose = undefined;
    transport.onerror = undefined;
    try {
      await transport.close();
    } catch {
      /* best-effort */
    }
    throw new Error(`[${spec.label}] failed to connect: ${stringifyError(error)}`);
  }

  // Pipe child stderr through the debug logger so it's visible when DEBUG=1 but quiet otherwise.
  if (transport.stderr) {
    transport.stderr.on('data', (chunk) => {
      const text = String(chunk).replace(/\n+$/, '');
      for (const line of text.split('\n')) {
        logger.debug(`[${spec.label}] ${line}`);
      }
    });
  }

  // Runtime fail-fast hook - overridable for tests.
  transport.onclose = () => onExit(spec, 'close');
  transport.onerror = (err) => onExit(spec, err);

  try {
    return await registerUpstream(server, spec, client, transport);
  } catch (error) {
    // Anything failing past connect (URI collision, listTools error, registration error) leaves
    // the child process running. Tear it down before propagating so the caller's process doesn't
    // leak children. Detach onclose/onerror first: `close()` awaits the child's 'close' event,
    // which fires this transport's onclose synchronously (SDK stdio.js) - without detachment the
    // fail-fast handler would call process.exit(1) inside the await and this throw would never
    // reach the caller.
    transport.onclose = undefined;
    transport.onerror = undefined;
    try {
      await transport.close();
    } catch {
      /* best-effort */
    }
    throw error;
  }
}

async function registerUpstream(
  server: McpServer,
  spec: UpstreamSpec,
  client: Client,
  transport: StdioClientTransport
): Promise<UpstreamHandle> {
  // We only call list* for capabilities the upstream advertises - calling tools/list against
  // a server without `tools` capability would return -32601 Method not found.
  const upstreamCaps = client.getServerCapabilities() ?? {};

  const toolNames: string[] = [];
  const resourceUris: string[] = [];
  const promptNames: string[] = [];

  if (upstreamCaps.tools) {
    const tools = await listAllPages((cursor) => client.listTools({ cursor }), 'tools');
    for (const tool of tools) {
      // Naming: `<spec.prefix>_<tool.name>`. Upstream tools are expected to be unprefixed
      // (e.g. the React MCP exports `get_component_api`, `create_app`, etc.), which after
      // prefixing yields `react_get_component_api`. If a future upstream ALREADY namespaces
      // its own tools we'd see double-prefixed names like `react_react_<name>`; we
      // deliberately don't strip a leading `<prefix>_` because doing so risks collision when
      // a different upstream genuinely exports an unprefixed tool with the same basename.
      // A follow-up may revisit this with registry-level guidance.
      const mountedName = `${spec.prefix}_${tool.name}`;
      const inputShape = jsonObjectSchemaToZodShape(tool.inputSchema);
      const config: {
        description?: string;
        annotations?: typeof tool.annotations;
        inputSchema?: Record<string, ZodTypeAny>;
      } = {
        description: tool.description,
        annotations: tool.annotations,
      };
      if (inputShape) config.inputSchema = inputShape;
      // The SDK overloads `registerTool` so its handler-arg type depends on whether inputSchema
      // is supplied. We're populating that field dynamically based on what the upstream returns,
      // so TS can't pick the right overload at compile time. Casting through `unknown` is the
      // narrowest workaround until the SDK exposes a less-overloaded variant; the upstream is
      // the actual validator regardless.
      server.registerTool(
        mountedName,
        config as Parameters<McpServer['registerTool']>[1],
        (async (args: Record<string, unknown>) => {
          return await client.callTool({
            name: tool.name,
            arguments: args ?? {},
          });
        }) as unknown as Parameters<McpServer['registerTool']>[2]
      );
      toolNames.push(mountedName);
    }
  }

  if (upstreamCaps.resources) {
    const resources = await listAllPages((cursor) => client.listResources({ cursor }), 'resources');
    for (const resource of resources) {
      const owner = resourceOwners.get(resource.uri);
      if (owner) {
        throw new Error(
          `Resource URI collision: "${resource.uri}" is provided by both "${owner.prefix}" and "${spec.prefix}". Resource URIs must be unique across all mounted upstreams.`
        );
      }
      resourceOwners.set(resource.uri, spec);
      server.registerResource(
        resource.name,
        resource.uri,
        {
          description: resource.description,
          mimeType: resource.mimeType,
          title: resource.title,
        },
        async (uri) => {
          // Forward verbatim - the upstream is the source of truth for the
          // ReadResourceResult shape (`{ contents: [...] }`); if it's
          // schema-violating the parent's framework will throw at response time,
          // matching the same trust model as tool/prompt forwarding.
          const result = await client.readResource({ uri: uri.toString() });
          return result;
        }
      );
      resourceUris.push(resource.uri);
    }
  }

  if (upstreamCaps.prompts) {
    const prompts = await listAllPages((cursor) => client.listPrompts({ cursor }), 'prompts');
    for (const prompt of prompts) {
      const mountedName = `${spec.prefix}_${prompt.name}`;
      const argsShape = promptArgsToZodShape(prompt.arguments);
      const config: { description?: string; argsSchema?: Record<string, ZodTypeAny> } = {
        description: prompt.description,
      };
      if (argsShape) config.argsSchema = argsShape;
      server.registerPrompt(
        mountedName,
        config as Parameters<McpServer['registerPrompt']>[1],
        (async (args: Record<string, unknown>) => {
          return await client.getPrompt({
            name: prompt.name,
            arguments: args as Record<string, string> | undefined,
          });
        }) as unknown as Parameters<McpServer['registerPrompt']>[2]
      );
      promptNames.push(mountedName);
    }
  }

  logger.debug(
    `[${spec.label}] mounted ${toolNames.length} tools, ${resourceUris.length} resources, ${promptNames.length} prompts`
  );

  return { spec, client, transport, toolNames, resourceUris, promptNames };
}

/**
 * Resolve the absolute path to an upstream package's MCP-server bin, by reading its package.json
 * `bin` field. Supports both string and `{ name: path }` forms. When `bin` is an object with
 * multiple entries, prefers the one whose key matches the package's basename (e.g. `react-mcp`
 * for `@ui5/webcomponents-react-mcp`); otherwise picks the first entry deterministically by
 * iteration order. Throws if no bin can be resolved.
 */
function resolveUpstreamBin(spec: UpstreamSpec): string {
  const require = createRequire(import.meta.url);
  let pkgJsonPath: string;
  try {
    pkgJsonPath = require.resolve(`${spec.packageName}/package.json`);
  } catch (error) {
    throw new Error(
      `[${spec.label}] cannot resolve package "${spec.packageName}" - is it installed? (${stringifyError(error)})`
    );
  }

  const pkg = require(pkgJsonPath) as { bin?: string | Record<string, string> };
  const binField = pkg.bin;
  let binRel: string | undefined;
  if (typeof binField === 'string') {
    binRel = binField;
  } else if (binField && typeof binField === 'object') {
    // Prefer the bin entry whose name matches the package basename - that's the convention
    // for npm packages that ship multiple binaries (one of which is the "main" tool).
    const basename = spec.packageName.split('/').pop() ?? spec.packageName;
    binRel = binField[basename] ?? Object.values(binField)[0];
  }
  if (!binRel) {
    throw new Error(
      `[${spec.label}] package "${spec.packageName}" has no "bin" field in package.json`
    );
  }
  return path.resolve(path.dirname(pkgJsonPath), binRel);
}

/**
 * Convert an MCP tool's JSON Schema (always `type: object` per spec) into the raw-shape form
 * (Record<string, ZodTypeAny>) that `McpServer.registerTool` expects.
 *
 * Returns undefined when there's no useful per-property shape to register: either the schema is
 * not an object schema, or its properties are empty/absent. In that case the caller omits
 * `inputSchema` and the SDK skips parent-side validation entirely - args are forwarded as-is to
 * the upstream, which is the source of truth. This handles `type: object` schemas with no
 * declared properties (e.g. tools that accept free-form keys) without rejecting calls.
 *
 * This is intentionally limited to the JSON Schema constructs MCP tool inputs actually use in
 * practice: primitive types (string/number/integer/boolean), enum, description, required, and
 * arrays. Nested objects and combinators (oneOf/anyOf/allOf) fall back to z.any() - the
 * upstream still validates the call, so this is safe.
 *
 * Defaults (`default:`) are intentionally NOT carried into the parent's Zod shape. The upstream
 * is the single source of truth for validation and default-application; applying defaults twice
 * could mask cases where `undefined` is meaningful to the upstream tool.
 */
function jsonObjectSchemaToZodShape(schema: unknown): Record<string, ZodTypeAny> | undefined {
  if (!schema || typeof schema !== 'object') return undefined;
  const s = schema as {
    type?: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
  if (s.type !== 'object' || !s.properties) return undefined;

  const required = new Set(s.required ?? []);
  const shape: Record<string, ZodTypeAny> = {};
  for (const [key, propSchema] of Object.entries(s.properties)) {
    let z3 = jsonValueSchemaToZod(propSchema);
    if (!required.has(key)) z3 = z3.optional();
    shape[key] = z3;
  }
  return Object.keys(shape).length > 0 ? shape : undefined;
}

function jsonValueSchemaToZod(schema: unknown): ZodTypeAny {
  if (!schema || typeof schema !== 'object') return z.any();
  const s = schema as {
    type?: string;
    enum?: unknown[];
    description?: string;
    items?: unknown;
  };

  let zodSchema: ZodTypeAny;

  if (Array.isArray(s.enum) && s.enum.length > 0) {
    // Zod's z.enum requires string literals; enum values may be numbers/booleans, so we
    // build z.literal()s and union them. z.union requires at least 2 members - for a
    // single-value enum, return the literal directly. The double cast is needed because
    // TS can't statically prove `literals` has 2+ elements at this point.
    const literals = s.enum.map((v) => z.literal(v as string | number | boolean));
    zodSchema =
      literals.length === 1
        ? literals[0]
        : z.union(literals as unknown as [ZodTypeAny, ZodTypeAny, ...ZodTypeAny[]]);
  } else {
    switch (s.type) {
      case 'string':
        zodSchema = z.string();
        break;
      case 'number':
      case 'integer':
        zodSchema = z.number();
        break;
      case 'boolean':
        zodSchema = z.boolean();
        break;
      case 'array':
        zodSchema = z.array(s.items ? jsonValueSchemaToZod(s.items) : z.any());
        break;
      default:
        // Object subschemas, oneOf/anyOf, etc. - pass through; upstream re-validates.
        zodSchema = z.any();
    }
  }

  if (s.description) zodSchema = zodSchema.describe(s.description);
  // Defaults are intentionally not applied here - the upstream is the source of truth and
  // applies them itself. Carrying them through would apply defaults twice and could mask
  // cases where `undefined` is meaningful to the upstream tool.
  return zodSchema;
}

/**
 * Convert MCP prompt arguments (a flat array of `{ name, description?, required? }`) to the
 * raw-shape form expected by `registerPrompt`. Each argument is a string; required arguments
 * are required, others are optional.
 *
 * Note: per the MCP spec (https://spec.modelcontextprotocol.io), prompt arguments are always
 * strings - there is no typed-prompt-arg construct. Don't extend this to other Zod types.
 */
function promptArgsToZodShape(
  args: Array<{ name: string; description?: string; required?: boolean }> | undefined
): Record<string, ZodTypeAny> | undefined {
  if (!args || args.length === 0) return undefined;
  const shape: Record<string, ZodTypeAny> = {};
  for (const arg of args) {
    let z3: ZodTypeAny = z.string();
    if (arg.description) z3 = z3.describe(arg.description);
    if (!arg.required) z3 = z3.optional();
    shape[arg.name] = z3;
  }
  return shape;
}

function stringifyError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * Drive a paginated `list*` MCP call to completion. All three list result types
 * (tools/resources/prompts) extend `PaginatedResult` and carry an optional `nextCursor` when the
 * server has more items than fit in one page. Callers passed a single call before this helper
 * existed and would silently drop everything past the first page.
 *
 * The `key` picks the array field on each page (`tools` | `resources` | `prompts`). A bounded
 * iteration count acts as a runaway-loop guard against a misbehaving upstream that returns the
 * same cursor forever.
 */
async function listAllPages<
  K extends string,
  P extends { nextCursor?: string } & { [Q in K]: readonly unknown[] },
>(fetchPage: (cursor: string | undefined) => Promise<P>, key: K): Promise<P[K]> {
  const out: unknown[] = [];
  let cursor: string | undefined = undefined;
  // Cap iterations so a broken upstream can't spin forever. 1000 pages at the SDK's default
  // page sizes covers any realistic upstream by orders of magnitude.
  for (let i = 0; i < 1000; i++) {
    const page = await fetchPage(cursor);
    out.push(...page[key]);
    if (!page.nextCursor) return out as unknown as P[K];
    cursor = page.nextCursor;
  }
  throw new Error(`listAllPages(${key}): exceeded 1000 pages - upstream likely misbehaving`);
}
