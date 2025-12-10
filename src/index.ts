#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as tools from "./tools/index.js";

const server = new McpServer({
  name: "ui5-webcomponents",
  version: "0.0.1",
});

// Register tools
Object.values(tools).forEach(tool => {
  server.tool(tool.name, tool.description, tool.inputSchema, tool.handler);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("UI5 Web Components MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
