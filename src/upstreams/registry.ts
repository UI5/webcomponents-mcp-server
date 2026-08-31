/**
 * Hardcoded list of upstream MCP servers to mount as namespaced tools/resources/prompts.
 *
 * Adding a new framework MCP (Angular, Vue, ...) is a one-entry PR here plus adding the
 * package to `dependencies` in package.json.
 */
export interface UpstreamSpec {
  /** Used as prefix for mounted tool & prompt names: e.g. "react" -> tools become "react_<name>". */
  prefix: string;
  /** Human-readable label for logs/errors. */
  label: string;
  /** npm package name; the bin to spawn is resolved via its package.json. */
  packageName: string;
}

export const UPSTREAMS: UpstreamSpec[] = [
  {
    prefix: 'react',
    label: 'UI5 Web Components for React',
    packageName: '@ui5/webcomponents-react-mcp',
  },
];
