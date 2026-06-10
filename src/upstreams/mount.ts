import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createRequire } from 'node:module';
import path from 'node:path';
import { z, ZodTypeAny } from 'zod';

import { logger } from '../logger.js';
import { UPSTREAMS, UpstreamSpec } from './registry.js';

/**
 * One mounted upstream — the live Client/Transport pair plus what we registered from it.
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

/** Called from the entrypoint's shutdown handler before closing transports. */
export function markShutdown(): void {
    shuttingDown = true;
}

/** Test-only: reset module state so successive `mountUpstream` calls in tests are independent. */
export function _resetForTesting(): void {
    resourceOwners.clear();
    shuttingDown = false;
}

/**
 * Spawn each registered upstream MCP server, list its tools/resources/prompts, and re-publish
 * them on `server` under namespaced names (resources keep their original URI; collisions throw).
 *
 * Throws on any failure — the caller is expected to log and exit non-zero.
 */
export async function mountUpstreams(server: McpServer): Promise<UpstreamHandle[]> {
    const handles: UpstreamHandle[] = [];
    for (const spec of UPSTREAMS) {
        handles.push(await mountUpstream(server, spec));
    }
    return handles;
}

/** Options accepted by mountUpstream — used by tests to override defaults. */
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
        { name: 'ui5-webcomponents-mcp-server', version: '0.0.0' },
        { capabilities: {} }
    );

    try {
        await client.connect(transport);
    } catch (error) {
        throw new Error(`[${spec.label}] failed to connect: ${stringifyError(error)}`);
    }

    // Pipe child stderr through the debug logger so it's visible when DEBUG=1 but quiet otherwise.
    if (transport.stderr) {
        transport.stderr.on('data', chunk => {
            const text = String(chunk).replace(/\n+$/, '');
            for (const line of text.split('\n')) {
                logger.debug(`[${spec.label}] ${line}`);
            }
        });
    }

    // Runtime fail-fast hook — overridable for tests.
    transport.onclose = () => onExit(spec, 'close');
    transport.onerror = err => onExit(spec, err);

    try {
        return await registerUpstream(server, spec, client, transport);
    } catch (error) {
        // Anything failing past connect (URI collision, listTools error, registration error)
        // leaves the child process running. Tear it down before propagating so the caller's
        // process doesn't leak children.
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
    // We only call list* for capabilities the upstream advertises — calling tools/list against
    // a server without `tools` capability would return -32601 Method not found.
    const upstreamCaps = client.getServerCapabilities() ?? {};

    const toolNames: string[] = [];
    const resourceUris: string[] = [];
    const promptNames: string[] = [];

    if (upstreamCaps.tools) {
        const { tools } = await client.listTools();
        for (const tool of tools) {
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
            // Handler signature differs based on whether inputSchema is set; cast through `unknown`
            // since the upstream server is the actual validator.
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
        const { resources } = await client.listResources();
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
                async uri => {
                    const result = await client.readResource({ uri: uri.toString() });
                    return result;
                }
            );
            resourceUris.push(resource.uri);
        }
    }

    if (upstreamCaps.prompts) {
        const { prompts } = await client.listPrompts();
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
 * `bin` field. Supports both string and `{ name: path }` forms; if multiple bins exist, picks the
 * first (upstream MCP packages have just one in practice).
 */
function resolveUpstreamBin(spec: UpstreamSpec): string {
    const require = createRequire(import.meta.url);
    let pkgJsonPath: string;
    try {
        pkgJsonPath = require.resolve(`${spec.packageName}/package.json`);
    } catch (error) {
        throw new Error(
            `[${spec.label}] cannot resolve package "${spec.packageName}" — is it installed? (${stringifyError(error)})`
        );
    }

    const pkg = require(pkgJsonPath) as { bin?: string | Record<string, string> };
    const binField = pkg.bin;
    let binRel: string | undefined;
    if (typeof binField === 'string') {
        binRel = binField;
    } else if (binField && typeof binField === 'object') {
        binRel = Object.values(binField)[0];
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
 * (Record<string, ZodTypeAny>) that `McpServer.registerTool` expects. Returns undefined if the
 * schema has no properties — `registerTool` is fine omitting `inputSchema` in that case.
 *
 * This is intentionally limited to the JSON Schema constructs MCP tool inputs actually use in
 * practice: primitive types (string/number/integer/boolean), enum, default, description, and
 * required. Nested objects and combinators (oneOf/anyOf/allOf) fall back to z.any() — the
 * upstream still validates the call, so this is safe.
 */
function jsonObjectSchemaToZodShape(
    schema: unknown
): Record<string, ZodTypeAny> | undefined {
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
        default?: unknown;
        items?: unknown;
    };

    let zodSchema: ZodTypeAny;

    if (Array.isArray(s.enum) && s.enum.length > 0) {
        // Zod's z.enum requires string literals; values may be numbers etc., so use z.union of
        // literals when there are 2+, or the single literal directly. Cast through unknown so
        // TS accepts the dynamically-built tuple at z.union's required-2-tuple signature.
        const literals = s.enum.map(v => z.literal(v as string | number | boolean));
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
                // Object subschemas, oneOf/anyOf, etc. — pass through; upstream re-validates.
                zodSchema = z.any();
        }
    }

    if (s.description) zodSchema = zodSchema.describe(s.description);
    if (s.default !== undefined) zodSchema = zodSchema.default(s.default as never);
    return zodSchema;
}

/**
 * Convert MCP prompt arguments (a flat array of `{ name, description?, required? }`) to the
 * raw-shape form expected by `registerPrompt`. Each argument is a string; required arguments
 * are required, others are optional.
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
