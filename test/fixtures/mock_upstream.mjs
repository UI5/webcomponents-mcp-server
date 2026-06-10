/**
 * Mock upstream MCP server used by upstreams.test.ts.
 *
 * Registers one of each: tool, resource, prompt — so the mount layer's three forwarding paths
 * are all exercised. Designed to run as `node mock_upstream.mjs`.
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

await server.connect(new StdioServerTransport());
