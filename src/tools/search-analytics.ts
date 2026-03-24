import { z } from 'zod';
import { GoogleSearchConsoleAPI } from '../api/search-console.js';
import { defaultDateRange, isValidDate } from '../utils/dates.js';
import { resolveSiteUrl } from '../utils/site-url.js';
import {
  formatNumber,
  formatCTR,
  formatPosition,
  formatTable,
} from '../utils/formatting.js';

export const searchAnalyticsSchema = {
  siteUrl: z.string().optional().describe('The site URL (e.g., "https://example.com/" or "sc-domain:example.com"). Falls back to GSC_DEFAULT_SITE_URL env var if not provided.'),
  startDate: z.string().optional().describe('Start date in YYYY-MM-DD format (default: 9 days ago)'),
  endDate: z.string().optional().describe('End date in YYYY-MM-DD format (default: 2 days ago)'),
  dimensions: z
    .array(z.enum(['query', 'page', 'country', 'device', 'searchAppearance', 'date', 'hour']))
    .optional()
    .describe('Dimensions to group by (default: ["query"]). Use "hour" for hourly breakdowns (requires dataState "hourly_all", last ~10 days only).'),
  searchType: z
    .enum(['web', 'discover', 'googleNews', 'news', 'image', 'video'])
    .optional()
    .describe('Type of search results (default: "web")'),
  dataState: z
    .enum(['final', 'all', 'hourly_all'])
    .optional()
    .describe('Data freshness: "final" (2-3 day delay), "all" (includes fresh data), "hourly_all" (hourly breakdown)'),
  filters: z
    .array(
      z.object({
        dimension: z.enum(['query', 'page', 'country', 'device', 'searchAppearance']),
        operator: z.enum(['equals', 'contains', 'notEquals', 'notContains', 'includingRegex', 'excludingRegex']),
        expression: z.string(),
      }),
    )
    .optional()
    .describe('Filters to apply to the query'),
  rowLimit: z.number().min(1).max(25000).optional().describe('Maximum rows to return (default: 1000, max: 25000)'),
  startRow: z.number().min(0).optional().describe('Starting row offset for pagination (default: 0)'),
  aggregationType: z
    .enum(['auto', 'byPage', 'byProperty', 'byNewsShowcasePanel'])
    .optional()
    .describe('How data is aggregated (default: "auto")'),
};

export async function handleSearchAnalytics(
  api: GoogleSearchConsoleAPI,
  args: {
    siteUrl?: string;
    startDate?: string;
    endDate?: string;
    dimensions?: string[];
    searchType?: string;
    dataState?: string;
    filters?: Array<{ dimension: string; operator: string; expression: string }>;
    rowLimit?: number;
    startRow?: number;
    aggregationType?: string;
  },
) {
  const siteUrl = resolveSiteUrl(args.siteUrl);
  if (!siteUrl) {
    return { content: [{ type: 'text' as const, text: 'No site URL provided. Either pass siteUrl or set the GSC_DEFAULT_SITE_URL environment variable.' }], isError: true };
  }

  const defaults = defaultDateRange();
  const startDate = args.startDate || defaults.startDate;
  const endDate = args.endDate || defaults.endDate;

  if (!isValidDate(startDate)) {
    return { content: [{ type: 'text' as const, text: `Invalid start date: "${startDate}". Use YYYY-MM-DD format.` }], isError: true };
  }
  if (!isValidDate(endDate)) {
    return { content: [{ type: 'text' as const, text: `Invalid end date: "${endDate}". Use YYYY-MM-DD format.` }], isError: true };
  }

  const dimensions = args.dimensions || ['query'];
  const dataState = args.dataState || process.env.GSC_DATA_STATE || 'all';

  try {
    const result = await api.querySearchAnalytics({
      siteUrl: siteUrl,
      startDate,
      endDate,
      dimensions,
      searchType: args.searchType,
      dataState,
      dimensionFilterGroups: args.filters
        ? [{ groupType: 'and', filters: args.filters }]
        : undefined,
      rowLimit: args.rowLimit || 1000,
      startRow: args.startRow || 0,
      aggregationType: args.aggregationType,
    });

    if (result.rows.length === 0) {
      return {
        content: [{
          type: 'text' as const,
          text: `No data found for ${siteUrl} from ${startDate} to ${endDate} with dimensions [${dimensions.join(', ')}].\n\nThis could mean:\n- The site has no traffic for this period/search type\n- The date range is too recent (try dates 3+ days ago with dataState "final")\n- The site URL format is incorrect (use "https://example.com/" with trailing slash, or "sc-domain:example.com")`,
        }],
      };
    }

    // Build curated response
    const headers = [...dimensions.map((d) => d.charAt(0).toUpperCase() + d.slice(1)), 'Clicks', 'Impressions', 'CTR', 'Position'];
    const rows = result.rows.map((row) => [
      ...(row.keys || []),
      formatNumber(row.clicks || 0),
      formatNumber(row.impressions || 0),
      formatCTR(row.ctr || 0),
      formatPosition(row.position || 0),
    ]);

    // Summary stats
    const totalClicks = result.rows.reduce((sum, r) => sum + (r.clicks || 0), 0);
    const totalImpressions = result.rows.reduce((sum, r) => sum + (r.impressions || 0), 0);
    const avgCTR = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
    const avgPosition =
      result.rows.length > 0
        ? result.rows.reduce((sum, r) => sum + (r.position || 0), 0) / result.rows.length
        : 0;

    const summary = [
      `Search Analytics for ${siteUrl}`,
      `Period: ${startDate} to ${endDate} | Search Type: ${args.searchType || 'web'} | Data: ${dataState}`,
      `Total: ${formatNumber(totalClicks)} clicks, ${formatNumber(totalImpressions)} impressions, ${formatCTR(avgCTR)} avg CTR, ${formatPosition(avgPosition)} avg position`,
      `Showing ${result.rows.length} rows${args.startRow ? ` (offset: ${args.startRow})` : ''}`,
      '',
      formatTable(headers, rows),
    ].join('\n');

    return { content: [{ type: 'text' as const, text: summary }] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{
        type: 'text' as const,
        text: `Error querying search analytics: ${message}\n\nTroubleshooting:\n- Verify the site URL format (include protocol and trailing slash, or use "sc-domain:" prefix)\n- Ensure the authenticated account has access to this property\n- Check that the date range is valid (data available for last 16 months)`,
      }],
      isError: true,
    };
  }
}
