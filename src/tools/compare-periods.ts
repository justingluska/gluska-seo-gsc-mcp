import { z } from 'zod';
import { GoogleSearchConsoleAPI, SearchAnalyticsRow } from '../api/search-console.js';
import { isValidDate } from '../utils/dates.js';
import { resolveSiteUrl } from '../utils/site-url.js';
import {
  formatNumber,
  formatCTR,
  formatPosition,
  formatDelta,
  formatPercentChange,
  formatTable,
} from '../utils/formatting.js';
import { formatMeta } from '../utils/meta.js';

export const comparePeriodsSchema = {
  siteUrl: z.string().optional().describe('The site URL. Falls back to GSC_DEFAULT_SITE_URL if not provided.'),
  period1StartDate: z.string().describe('First period start date (YYYY-MM-DD) — the "before" period'),
  period1EndDate: z.string().describe('First period end date (YYYY-MM-DD)'),
  period2StartDate: z.string().describe('Second period start date (YYYY-MM-DD) — the "after" period'),
  period2EndDate: z.string().describe('Second period end date (YYYY-MM-DD)'),
  dimensions: z
    .array(z.enum(['query', 'page', 'country', 'device', 'searchAppearance']))
    .optional()
    .describe('Dimensions to compare by (default: ["query"])'),
  searchType: z.enum(['web', 'discover', 'googleNews', 'news', 'image', 'video']).optional(),
  rowLimit: z.number().min(1).max(25000).optional().describe('Max rows per period (default: 100)'),
};

export async function handleComparePeriods(
  api: GoogleSearchConsoleAPI,
  args: {
    siteUrl?: string;
    period1StartDate: string;
    period1EndDate: string;
    period2StartDate: string;
    period2EndDate: string;
    dimensions?: string[];
    searchType?: string;
    rowLimit?: number;
  },
) {
  const siteUrl = resolveSiteUrl(args.siteUrl);
  if (!siteUrl) {
    return { content: [{ type: 'text' as const, text: 'No site URL provided. Either pass siteUrl or set the GSC_DEFAULT_SITE_URL environment variable.' }], isError: true };
  }

  const dates = [args.period1StartDate, args.period1EndDate, args.period2StartDate, args.period2EndDate];
  for (const d of dates) {
    if (!isValidDate(d)) {
      return { content: [{ type: 'text' as const, text: `Invalid date: "${d}". Use YYYY-MM-DD format.` }], isError: true };
    }
  }

  const dimensions = args.dimensions || ['query'];
  const rowLimit = args.rowLimit || 100;

  try {
    // Fetch both periods in parallel
    const [period1, period2] = await Promise.all([
      api.querySearchAnalytics({
        siteUrl: siteUrl,
        startDate: args.period1StartDate,
        endDate: args.period1EndDate,
        dimensions,
        searchType: args.searchType,
        rowLimit,
        dataState: 'all',
      }),
      api.querySearchAnalytics({
        siteUrl: siteUrl,
        startDate: args.period2StartDate,
        endDate: args.period2EndDate,
        dimensions,
        searchType: args.searchType,
        rowLimit,
        dataState: 'all',
      }),
    ]);

    // Build lookup maps
    const keyFn = (row: SearchAnalyticsRow) => (row.keys || []).join('|||');
    const p1Map = new Map(period1.rows.map((r) => [keyFn(r), r]));
    const p2Map = new Map(period2.rows.map((r) => [keyFn(r), r]));

    // Merge all keys
    const allKeys = new Set([...p1Map.keys(), ...p2Map.keys()]);

    interface ComparisonRow {
      keys: string[];
      p1Clicks: number;
      p2Clicks: number;
      clicksDelta: number;
      p1Impressions: number;
      p2Impressions: number;
      impressionsDelta: number;
      p1CTR: number;
      p2CTR: number;
      p1Position: number;
      p2Position: number;
    }

    const comparisons: ComparisonRow[] = [];

    for (const key of allKeys) {
      const p1 = p1Map.get(key);
      const p2 = p2Map.get(key);

      comparisons.push({
        keys: key.split('|||'),
        p1Clicks: p1?.clicks || 0,
        p2Clicks: p2?.clicks || 0,
        clicksDelta: (p2?.clicks || 0) - (p1?.clicks || 0),
        p1Impressions: p1?.impressions || 0,
        p2Impressions: p2?.impressions || 0,
        impressionsDelta: (p2?.impressions || 0) - (p1?.impressions || 0),
        p1CTR: p1?.ctr || 0,
        p2CTR: p2?.ctr || 0,
        p1Position: p1?.position || 0,
        p2Position: p2?.position || 0,
      });
    }

    // Sort by absolute clicks delta (biggest changes first)
    comparisons.sort((a, b) => Math.abs(b.clicksDelta) - Math.abs(a.clicksDelta));

    // Overall totals
    const totalP1Clicks = comparisons.reduce((s, r) => s + r.p1Clicks, 0);
    const totalP2Clicks = comparisons.reduce((s, r) => s + r.p2Clicks, 0);
    const totalP1Imp = comparisons.reduce((s, r) => s + r.p1Impressions, 0);
    const totalP2Imp = comparisons.reduce((s, r) => s + r.p2Impressions, 0);

    const headers = [
      ...dimensions.map((d) => d.charAt(0).toUpperCase() + d.slice(1)),
      'P1 Clicks',
      'P2 Clicks',
      'Delta',
      'Change',
      'P1 Pos',
      'P2 Pos',
    ];

    const rows = comparisons.slice(0, 50).map((c) => [
      ...c.keys,
      formatNumber(c.p1Clicks),
      formatNumber(c.p2Clicks),
      formatDelta(c.clicksDelta, formatNumber),
      formatPercentChange(c.p1Clicks, c.p2Clicks),
      formatPosition(c.p1Position),
      formatPosition(c.p2Position),
    ]);

    const meta = formatMeta('compare_periods', {
      siteUrl,
      period1: `${args.period1StartDate} to ${args.period1EndDate}`,
      period2: `${args.period2StartDate} to ${args.period2EndDate}`,
      dimensions,
    });

    const summary = [
      `Period Comparison for ${siteUrl}`,
      `Period 1: ${args.period1StartDate} to ${args.period1EndDate}`,
      `Period 2: ${args.period2StartDate} to ${args.period2EndDate}`,
      '',
      `Overall: Clicks ${formatNumber(totalP1Clicks)} → ${formatNumber(totalP2Clicks)} (${formatPercentChange(totalP1Clicks, totalP2Clicks)})`,
      `         Impressions ${formatNumber(totalP1Imp)} → ${formatNumber(totalP2Imp)} (${formatPercentChange(totalP1Imp, totalP2Imp)})`,
      '',
      `Top changes (sorted by absolute click delta):`,
      formatTable(headers, rows),
      meta,
    ].join('\n');

    return { content: [{ type: 'text' as const, text: summary }] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text' as const, text: `Error comparing periods: ${message}` }],
      isError: true,
    };
  }
}
