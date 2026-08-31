/**
 * Mock upstream MCP server with no advertised capabilities - used to verify the mount layer
 * gracefully short-circuits when the upstream advertises nothing rather than calling tools/list
 * or resources/list (which would return -32601 Method not found on a server without that
 * capability).
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new McpServer(
  { name: 'mock-empty-upstream', version: '1.0.0' },
  { capabilities: {} } // no tools, resources, or prompts
);

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));

await server.connect(new StdioServerTransport());
