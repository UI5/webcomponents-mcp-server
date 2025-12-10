[![REUSE status](https://api.reuse.software/badge/github.com/UI5/ui5-web-components-mcp-server)](https://api.reuse.software/info/github.com/UI5/ui5-web-components-mcp-server)

# UI5 Web Components MCP Server

## About this project

The UI5 Web Components MCP Server improves the developer experience when working with agentic AI and the UI5 Web Components framework.

## Requirements and Setup

See [Getting Started](https://ui5.github.io/webcomponents/docs/getting-started/first-steps/) on how to jumpstart your development and grow as you go with UI5 Web Components.

## Installation

```bash
git clone https://github.com/UI5/webcomponents-mcp-server.git
cd webcomponents-mcp-server
npm install
npm run build
npm install -g .
```

## Usage

Add to your MCP client config (e.g., `.vscode/mcp.json` for GitHub Copilot):

```json
{
  "servers": {
    "ui5-webc": {
      "type": "stdio",
      "command": "ui5-webc-mcp"
    }
  }
}
```

Then ask your AI assistant:
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

This project is open to feature requests/suggestions, bug reports etc. via [GitHub issues](https://github.com/UI5/ui5-web-components-mcp-server/issues). Contribution and feedback are encouraged and always welcome. For more information about how to contribute, the project structure, as well as additional contribution information, see our [Contribution Guidelines](CONTRIBUTING.md).

## Security / Disclosure
If you find any bug that may be a security problem, please follow our instructions at [in our security policy](https://github.com/UI5/ui5-web-components-mcp-server/security/policy) on how to report it. Please do not create GitHub issues for security-related doubts or problems.

## Code of Conduct

We as members, contributors, and leaders pledge to make participation in our community a harassment-free experience for everyone. By participating in this project, you agree to abide by its [Code of Conduct](https://github.com/SAP/.github/blob/main/CODE_OF_CONDUCT.md) at all times.

## Licensing

Copyright 2025 SAP SE or an SAP affiliate company and ui5-web-components-mcp-server contributors. Please see our [LICENSE](LICENSE) for copyright and license information. Detailed information including third-party components and their licensing/copyright information is available [via the REUSE tool](https://api.reuse.software/info/github.com/UI5/ui5-web-components-mcp-server).
