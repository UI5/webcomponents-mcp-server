#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import * as tools from './tools/index.js';
import { markShutdown, mountUpstreams, UpstreamHandle } from './upstreams/index.js';

const server = new McpServer(
  {
    name: 'ui5-webcomponents',
    version: '0.0.1',
  },
  {
    // Declared unconditionally: any combination of native + mounted upstream items can fill
    // these. An empty list/read response is fine when nothing is registered for a slot.
    capabilities: { tools: {}, resources: {}, prompts: {} },
  }
);

// Register native tools (Zod-shape inputs).
Object.values(tools).forEach((tool) => {
  server.tool(tool.name, tool.description, tool.inputSchema, tool.handler);
});

let handles: UpstreamHandle[] = [];

function shutdown(): void {
  // Order matters: mark shutdown BEFORE closing transports. transport.close() can fire onclose
  // synchronously in the same tick, which would otherwise trip the upstream's fail-fast handler
  // and call process.exit(1) on a planned exit. Don't reorder.
  markShutdown();
  for (const h of handles) {
    try {
      h.transport.close();
    } catch {
      /* best-effort during shutdown */
    }
  }
}

process.on('SIGINT', () => {
  shutdown();
  process.exit(0);
});
process.on('SIGTERM', () => {
  shutdown();
  process.exit(0);
});
// We deliberately do NOT register a 'exit' handler: 'exit' runs synchronously and ignores
// returned promises, so transport.close() couldn't reliably finish IPC teardown there. For
// stdio child processes the parent's exit closes their stdin and they receive SIGPIPE on
// the next write — that is sufficient cleanup. SIGINT/SIGTERM cover ctrl-C and supervised
// teardown explicitly.

async function main(): Promise<void> {
  // Spawn and mount upstream framework MCPs (React today; Angular/Vue future). Any failure here
  // is fatal — better the user sees a clear error than a half-mounted server.
  handles = await mountUpstreams(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('UI5 Web Components MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
