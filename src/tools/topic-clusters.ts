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

export const topicClustersSchema = {
  siteUrl: z.string().optional().describe('The site URL. Falls back to GSC_DEFAULT_SITE_URL if not provided.'),
  urlPrefix: z.string().describe('URL path prefix to analyze (e.g., "/blog/", "/docs/seo/", "/products/"). All pages under this path will be grouped.'),
  startDate: z.string().optional().describe('Start date in YYYY-MM-DD format (default: 9 days ago)'),
  endDate: z.string().optional().describe('End date in YYYY-MM-DD format (default: 2 days ago)'),
  searchType: z.enum(['web', 'discover', 'googleNews', 'news', 'image', 'video']).optional(),
  rowLimit: z.number().min(1).max(25000).optional().describe('Max rows to return (default: 5000)'),
};

export async function handleTopicClusters(
  api: GoogleSearchConsoleAPI,
  args: {
    siteUrl?: string;
    urlPrefix: string;
    startDate?: string;
    endDate?: string;
    searchType?: string;
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

  const rowLimit = args.rowLimit || 5000;

  try {
    // Query pages matching the URL prefix
    const result = await api.querySearchAnalytics({
      siteUrl,
      startDate,
      endDate,
      dimensions: ['page'],
      searchType: args.searchType,
      rowLimit,
      dataState: 'all',
      dimensionFilterGroups: [{
        groupType: 'and',
        filters: [{
          dimension: 'page',
          operator: 'contains',
          expression: args.urlPrefix,
        }],
      }],
    });

    if (result.rows.length === 0) {
      const meta = formatMeta('topic_clusters', { siteUrl, urlPrefix: args.urlPrefix, startDate, endDate });
      return {
        content: [{
          type: 'text' as const,
          text: `No data found for pages matching "${args.urlPrefix}" on ${siteUrl}.\n\nPeriod: ${startDate} to ${endDate}\nCheck the URL prefix matches your site's URL structure.${meta}`,
        }],
      };
    }

    // Sort by clicks descending
    const sorted = result.rows.sort((a, b) => (b.clicks || 0) - (a.clicks || 0));

    // Aggregate totals
    const totalClicks = sorted.reduce((s, r) => s + (r.clicks || 0), 0);
    const totalImpressions = sorted.reduce((s, r) => s + (r.impressions || 0), 0);
    const avgCTR = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
    const avgPosition = sorted.length > 0
      ? sorted.reduce((s, r) => s + (r.position || 0), 0) / sorted.length
      : 0;

    const headers = ['Page', 'Clicks', 'Impressions', 'CTR', 'Position'];
    const rows = sorted.map((r) => [
      (r.keys?.[0] || '').slice(0, 65),
      formatNumber(r.clicks || 0),
      formatNumber(r.impressions || 0),
      formatCTR(r.ctr || 0),
      formatPosition(r.position || 0),
    ]);

    // Also get top queries for this cluster
    const queryResult = await api.querySearchAnalytics({
      siteUrl,
      startDate,
      endDate,
      dimensions: ['query'],
      searchType: args.searchType,
      rowLimit: 20,
      dataState: 'all',
      dimensionFilterGroups: [{
        groupType: 'and',
        filters: [{
          dimension: 'page',
          operator: 'contains',
          expression: args.urlPrefix,
        }],
      }],
    });

    const meta = formatMeta('topic_clusters', { siteUrl, urlPrefix: args.urlPrefix, startDate, endDate });

    const sections: string[] = [
      `Topic Cluster: ${args.urlPrefix}`,
      `Site: ${siteUrl} | Period: ${startDate} to ${endDate}`,
      '',
      `## Cluster Summary`,
      `Pages: ${sorted.length}`,
      `Total clicks: ${formatNumber(totalClicks)}`,
      `Total impressions: ${formatNumber(totalImpressions)}`,
      `Average CTR: ${formatCTR(avgCTR)}`,
      `Average position: ${formatPosition(avgPosition)}`,
      '',
      '## Pages in This Cluster',
      formatTable(headers, rows),
      '',
    ];

    if (queryResult.rows.length > 0) {
      sections.push('## Top Queries Driving Traffic to This Cluster');
      const qHeaders = ['Query', 'Clicks', 'Impressions', 'CTR', 'Position'];
      const qRows = queryResult.rows.map((r) => [
        (r.keys?.[0] || '').slice(0, 50),
        formatNumber(r.clicks || 0),
        formatNumber(r.impressions || 0),
        formatCTR(r.ctr || 0),
        formatPosition(r.position || 0),
      ]);
      sections.push(formatTable(qHeaders, qRows));
    }

    sections.push(meta);

    return { content: [{ type: 'text' as const, text: sections.join('\n') }] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text' as const, text: `Error analyzing topic cluster: ${message}` }],
      isError: true,
    };
  }
}
