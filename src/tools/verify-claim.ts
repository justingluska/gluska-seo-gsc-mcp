import { z } from 'zod';
import { GoogleSearchConsoleAPI } from '../api/search-console.js';
import { defaultDateRange, isValidDate } from '../utils/dates.js';
import { resolveSiteUrl } from '../utils/site-url.js';
import { formatMeta } from '../utils/meta.js';

export const verifyClaimSchema = {
  claim: z.string().describe('The claim to verify (e.g., "homepage gets 500 clicks per week")'),
  siteUrl: z.string().optional().describe('The site URL. Falls back to GSC_DEFAULT_SITE_URL if not provided.'),
  metric: z.enum(['clicks', 'impressions', 'ctr', 'position']).describe('The metric to check'),
  expectedValue: z.number().describe('The expected value of the metric'),
  tolerance: z.number().optional().describe('Acceptable difference as a percentage (default: 5). A value of 5 means the actual value can differ by up to 5% from the expected value.'),
  pageFilter: z.string().optional().describe('Filter to a specific page URL'),
  queryFilter: z.string().optional().describe('Filter to a specific query'),
  startDate: z.string().optional().describe('Start date in YYYY-MM-DD format'),
  endDate: z.string().optional().describe('End date in YYYY-MM-DD format'),
};

export async function handleVerifyClaim(
  api: GoogleSearchConsoleAPI,
  args: {
    claim: string;
    siteUrl?: string;
    metric: string;
    expectedValue: number;
    tolerance?: number;
    pageFilter?: string;
    queryFilter?: string;
    startDate?: string;
    endDate?: string;
  },
) {
  const siteUrl = resolveSiteUrl(args.siteUrl);
  if (!siteUrl) {
    return { content: [{ type: 'text' as const, text: 'No site URL provided. Either pass siteUrl or set the GSC_DEFAULT_SITE_URL environment variable.' }], isError: true };
  }

  const defaults = defaultDateRange();
  const startDate = args.startDate || defaults.startDate;
  const endDate = args.endDate || defaults.endDate;

  if (!isValidDate(startDate) || !isValidDate(endDate)) {
    return { content: [{ type: 'text' as const, text: 'Invalid date format. Use YYYY-MM-DD.' }], isError: true };
  }

  const tolerance = args.tolerance ?? 5;

  try {
    const filters: Array<{ dimension: string; operator: string; expression: string }> = [];
    if (args.pageFilter) {
      filters.push({ dimension: 'page', operator: 'equals', expression: args.pageFilter });
    }
    if (args.queryFilter) {
      filters.push({ dimension: 'query', operator: 'equals', expression: args.queryFilter });
    }

    const result = await api.querySearchAnalytics({
      siteUrl,
      startDate,
      endDate,
      dimensions: [],
      dataState: 'all',
      dimensionFilterGroups: filters.length > 0 ? [{ groupType: 'and', filters }] : undefined,
      rowLimit: 1,
    });

    if (result.rows.length === 0) {
      const meta = formatMeta('verify_claim', { siteUrl, startDate, endDate, metric: args.metric, filters });
      return {
        content: [{
          type: 'text' as const,
          text: `UNVERIFIABLE — No data returned for the specified parameters.\n\nClaim: "${args.claim}"\nExpected ${args.metric}: ${args.expectedValue}\nActual: No data\n\nThe claim cannot be verified because no data was found for this query.${meta}`,
        }],
      };
    }

    const row = result.rows[0];
    const metricMap: Record<string, number> = {
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr || 0,
      position: row.position || 0,
    };

    const actualValue = metricMap[args.metric] ?? 0;
    const difference = args.expectedValue !== 0
      ? Math.abs((actualValue - args.expectedValue) / args.expectedValue) * 100
      : actualValue === 0 ? 0 : 100;

    const verified = difference <= tolerance;

    const status = verified ? 'VERIFIED' : 'DISCREPANCY FOUND';
    const emoji = verified ? '' : '  ← MISMATCH';

    const meta = formatMeta('verify_claim', {
      siteUrl, startDate, endDate, metric: args.metric,
      expectedValue: args.expectedValue, tolerance, filters,
    });

    const output = [
      `${status}`,
      '',
      `Claim: "${args.claim}"`,
      `Metric: ${args.metric}`,
      `Expected: ${formatMetricValue(args.metric, args.expectedValue)}`,
      `Actual:   ${formatMetricValue(args.metric, actualValue)}${emoji}`,
      `Difference: ${difference.toFixed(1)}% (tolerance: ${tolerance}%)`,
      '',
      `Period: ${startDate} to ${endDate}`,
      ...(args.pageFilter ? [`Page filter: ${args.pageFilter}`] : []),
      ...(args.queryFilter ? [`Query filter: ${args.queryFilter}`] : []),
      '',
      verified
        ? 'The data supports this claim within the specified tolerance.'
        : 'The actual data does not match the claimed value. Please use the actual numbers from the API.',
      meta,
    ].join('\n');

    return { content: [{ type: 'text' as const, text: output }] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text' as const, text: `Error verifying claim: ${message}` }],
      isError: true,
    };
  }
}

function formatMetricValue(metric: string, value: number): string {
  switch (metric) {
    case 'ctr':
      return `${(value * 100).toFixed(2)}%`;
    case 'position':
      return value.toFixed(1);
    default:
      return String(Math.round(value));
  }
}
