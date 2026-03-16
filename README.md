[![REUSE status](https://api.reuse.software/badge/github.com/UI5/webcomponents-mcp-server)](https://api.reuse.software/info/github.com/UI5/webcomponents-mcp-server)
[![npm Package Version](https://badge.fury.io/js/%40ui5%2Fwebcomponents-mcp-server.svg)](https://www.npmjs.com/package/@ui5/webcomponents-mcp-server)

# UI5 Web Components MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io/) server for UI5 Web Components development.

## Requirements

- [Node.js](https://nodejs.org/) Version v20.17.0, v22.9.0 or higher
- [npm](https://www.npmjs.com/) Version v8.0.0 or higher
- An MCP client, such as VS Code (GitHub Copilot), Claude Code, Codex, or any other MCP-compatible client

## Setup

### Standard Configuration for Most Clients

This configuration works for most MCP clients:

```json
{
  "mcpServers": {
    "@ui5/webcomponents-mcp-server": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@ui5/webcomponents-mcp-server"]
    }
  }
}
```

<details>
  <summary><i>Special configuration for native Windows</i></summary>
On native Windows (not WSL), you might need to prefix npx with `cmd /c`:

```json
{
  "mcpServers": {
    "@ui5/webcomponents-mcp-server": {
      "type": "stdio",
      "command": "cmd",
      "args": ["/c", "npx -y @ui5/webcomponents-mcp-server"]
    }
  }
}
```

</details>

### Specific MCP Clients

Besides the general configuration outlined above, some MCP clients offer shortcuts for installing MCP servers.

#### VS Code

```bash
code --add-mcp '{"name":"@ui5/webcomponents-mcp-server","type":"stdio","command":"npx","args":["-y","@ui5/webcomponents-mcp-server"]}'
```

#### Claude Code

```bash
claude mcp add --transport stdio --scope user ui5-webc-mcp-server -- npx -y @ui5/webcomponents-mcp-server
```

#### Codex

```bash
codex mcp add --transport stdio ui5-webc-mcp-server -- npx -y @ui5/webcomponents-mcp-server
```

## Usage

Once set up, ask your AI assistant things like:

- "Show me the API for ui5-button"
- "How do I use UI5 Web Components with React?"
- "Show me the available documentation"
- "Get the theming documentation"

## Available Tools

### `get_component_api`

Fetch API docs for any UI5 Web Component (properties, slots, events, methods).  
Searches across `@ui5/webcomponents`, `@ui5/webcomponents-fiori`, and `@ui5/webcomponents-ai` packages.

### `get_guidelines`

Get integration guides for React, Angular, or native JavaScript.  
Includes installation, imports, and usage examples.

### `list_docs`

List all available UI5 Web Components documentation with summaries.

### `get_doc`

Fetch full content of specific documentation files.

## Development

```bash
npm run build         # Build TypeScript
npm run dev           # Run locally
npm run test          # Run tests
npm run inspector     # Debug with MCP inspector
npm run prepare:docs  # Fetch latest docs from GitHub
```

## Support, Feedback, Contributing

This project is open to feature requests/suggestions, bug reports etc. via [GitHub issues](https://github.com/UI5/webcomponents-mcp-server/issues). Contribution and feedback are encouraged and always welcome. For more information about how to contribute, the project structure, as well as additional contribution information, see our [Contribution Guidelines](CONTRIBUTING.md).

## Security / Disclosure

If you find any bug that may be a security problem, please follow our instructions at [in our security policy](https://github.com/UI5/webcomponents-mcp-server/security/policy) on how to report it. Please do not create GitHub issues for security-related doubts or problems.

## Code of Conduct

We as members, contributors, and leaders pledge to make participation in our community a harassment-free experience for everyone. By participating in this project, you agree to abide by its [Code of Conduct](https://github.com/SAP/.github/blob/main/CODE_OF_CONDUCT.md) at all times.

## Licensing

Copyright 2025 SAP SE or an SAP affiliate company and ui5-web-components-mcp-server contributors. Please see our [LICENSE](LICENSE) for copyright and license information. Detailed information including third-party components and their licensing/copyright information is available [via the REUSE tool](https://api.reuse.software/info/github.com/UI5/webcomponents-mcp-server).
