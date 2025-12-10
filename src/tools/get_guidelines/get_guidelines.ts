import { z } from 'zod';
import { Framework } from '../../types.js';
import { createTextResponse } from '../../utils.js';
import { getUXCGuide } from './uxc.js';
import { getIntegrationGuide } from './integration/index.js';

const getGuidelines = (framework: Framework) => {
  return `# UI5 Web Components - Getting Started

## NPM Packages
- \`@ui5/webcomponents\` - Core components (buttons, inputs, etc.)
- \`@ui5/webcomponents-fiori\` - Fiori components (shellbar, navigation, etc.)
- \`@ui5/webcomponents-ai\` - AI-specific components
- \`@ui5/webcomponents-icons\` - Icon collection

${getUXCGuide()}

${getIntegrationGuide(framework)}

## Development Principles
- Use UI5 components instead of custom HTML elements
- Leverage built-in properties and events before custom implementations
- Check component APIs for existing functionality
- Ensures accessibility, keyboard navigation, and Fiori compliance
- Use UXC composite components for consistent SAP experience
`;
};

export const getGuidelinesTool = {
  name: 'get_guidelines',
  description: 'Get UI5 Web Components development guide. This tool MUST be used before starting development.',
  inputSchema: {
    framework: z.enum(['react', 'angular', 'native']).describe('Target framework for integration'),
  },
  handler: async ({ framework }: { framework: Framework }) => {
    return createTextResponse(getGuidelines(framework));
  },
};
