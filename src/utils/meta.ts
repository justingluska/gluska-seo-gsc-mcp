/**
 * Data provenance metadata for tool responses.
 * Anchors AI responses to actual API data by including source, tool, and parameters.
 */

export interface ResponseMeta {
  source: string;
  tool: string;
  parameters: Record<string, unknown>;
  timestamp: string;
}

/**
 * Creates a formatted _meta block to append to tool responses.
 * This helps prevent hallucination by making the data source explicit.
 */
export function formatMeta(tool: string, parameters: Record<string, unknown>): string {
  const meta: ResponseMeta = {
    source: 'Google Search Console API',
    tool,
    parameters,
    timestamp: new Date().toISOString(),
  };
  return `\n\n---\n_meta: ${JSON.stringify(meta)}`;
}
