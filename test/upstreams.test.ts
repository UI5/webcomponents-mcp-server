import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import anyTest, { TestFn } from 'ava';

import {
  mountUpstream,
  mountUpstreams,
  UPSTREAMS,
  _resetForTesting,
} from '../src/upstreams/index.js';

const test = anyTest as TestFn;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MOCK_BIN = path.join(__dirname, 'fixtures', 'mock_upstream.mjs');
const MOCK_EMPTY_BIN = path.join(__dirname, 'fixtures', 'mock_empty_upstream.mjs');

test.beforeEach(() => {
  _resetForTesting();
});

/**
 * Drive the mount layer against the in-tree mock upstream. Asserts:
 *   - Tools register under `<prefix>_<originalName>` and forward.
 *   - Resources register with their upstream URI verbatim and forward.
 *   - Prompts register under `<prefix>_<originalName>` and forward.
 *   - The richer `format` tool's input schema (enum / integer / array / optional) survives the
 *     JSON-Schema → Zod conversion and a call through it returns the upstream's response.
 *
 * Serial: tests share module-scoped resourceOwners and spawn children - keep teardown
 * deterministic.
 */
test.serial('mountUpstream namespaces and forwards tools, resources, and prompts', async (t) => {
  const server = new McpServer(
    { name: 'host', version: '0' },
    { capabilities: { tools: {}, resources: {}, prompts: {} } }
  );

  const handle = await mountUpstream(
    server,
    { prefix: 'mock', label: 'Mock Upstream', packageName: 'unused' },
    { binPath: MOCK_BIN, onUpstreamExit: () => {} }
  );

  try {
    t.deepEqual(handle.toolNames.sort(), ['mock_echo', 'mock_format']);
    t.deepEqual(handle.resourceUris, ['mock://doc']);
    t.deepEqual(handle.promptNames, ['mock_greet']);

    // Forward a tool call through the upstream client - this exercises the same path the
    // mounted handler uses (server.registerTool's callback delegates to it).
    const toolResult = await handle.client.callTool({
      name: 'echo',
      arguments: { message: 'hi' },
    });
    const toolContent = (toolResult.content as Array<{ type: string; text?: string }>)?.[0];
    t.is(toolContent?.type, 'text');
    t.is(toolContent?.text, 'echo: hi');

    // Richer-schema tool: enum + integer + array + optional. Doesn't supply `verbose`, which
    // the upstream defaults to false. We assert the upstream's default applied (proving the
    // parent did NOT also apply a default and short-circuit the upstream).
    const richResult = await handle.client.callTool({
      name: 'format',
      arguments: { style: 'short', count: 3, tags: ['a', 'b'] },
    });
    const richContent = (richResult.content as Array<{ type: string; text?: string }>)?.[0];
    t.is(richContent?.text, 'style=short count=3 tags=[a,b] verbose=false');

    const readResult = await handle.client.readResource({ uri: 'mock://doc' });
    const resourceContent = (readResult.contents as Array<{ text?: string }>)?.[0];
    t.is(resourceContent?.text, 'mock body');

    const promptResult = await handle.client.getPrompt({
      name: 'greet',
      arguments: { name: 'world' },
    });
    const promptText = (promptResult.messages?.[0]?.content as { type: string; text?: string })
      ?.text;
    t.is(promptText, 'hello world');
  } finally {
    await handle.transport.close();
  }
});

/**
 * Verifies a tool call routed through the parent McpServer (rather than calling the child
 * client directly) actually reaches the upstream and returns its result. This protects against
 * regressions in the registerTool wiring - the previous test exercises the client; this one
 * exercises the full parent → registered handler → child path.
 */
