/**
 * Mock upstream MCP server used by upstreams.test.ts.
 *
 * Registers one of each: tool, resource, prompt — so the mount layer's three forwarding paths
 * are all exercised. Also registers a second tool with a richer input schema (enum, integer,
 * array, optional-with-default) so the JSON-Schema → Zod converter is covered end-to-end.
 * Designed to run as `node mock_upstream.mjs`.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer(
  { name: 'mock-upstream', version: '1.0.0' },
  { capabilities: { tools: {}, resources: {}, prompts: {} } }
);

server.registerTool(
  'echo',
  {
    description: 'Echoes the provided message',
    inputSchema: { message: z.string() },
  },
  async ({ message }) => ({
    content: [{ type: 'text', text: `echo: ${message}` }],
  })
);

// Second tool: schema exercises enum, integer, array-of-string, and an optional with default.
// The mount layer should still register it and the upstream remains the source of truth for
// validation (defaults are intentionally NOT carried into the parent's Zod shape).
server.registerTool(
  'format',
  {
    description: 'Formats inputs in a chosen style',
    inputSchema: {
      style: z.enum(['short', 'long']),
      count: z.number().int(),
      tags: z.array(z.string()),
      verbose: z.boolean().optional().default(false),
    },
  },
  async ({ style, count, tags, verbose }) => ({
    content: [
      {
        type: 'text',
        text: `style=${style} count=${count} tags=[${tags.join(',')}] verbose=${verbose}`,
      },
    ],
  })
);

server.registerResource(
  'mock-doc',
  'mock://doc',
  { description: 'A mock document', mimeType: 'text/plain' },
  async (uri) => ({
    contents: [{ uri: uri.toString(), mimeType: 'text/plain', text: 'mock body' }],
  })
);

server.registerPrompt(
  'greet',
  {
    description: 'Generates a greeting',
    argsSchema: { name: z.string() },
  },
  async ({ name }) => ({
    messages: [
      {
        role: 'user',
        content: { type: 'text', text: `hello ${name}` },
      },
    ],
  })
);

// Cleaner Ctrl-C / supervised teardown when a test hangs and the harness sends SIGTERM.
// stdio EOF still works without this; this just makes manual debugging less surprising.
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));

await server.connect(new StdioServerTransport());
