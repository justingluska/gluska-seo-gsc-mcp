import { z } from 'zod';
import { GoogleSearchConsoleAPI } from '../api/search-console.js';
import { resolveSiteUrl } from '../utils/site-url.js';
import {
  formatNumber,
  formatPercentChange,
  formatTable,
} from '../utils/formatting.js';
import { formatMeta } from '../utils/meta.js';

export const contentDecaySchema = {
  siteUrl: z.string().optional().describe('The site URL. Falls back to GSC_DEFAULT_SITE_URL if not provided.'),
  searchType: z.enum(['web', 'discover', 'googleNews', 'news', 'image', 'video']).optional(),
  months: z.number().min(3).max(6).optional().describe('Number of consecutive declining months to flag (default: 3)'),
  minClicks: z.number().optional().describe('Minimum clicks in the oldest month to be considered (default: 20)'),
  rowLimit: z.number().min(1).max(25000).optional().describe('Max rows per month query (default: 5000)'),
};

interface DecayingPage {
  page: string;
  monthlyClicks: number[];
  monthLabels: string[];
  totalDecline: number;
  declinePercent: string;
}

export async function handleContentDecay(
  api: GoogleSearchConsoleAPI,
  args: {
    siteUrl?: string;
    searchType?: string;
    months?: number;
    minClicks?: number;
    rowLimit?: number;
  },
) {
  const siteUrl = resolveSiteUrl(args.siteUrl);
  if (!siteUrl) {
    return { content: [{ type: 'text' as const, text: 'No site URL provided. Either pass siteUrl or set the GSC_DEFAULT_SITE_URL environment variable.' }], isError: true };
  }

  const consecutiveMonths = args.months || 3;
  const minClicks = args.minClicks || 20;
  const rowLimit = args.rowLimit || 5000;

  try {
    // Build month ranges: we need (consecutiveMonths + 1) months to detect N consecutive declines
    // e.g., for 3 consecutive declining months, we need 4 months of data
    const totalMonths = consecutiveMonths + 1;
    const now = new Date();

    const monthRanges: Array<{ start: string; end: string; label: string }> = [];

    for (let i = totalMonths - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i - 1, 1);
      const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      const end = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      monthRanges.push({ start, end, label });
    }

    // Query each month in parallel
    const monthResults = await Promise.all(
      monthRanges.map((range) =>
        api.querySearchAnalytics({
          siteUrl,
          startDate: range.start,
          endDate: range.end,
          dimensions: ['page'],
          searchType: args.searchType,
          rowLimit,
          dataState: 'final',
        }),
      ),
    );

    // Build per-page monthly click data
    const pageMonthlyData = new Map<string, number[]>();

    for (let m = 0; m < monthResults.length; m++) {
      for (const row of monthResults[m].rows) {
        const page = (row.keys?.[0] || '');
        if (!pageMonthlyData.has(page)) {
          pageMonthlyData.set(page, new Array(monthResults.length).fill(0));
        }
        pageMonthlyData.get(page)![m] = row.clicks || 0;
      }
    }

    // Find pages with N consecutive months of decline
    const decaying: DecayingPage[] = [];

    for (const [page, monthlyClicks] of pageMonthlyData) {
      // Check if oldest month meets minimum
      if (monthlyClicks[0] < minClicks) continue;

      // Check for consecutive decline in the last N months
      // monthlyClicks has totalMonths entries; we check the last consecutiveMonths transitions
      let allDeclining = true;
      for (let i = monthlyClicks.length - consecutiveMonths; i < monthlyClicks.length; i++) {
        if (monthlyClicks[i] >= monthlyClicks[i - 1]) {
          allDeclining = false;
          break;
        }
      }

      if (allDeclining) {
        const firstMonth = monthlyClicks[monthlyClicks.length - consecutiveMonths - 1];
        const lastMonth = monthlyClicks[monthlyClicks.length - 1];
        decaying.push({
          page,
          monthlyClicks,
          monthLabels: monthRanges.map((r) => r.label),
          totalDecline: lastMonth - firstMonth,
          declinePercent: formatPercentChange(firstMonth, lastMonth),
        });
      }
    }

    decaying.sort((a, b) => a.totalDecline - b.totalDecline);
    const topDecaying = decaying.slice(0, 25);

    const meta = formatMeta('content_decay', {
      siteUrl,
      months: consecutiveMonths,
      minClicks,
      monthRanges: monthRanges.map((r) => r.label),
    });

    if (topDecaying.length === 0) {
      return {
        content: [{
          type: 'text' as const,
          text: `No content decay detected for ${siteUrl}.\n\nAnalyzed ${pageMonthlyData.size} pages across ${monthRanges.map((r) => r.label).join(', ')}.\nNo pages showed ${consecutiveMonths} consecutive months of traffic decline (min ${minClicks} clicks in first month).${meta}`,
        }],
      };
    }

    const headers = ['Page', ...monthRanges.map((r) => r.label), 'Total Change'];
    const rows = topDecaying.map((d) => [
      d.page.length > 50 ? d.page.slice(0, 47) + '...' : d.page,
      ...d.monthlyClicks.map((c) => formatNumber(c)),
      d.declinePercent,
    ]);

    const output = [
      `Content Decay Report for ${siteUrl}`,
      `Found ${topDecaying.length} pages with ${consecutiveMonths} consecutive months of traffic decline`,
      '',
      formatTable(headers, rows),
      '',
      '## Recommended Actions',
      '- Review and refresh outdated content (stats, examples, screenshots)',
      '- Check for new SERP competitors that may have overtaken these pages',
      '- Verify no technical issues (deindexing, canonical changes, broken internal links)',
      '- Consider whether search intent has shifted — the page may need a different angle',
      meta,
    ].join('\n');

    return { content: [{ type: 'text' as const, text: output }] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text' as const, text: `Error detecting content decay: ${message}` }],
      isError: true,
    };
  }
}
