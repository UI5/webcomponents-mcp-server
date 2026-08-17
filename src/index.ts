#!/usr/bin/env node

import { createRequire } from 'node:module';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import * as tools from './tools/index.js';
import { markShutdown, mountUpstreams, UpstreamHandle } from './upstreams/index.js';

// Read this package's version at startup so the identity advertised to MCP clients tracks
// package.json instead of drifting (see upstreams/mount.ts for the same pattern applied to the
// upstream-client identity). Safe '0.0.0' fallback if the lookup fails for any reason.
const OWN_VERSION = (() => {
  try {
    const require = createRequire(import.meta.url);
    // Compiled artifact lives at build/index.js, so package.json is one level up.
    const pkg = require('../package.json') as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
})();

const server = new McpServer(
  {
    name: 'ui5-webcomponents',
    version: OWN_VERSION,
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

// Populated incrementally by mountUpstreams' onHandle callback (below) so signal handlers can
// see every child that made it past connect, even mid-startup. Never reassigned.
const handles: UpstreamHandle[] = [];

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
// the next write - that is sufficient cleanup. SIGINT/SIGTERM cover ctrl-C and supervised
// teardown explicitly.

async function main(): Promise<void> {
  // Spawn and mount upstream framework MCPs (React today; Angular/Vue future). Any failure here
  // is fatal - better the user sees a clear error than a half-mounted server.
  //
  // The onHandle callback pushes each handle to the module-level `handles` array as soon as
  // its child is connected. This exposes every spawned child to the signal handlers even
  // during the mount window - without it, a SIGINT arriving before mountUpstreams resolves
  // would find `handles === []` and orphan the in-flight child. We don't reassign `handles`
  // after mountUpstreams resolves: the callback is the single source of truth for what's live.
  await mountUpstreams(server, undefined, (h) => handles.push(h));

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('UI5 Web Components MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
