import { z } from 'zod';
import { GoogleSearchConsoleAPI, SearchAnalyticsRow } from '../api/search-console.js';
import { daysAgo } from '../utils/dates.js';
import { resolveSiteUrl } from '../utils/site-url.js';
import {
  formatNumber,
  formatCTR,
  formatPosition,
  formatPercentChange,
  formatTable,
} from '../utils/formatting.js';
import { formatMeta } from '../utils/meta.js';

export const findOpportunitiesSchema = {
  siteUrl: z.string().optional().describe('The site URL. Falls back to GSC_DEFAULT_SITE_URL if not provided.'),
  type: z
    .enum(['quick_wins', 'declining', 'emerging', 'all'])
    .optional()
    .describe('Type of opportunities to find (default: "all")'),
  searchType: z.enum(['web', 'discover', 'googleNews', 'news', 'image', 'video']).optional(),
  rowLimit: z.number().min(1).max(25000).optional().describe('Max rows to analyze (default: 5000)'),
};

export async function handleFindOpportunities(
  api: GoogleSearchConsoleAPI,
  args: {
    siteUrl?: string;
    type?: string;
    searchType?: string;
    rowLimit?: number;
  },
) {
  const siteUrl = resolveSiteUrl(args.siteUrl);
  if (!siteUrl) {
    return { content: [{ type: 'text' as const, text: 'No site URL provided. Either pass siteUrl or set the GSC_DEFAULT_SITE_URL environment variable.' }], isError: true };
  }

  const type = args.type || 'all';
  const rowLimit = args.rowLimit || 5000;

  try {
    // Fetch recent period and comparison period
    const recentStart = daysAgo(9);
    const recentEnd = daysAgo(2);
    const priorStart = daysAgo(37);
    const priorEnd = daysAgo(30);

    const [recent, prior] = await Promise.all([
      api.querySearchAnalytics({
        siteUrl: siteUrl,
        startDate: recentStart,
        endDate: recentEnd,
        dimensions: ['query', 'page'],
        searchType: args.searchType,
        rowLimit,
        dataState: 'all',
      }),
      api.querySearchAnalytics({
        siteUrl: siteUrl,
        startDate: priorStart,
        endDate: priorEnd,
        dimensions: ['query', 'page'],
        searchType: args.searchType,
        rowLimit,
        dataState: 'all',
      }),
    ]);

    const sections: string[] = [
      `Opportunity Analysis for ${siteUrl}`,
      `Recent: ${recentStart} to ${recentEnd} | Prior: ${priorStart} to ${priorEnd}`,
      '',
    ];

    // Quick Wins: position 5-20, high impressions, low CTR
    if (type === 'quick_wins' || type === 'all') {
      const quickWins = recent.rows
        .filter(
          (r) =>
            (r.position || 0) >= 5 &&
            (r.position || 0) <= 20 &&
            (r.impressions || 0) >= 50 &&
            (r.ctr || 0) < 0.05,
        )
        .sort((a, b) => (b.impressions || 0) - (a.impressions || 0))
        .slice(0, 20);

      if (quickWins.length > 0) {
        sections.push('## Quick Wins');
        sections.push(
          'High-impression queries ranking 5-20 with low CTR. Optimizing titles/descriptions could boost clicks significantly.',
          '',
        );
        const headers = ['Query', 'Page', 'Clicks', 'Impressions', 'CTR', 'Position'];
        const rows = quickWins.map((r) => [
          (r.keys?.[0] || '').slice(0, 50),
          (r.keys?.[1] || '').slice(0, 60),
          formatNumber(r.clicks || 0),
          formatNumber(r.impressions || 0),
          formatCTR(r.ctr || 0),
          formatPosition(r.position || 0),
        ]);
        sections.push(formatTable(headers, rows), '');
      } else {
        sections.push('## Quick Wins\nNo quick win opportunities found for this period.\n');
      }
    }

    // Declining: queries/pages that lost significant traffic
    if (type === 'declining' || type === 'all') {
      const keyFn = (row: SearchAnalyticsRow) => (row.keys || []).join('|||');
      const priorMap = new Map(prior.rows.map((r) => [keyFn(r), r]));

      const declining = recent.rows
        .map((r) => {
          const p = priorMap.get(keyFn(r));
          if (!p) return null;
          const clickDelta = (r.clicks || 0) - (p.clicks || 0);
          if (clickDelta >= 0) return null;
          return { ...r, priorClicks: p.clicks || 0, clickDelta, priorPosition: p.position || 0 };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null)
        .sort((a, b) => a.clickDelta - b.clickDelta)
        .slice(0, 20);

      if (declining.length > 0) {
        sections.push('## Declining Content');
        sections.push('Pages/queries that lost traffic compared to the prior period.\n');
        const headers = ['Query', 'Page', 'Prev Clicks', 'Now Clicks', 'Change', 'Prev Pos', 'Now Pos'];
        const rows = declining.map((r) => [
          (r.keys?.[0] || '').slice(0, 40),
          (r.keys?.[1] || '').slice(0, 50),
          formatNumber(r.priorClicks),
          formatNumber(r.clicks || 0),
          formatPercentChange(r.priorClicks, r.clicks || 0),
          formatPosition(r.priorPosition),
          formatPosition(r.position || 0),
        ]);
        sections.push(formatTable(headers, rows), '');
      } else {
        sections.push('## Declining Content\nNo significant declines detected.\n');
      }
    }

    // Emerging: queries in recent data not present (or very low) in prior
    if (type === 'emerging' || type === 'all') {
      const keyFn = (row: SearchAnalyticsRow) => (row.keys || []).join('|||');
      const priorMap = new Map(prior.rows.map((r) => [keyFn(r), r]));

      const emerging = recent.rows
        .map((r) => {
          const p = priorMap.get(keyFn(r));
          const priorClicks = p?.clicks || 0;
          const recentClicks = r.clicks || 0;
          if (recentClicks < 5) return null;
          if (priorClicks > 0 && recentClicks / priorClicks < 2) return null;
          return { ...r, priorClicks, growth: priorClicks > 0 ? recentClicks / priorClicks : Infinity };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null)
        .sort((a, b) => (b.clicks || 0) - (a.clicks || 0))
        .slice(0, 20);

      if (emerging.length > 0) {
        sections.push('## Emerging Queries');
        sections.push('New or rapidly growing queries.\n');
        const headers = ['Query', 'Page', 'Prev Clicks', 'Now Clicks', 'Growth', 'Position'];
        const rows = emerging.map((r) => [
          (r.keys?.[0] || '').slice(0, 40),
          (r.keys?.[1] || '').slice(0, 50),
          formatNumber(r.priorClicks),
          formatNumber(r.clicks || 0),
          r.priorClicks === 0 ? 'NEW' : `${r.growth.toFixed(1)}x`,
          formatPosition(r.position || 0),
        ]);
        sections.push(formatTable(headers, rows), '');
      } else {
        sections.push('## Emerging Queries\nNo significant emerging queries detected.\n');
      }
    }

    const meta = formatMeta('find_opportunities', { siteUrl, type, recentStart, recentEnd, priorStart, priorEnd });
    sections.push(meta);

    return { content: [{ type: 'text' as const, text: sections.join('\n') }] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text' as const, text: `Error finding opportunities: ${message}` }],
      isError: true,
    };
  }
}
