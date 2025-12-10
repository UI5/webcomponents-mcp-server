import { logger } from './logger.js';

export const NPM_REGISTRY_BASE = "https://registry.npmjs.org";
export const USER_AGENT = "ui5-webc-mcp/1.0";
export const UNPKG_BASE = "https://unpkg.com";

export async function makeNpmRequest<T>(url: string): Promise<T | null> {
  const headers = {
    "User-Agent": USER_AGENT,
    Accept: "application/json",
  };

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return (await response.json()) as T;
  } catch (error) {
    logger.debug("Error making npm request:", error);
    return null;
  }
}

// MCP Response helpers
export function createTextResponse(text: string) {
  return {
    content: [
      {
        type: 'text' as const,
        text,
      },
    ],
  };
}

export function handleToolError(error: unknown, context: string) {
  const message = error instanceof Error ? error.message : String(error);
  logger.debug(`${context}:`, error);
  return createTextResponse(`${context}: ${message}`);
}