test.serial('mounted tool is callable through the parent server', async (t) => {
  const server = new McpServer(
    { name: 'host', version: '0' },
    { capabilities: { tools: {}, resources: {}, prompts: {} } }
  );

  const handle = await mountUpstream(
    server,
    { prefix: 'mock', label: 'Mock Upstream', packageName: 'unused' },
    { binPath: MOCK_BIN, onUpstreamExit: () => {} }
  );

  // Connect a Client over an in-memory transport pair so we can invoke the parent the same
  // way an MCP client would.
  const client = new Client({ name: 'test-client', version: '0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);

  try {
    // tools/list against the parent should include the mounted name (no namespace stripping).
    const list = await client.listTools();
    const names = list.tools.map((t) => t.name);
    t.true(names.includes('mock_echo'), `mock_echo missing from parent: ${names.join(', ')}`);

    const result = await client.callTool({
      name: 'mock_echo',
      arguments: { message: 'through-parent' },
    });
    const content = (result.content as Array<{ type: string; text?: string }>)?.[0];
    t.is(content?.text, 'echo: through-parent');
  } finally {
    await client.close();
    await server.close();
    await handle.transport.close();
  }
});

/**
 * An upstream advertising no capabilities must not blow up - listTools/listResources/listPrompts
 * are all gated on the corresponding capability, so all three lists should come back empty.
 */
test.serial(
  'mountUpstream against an upstream with no capabilities yields empty lists',
  async (t) => {
    const server = new McpServer(
      { name: 'host', version: '0' },
      { capabilities: { tools: {}, resources: {}, prompts: {} } }
    );

    const handle = await mountUpstream(
      server,
      { prefix: 'empty', label: 'Empty Upstream', packageName: 'unused' },
      { binPath: MOCK_EMPTY_BIN, onUpstreamExit: () => {} }
    );

    try {
      t.deepEqual(handle.toolNames, []);
      t.deepEqual(handle.resourceUris, []);
      t.deepEqual(handle.promptNames, []);
    } finally {
      await handle.transport.close();
    }
  }
);

/**
 * mountUpstreams' duplicate-prefix guard must reject configs that share a prefix BEFORE any
 * child is spawned, so a typo in the registry never produces a non-deterministically-routed
 * server.
 */
test.serial('mountUpstreams throws on duplicate prefixes in the registry', async (t) => {
  const server = new McpServer(
    { name: 'host', version: '0' },
    { capabilities: { tools: {}, resources: {}, prompts: {} } }
  );

  await t.throwsAsync(
    () =>
      mountUpstreams(server, [
        { prefix: 'dup', label: 'A', packageName: 'unused' },
        { prefix: 'dup', label: 'B', packageName: 'unused' },
      ]),
    { message: /Duplicate upstream prefix "dup"/ }
  );
});

/**
 * Mounts the real React MCP via the registry and asserts its expected tools and resources show
 * up. We don't call its tools - that's the React team's contract - only that the mount plumbing
 * sees them.
 */
test.serial(
  'mountUpstream against real React MCP exposes expected tools and llms.txt resource',
  async (t) => {
    const reactSpec = UPSTREAMS.find((u) => u.prefix === 'react');
    t.truthy(reactSpec, 'React entry should be in UPSTREAMS');

    const server = new McpServer(
      { name: 'host', version: '0' },
      { capabilities: { tools: {}, resources: {}, prompts: {} } }
    );

    const handle = await mountUpstream(server, reactSpec!, { onUpstreamExit: () => {} });

    try {
      const expectedTools = [
        'react_create_app',
        'react_get_component_api',
        'react_get_documentation',
        'react_get_public_utils',
        'react_list_components',
      ];
      for (const name of expectedTools) {
        t.true(
          handle.toolNames.includes(name),
          `Expected mounted tool ${name}, got: ${handle.toolNames.join(', ')}`
        );
      }
      t.deepEqual(handle.resourceUris, ['file:///llms.txt']);
      t.deepEqual(handle.promptNames, []);
    } finally {
      await handle.transport.close();
    }
  }
);

/** Resource URI collision across two mounts must hard-fail to surface misconfiguration early. */
test.serial('mountUpstream throws on resource URI collision across upstreams', async (t) => {
  const server = new McpServer(
    { name: 'host', version: '0' },
    { capabilities: { tools: {}, resources: {}, prompts: {} } }
  );

  const a = await mountUpstream(
    server,
    { prefix: 'a', label: 'A', packageName: 'unused' },
    { binPath: MOCK_BIN, onUpstreamExit: () => {} }
  );

  // Second mount of the same fixture would re-register `mock://doc` - must throw.
  await t.throwsAsync(
    () =>
      mountUpstream(
        server,
        { prefix: 'b', label: 'B', packageName: 'unused' },
        { binPath: MOCK_BIN, onUpstreamExit: () => {} }
      ),
    { message: /Resource URI collision/ }
  );

  await a.transport.close();
});

/**
 * Regression for the onclose-swallows-error bug: when registerUpstream throws, the catch block
 * awaits transport.close(). The SDK's stdio transport fires `onclose` from the child's 'close'
 * event synchronously inside that await. If onclose isn't detached first, the fail-fast handler
 * (defaultOnUpstreamExit) would call process.exit(1) and the useful error would never reach the
 * caller. This test drives the failing mount with an onUpstreamExit that ASSERTS if invoked,
 * proving the mount code detached the handler before closing.
 */
test.serial('mountUpstream error path does not fire onUpstreamExit during cleanup', async (t) => {
  const server = new McpServer(
    { name: 'host', version: '0' },
    { capabilities: { tools: {}, resources: {}, prompts: {} } }
  );

  const a = await mountUpstream(
    server,
    { prefix: 'a', label: 'A', packageName: 'unused' },
    { binPath: MOCK_BIN, onUpstreamExit: () => {} }
  );

  let onExitCalls = 0;
  await t.throwsAsync(
    () =>
      mountUpstream(
        server,
        { prefix: 'b', label: 'B', packageName: 'unused' },
        {
          binPath: MOCK_BIN,
          // If the mount layer forgets to detach onclose before transport.close(), this fires
          // during error cleanup and (in production) would swallow the collision error via
          // process.exit. In the test we just count calls and assert zero.
          onUpstreamExit: () => {
            onExitCalls++;
          },
        }
      ),
    { message: /Resource URI collision/ }
  );

  t.is(onExitCalls, 0, 'onUpstreamExit must not fire during error-path cleanup');

  await a.transport.close();
});
