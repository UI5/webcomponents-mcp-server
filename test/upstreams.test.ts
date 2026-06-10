import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import anyTest, { TestFn } from 'ava';

import { mountUpstream, UPSTREAMS } from '../src/upstreams/index.js';
import { _resetForTesting } from '../src/upstreams/mount.js';

const test = anyTest as TestFn;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MOCK_BIN = path.join(__dirname, 'fixtures', 'mock_upstream.mjs');

test.beforeEach(() => {
  _resetForTesting();
});

/**
 * Drive the mount layer against the in-tree mock upstream. Asserts:
 *   - Tools register under `<prefix>_<originalName>` and forward.
 *   - Resources register with their upstream URI verbatim and forward.
 *   - Prompts register under `<prefix>_<originalName>` and forward.
 *
 * Serial: tests share module-scoped resourceOwners and spawn children — keep teardown
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
    t.deepEqual(handle.toolNames, ['mock_echo']);
    t.deepEqual(handle.resourceUris, ['mock://doc']);
    t.deepEqual(handle.promptNames, ['mock_greet']);

    // Forward a tool call through the upstream client — this exercises the same path the
    // mounted handler uses (server.registerTool's callback delegates to it).
    const toolResult = await handle.client.callTool({
      name: 'echo',
      arguments: { message: 'hi' },
    });
    const toolContent = (toolResult.content as Array<{ type: string; text?: string }>)?.[0];
    t.is(toolContent?.type, 'text');
    t.is(toolContent?.text, 'echo: hi');

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
 * Mounts the real React MCP via the registry and asserts its expected tools and resources show
 * up. We don't call its tools — that's the React team's contract — only that the mount plumbing
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

  // Second mount of the same fixture would re-register `mock://doc` — must throw.
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
