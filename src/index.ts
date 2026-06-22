#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as tools from "./tools/index.js";

const server = new McpServer({
  name: "ui5-webcomponents",
  version: "0.0.1",
});

// Register tools
Object.values(tools).forEach(tool => {
  server.tool(tool.name, tool.description, tool.inputSchema, tool.handler);
});

// Register MCP Prompts
server.registerPrompt(
  'upgrade-from-version',
  {
    title: 'Upgrade UI5 Web Components',
    description: 'Generate a step-by-step migration checklist for upgrading UI5 Web Components between versions',
    argsSchema: {
      fromVersion: z.string().describe('Current version (e.g., "2.6.0")'),
      toVersion: z.string().optional().default('latest').describe('Target version (e.g., "2.8.0" or "latest")'),
    },
  },
  ({ fromVersion, toVersion }) => ({
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text:
            `I am upgrading UI5 Web Components from version ${fromVersion} to ${toVersion ?? 'latest'}. ` +
            `Use get_upgrade_guidance to analyze breaking changes, then provide a step-by-step migration ` +
            `checklist. Include code examples for any renamed APIs or changed component behaviors.`,
        },
      },
    ],
  })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("UI5 Web Components MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
