import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createTextResponse, handleToolError } from '../../utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = path.join(__dirname, '../../../docs');

const docRequestSchema = z.object({
  path: z.string().describe('Document path (e.g., "docs/08-Releases.md")'),
  lines: z
    .string()
    .optional()
    .describe('Line range like "1-24" or "26-58" (optional, reads full file if omitted)'),
});

function readLines(filePath: string, lineRange?: string): string {
  const content = fs.readFileSync(filePath, 'utf8');

  if (!lineRange) {
    return content;
  }

  const lines = content.split('\n');
  const [start, end] = lineRange.split('-').map((n) => parseInt(n.trim(), 10));

  if (isNaN(start) || isNaN(end) || start < 1 || end < start) {
    throw new Error(`Invalid line range: ${lineRange}`);
  }

  return lines.slice(start - 1, end).join('\n');
}

export const getDocTool = {
  name: 'get_doc',
  description:
    'Get full content of UI5 Web Components documentation file(s). Supports reading multiple documents and specific line ranges.',
  inputSchema: {
    docs: z
      .array(docRequestSchema)
      .describe('Array of documents to read. Each can specify path and optional line range.'),
  },
  handler: async ({ docs }: { docs: Array<{ path: string; lines?: string }> }) => {
    try {
      const results: string[] = [];

      for (const doc of docs) {
        const normalizedPath = doc.path.replace(/^docs\//, '');
        const filePath = path.join(DOCS_DIR, normalizedPath);
        const resolvedPath = path.resolve(filePath);

        if (!resolvedPath.startsWith(path.resolve(DOCS_DIR))) {
          results.push(`Access denied: "${doc.path}" points outside the docs directory.`);
          continue;
        }

        if (!fs.existsSync(filePath)) {
          results.push(`❌ Document "${doc.path}" not found.`);
          continue;
        }

        const content = readLines(filePath, doc.lines);
        const rangeInfo = doc.lines ? ` [lines ${doc.lines}]` : '';
        results.push(`# ${doc.path}${rangeInfo}\n\n${content}`);
      }

      const footer =
        '\n\n**Framework Integration:** If using React, Angular or Vue, also check the get_guidelines tool for framework-specific setup and best practices.';

      return createTextResponse(results.join('\n\n---\n\n') + footer);
    } catch (error) {
      return handleToolError(error, 'Error reading documentation');
    }
  },
};
