import { z } from 'zod';
import { findComponentInPackages, formatComponentAPI } from './manifest_processor.js';
import { createTextResponse, handleToolError } from '../../utils.js';

type GetComponentAPIToolPayload = {
  componentName: string;
  version?: string;
};

export const getComponentApiTool = {
  name: 'get_component_api',
  description:
    'Get API documentation for a specific UI5 Web Component from @ui5/webcomponents, @ui5/webcomponents-fiori, @ui5/webcomponents-ai',
  inputSchema: {
    componentName: z
      .string()
      .describe("Component name (e.g., 'ui5-button', 'ui5-input', 'ui5-shellbar')"),
    version: z
      .string()
      .optional()
      .default('latest')
      .describe(
        'Version of the UI5 Web Components packages (e.g., "2.12.0"). If not provided, the latest version will be used.'
      ),
  },
  handler: async ({ componentName, version = 'latest' }: GetComponentAPIToolPayload) => {
    try {
      if (!/^[\da-zA-Z.\-]+$/.test(version)) {
        return createTextResponse(
          `Access denied: version "${version}" contains invalid characters. Use a semver string (e.g., "2.12.0") or "latest".`
        );
      }

      // transform any to kebab-case e.g avatar group (space) or
      // avatarGroup or AvatarGroup (camelCase) to avatar-group
      let normalizedName = componentName
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .replace(/\s+/g, '-')
        .toLowerCase();
      // prefix with ui5- if not present
      normalizedName = normalizedName.startsWith('ui5-') ? normalizedName : `ui5-${normalizedName}`;

      const componentData = await findComponentInPackages(normalizedName, version);

      if (!componentData) {
        return createTextResponse(
          `Component "${normalizedName}" not found in any of the UI5 Web Components packages (@ui5/webcomponents, @ui5/webcomponents-fiori, @ui5/webcomponents-ai). For a complete list of available components, visit https://sap.github.io/ui5-webcomponents/`
        );
      }

      return createTextResponse(formatComponentAPI(componentData));
    } catch (error) {
      return handleToolError(error, `Error retrieving API documentation for ${componentName}`);
    }
  },
};
