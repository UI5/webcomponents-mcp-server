import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createTextResponse, handleToolError } from '../../utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LLMS_TXT_PATH = path.join(__dirname, '../../../resources/llms.txt');

export const listDocsTool = {
  name: 'list_docs',
  description: 'List all available UI5 Web Components documentation with summaries',
  inputSchema: {},
  handler: async () => {
    try {
      const content = fs.readFileSync(LLMS_TXT_PATH, 'utf8');
      
      const response = `# UI5 Web Components Documentation Index

${content}

**Note:** Use the get_doc tool to fetch full content of any document by its path.`;

      return createTextResponse(response);
    } catch (error) {
      return handleToolError(error, 'Error reading documentation index');
    }
  },
};

