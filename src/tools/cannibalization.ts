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
import { formatMeta } from '../utils/meta.js';

export const cannibalizationSchema = {
  siteUrl: z.string().optional().describe('The site URL. Falls back to GSC_DEFAULT_SITE_URL if not provided.'),
  startDate: z.string().optional().describe('Start date in YYYY-MM-DD format (default: 9 days ago)'),
  endDate: z.string().optional().describe('End date in YYYY-MM-DD format (default: 2 days ago)'),
  searchType: z.enum(['web', 'discover', 'googleNews', 'news', 'image', 'video']).optional(),
  minImpressions: z.number().optional().describe('Minimum impressions for a query to be analyzed (default: 50)'),
  rowLimit: z.number().min(1).max(25000).optional().describe('Max rows to fetch (default: 10000)'),
};

interface CannibalizationGroup {
  query: string;
  pages: Array<{
    page: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
  totalImpressions: number;
}

export async function handleCannibalization(
  api: GoogleSearchConsoleAPI,
  args: {
    siteUrl?: string;
    startDate?: string;
    endDate?: string;
    searchType?: string;
    minImpressions?: number;
    rowLimit?: number;
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

  const minImpressions = args.minImpressions ?? 50;
  const rowLimit = args.rowLimit || 10000;

  try {
    const result = await api.querySearchAnalytics({
      siteUrl,
      startDate,
      endDate,
      dimensions: ['query', 'page'],
      searchType: args.searchType,
      rowLimit,
      dataState: 'all',
    });

    // Group by query
    const queryMap = new Map<string, CannibalizationGroup>();

    for (const row of result.rows) {
      const query = (row.keys?.[0] || '').toLowerCase();
      const page = row.keys?.[1] || '';

      if (!queryMap.has(query)) {
        queryMap.set(query, { query, pages: [], totalImpressions: 0 });
      }

      const group = queryMap.get(query)!;
      group.pages.push({
        page,
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: row.ctr || 0,
        position: row.position || 0,
      });
      group.totalImpressions += row.impressions || 0;
    }

    // Find cannibalization: queries with 2+ pages
    const cannibalized = Array.from(queryMap.values())
      .filter((g) => g.pages.length >= 2 && g.totalImpressions >= minImpressions)
      .sort((a, b) => b.totalImpressions - a.totalImpressions)
      .slice(0, 20);

    const meta = formatMeta('cannibalization', { siteUrl, startDate, endDate, minImpressions });

    if (cannibalized.length === 0) {
      return {
        content: [{
          type: 'text' as const,
          text: `No keyword cannibalization detected for ${siteUrl}.\n\nPeriod: ${startDate} to ${endDate}\nMinimum impressions threshold: ${minImpressions}\nRows analyzed: ${result.rows.length}${meta}`,
        }],
      };
    }

    const sections: string[] = [
      `Keyword Cannibalization Report for ${siteUrl}`,
      `Period: ${startDate} to ${endDate}`,
      `Found ${cannibalized.length} queries where multiple pages compete`,
      '',
    ];

    for (const group of cannibalized) {
      sections.push(`### "${group.query}" (${group.pages.length} pages, ${formatNumber(group.totalImpressions)} total impressions)`);

      // Sort pages within group by impressions
      group.pages.sort((a, b) => b.impressions - a.impressions);

      const headers = ['Page', 'Clicks', 'Impressions', 'CTR', 'Position'];
      const rows = group.pages.map((p) => [
        p.page.length > 60 ? p.page.slice(0, 57) + '...' : p.page,
        formatNumber(p.clicks),
        formatNumber(p.impressions),
        formatCTR(p.ctr),
        formatPosition(p.position),
      ]);

      sections.push(formatTable(headers, rows));
      sections.push('');
    }

    sections.push(
      '## What to do about cannibalization',
      '- If one page clearly outperforms: consolidate by redirecting the weaker page(s)',
      '- If pages target different intents: differentiate titles, headings, and content to reduce overlap',
      '- If pages are very similar: merge them into one comprehensive page',
    );
    sections.push(meta);

    return { content: [{ type: 'text' as const, text: sections.join('\n') }] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text' as const, text: `Error detecting cannibalization: ${message}` }],
      isError: true,
    };
  }
}
