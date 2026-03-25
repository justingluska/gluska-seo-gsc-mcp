import { z } from 'zod';
import { GoogleSearchConsoleAPI } from '../api/search-console.js';
import { defaultDateRange, isValidDate } from '../utils/dates.js';
import { resolveSiteUrl } from '../utils/site-url.js';
import {
  formatNumber,
  formatCTR,
  formatTable,
} from '../utils/formatting.js';
import { formatMeta } from '../utils/meta.js';

/**
 * Industry-average CTR by position based on aggregated click-through rate studies.
 * Sources: Advanced Web Ranking, Backlinko/Semrush, FirstPageSage (2023-2025 data).
 * These are approximations — actual CTR varies by industry, intent, and SERP features.
 */
const CTR_BENCHMARKS: Record<number, number> = {
  1: 0.295,   // ~29.5%
  2: 0.155,   // ~15.5%
  3: 0.105,   // ~10.5%
  4: 0.075,   // ~7.5%
  5: 0.055,   // ~5.5%
  6: 0.040,   // ~4.0%
  7: 0.035,   // ~3.5%
  8: 0.030,   // ~3.0%
  9: 0.025,   // ~2.5%
  10: 0.022,  // ~2.2%
};

function getBenchmarkCTR(position: number): number | null {
  const rounded = Math.round(position);
  if (rounded < 1 || rounded > 10) return null;
  return CTR_BENCHMARKS[rounded] || null;
}

export const ctrBenchmarksSchema = {
  siteUrl: z.string().optional().describe('The site URL. Falls back to GSC_DEFAULT_SITE_URL if not provided.'),
  startDate: z.string().optional().describe('Start date in YYYY-MM-DD format (default: 9 days ago)'),
  endDate: z.string().optional().describe('End date in YYYY-MM-DD format (default: 2 days ago)'),
  dimension: z.enum(['query', 'page']).optional().describe('Group by query or page (default: "page")'),
  searchType: z.enum(['web', 'discover', 'googleNews', 'news', 'image', 'video']).optional(),
  rowLimit: z.number().min(1).max(25000).optional().describe('Max rows to analyze (default: 1000)'),
};

export async function handleCTRBenchmarks(
  api: GoogleSearchConsoleAPI,
  args: {
    siteUrl?: string;
    startDate?: string;
    endDate?: string;
    dimension?: string;
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

  const dimension = args.dimension || 'page';
  const rowLimit = args.rowLimit || 1000;

  try {
    const result = await api.querySearchAnalytics({
      siteUrl,
      startDate,
      endDate,
      dimensions: [dimension],
      searchType: args.searchType,
      rowLimit,
      dataState: 'all',
    });

    if (result.rows.length === 0) {
      const meta = formatMeta('ctr_benchmarks', { siteUrl, startDate, endDate, dimension });
      return {
        content: [{
          type: 'text' as const,
          text: `No data found for ${siteUrl} from ${startDate} to ${endDate}.${meta}`,
        }],
      };
    }

    // Filter to position 1-10 only (benchmarks don't apply beyond page 1)
    const page1Rows = result.rows.filter((r) => (r.position || 0) >= 0.5 && (r.position || 0) <= 10.5);

    interface BenchmarkRow {
      label: string;
      clicks: number;
      impressions: number;
      actualCTR: number;
      position: number;
      benchmarkCTR: number;
      ctrDiff: number;
      potentialClicks: number;
    }

    const benchmarked: BenchmarkRow[] = [];

    for (const row of page1Rows) {
      const pos = row.position || 0;
      const benchmark = getBenchmarkCTR(pos);
      if (benchmark === null) continue;

      const actualCTR = row.ctr || 0;
      const ctrDiff = actualCTR - benchmark;
      const impressions = row.impressions || 0;
      const potentialClicks = Math.round(impressions * benchmark) - (row.clicks || 0);

      benchmarked.push({
        label: (row.keys?.[0] || '').slice(0, 55),
        clicks: row.clicks || 0,
        impressions,
        actualCTR,
        position: pos,
        benchmarkCTR: benchmark,
        ctrDiff,
        potentialClicks: Math.max(0, potentialClicks),
      });
    }

    // Sort by potential clicks (biggest opportunities first)
    benchmarked.sort((a, b) => b.potentialClicks - a.potentialClicks);
    const topRows = benchmarked.slice(0, 30);

    // Separate underperforming and overperforming
    const underperforming = topRows.filter((r) => r.ctrDiff < -0.01);
    const overperforming = topRows.filter((r) => r.ctrDiff >= -0.01);

    const meta = formatMeta('ctr_benchmarks', { siteUrl, startDate, endDate, dimension, rowsAnalyzed: page1Rows.length });

    const sections: string[] = [
      `CTR vs Benchmarks for ${siteUrl}`,
      `Period: ${startDate} to ${endDate} | Grouped by: ${dimension}`,
      `Analyzed ${page1Rows.length} ${dimension}s ranking on page 1`,
      '',
    ];

    if (underperforming.length > 0) {
      sections.push('## Below Benchmark (Optimization Opportunities)');
      sections.push('These have lower CTR than expected for their position — title tags and meta descriptions may need work.\n');

      const headers = [
        dimension.charAt(0).toUpperCase() + dimension.slice(1),
        'Clicks', 'Impressions', 'Position', 'Your CTR', 'Benchmark', 'Gap', 'Potential Extra Clicks',
      ];
      const rows = underperforming.map((r) => [
        r.label,
        formatNumber(r.clicks),
        formatNumber(r.impressions),
        r.position.toFixed(1),
        formatCTR(r.actualCTR),
        formatCTR(r.benchmarkCTR),
        `${(r.ctrDiff * 100).toFixed(1)}%`,
        `+${formatNumber(r.potentialClicks)}`,
      ]);
      sections.push(formatTable(headers, rows), '');
    }

    if (overperforming.length > 0) {
      sections.push('## At or Above Benchmark');
      sections.push('These are performing as expected or better.\n');

      const headers = [
        dimension.charAt(0).toUpperCase() + dimension.slice(1),
        'Clicks', 'Position', 'Your CTR', 'Benchmark', 'Gap',
      ];
      const rows = overperforming.map((r) => [
        r.label,
        formatNumber(r.clicks),
        r.position.toFixed(1),
        formatCTR(r.actualCTR),
        formatCTR(r.benchmarkCTR),
        `${r.ctrDiff >= 0 ? '+' : ''}${(r.ctrDiff * 100).toFixed(1)}%`,
      ]);
      sections.push(formatTable(headers, rows), '');
    }

    sections.push(
      '## About These Benchmarks',
      'CTR benchmarks are industry averages aggregated from multiple studies (Advanced Web Ranking, Backlinko/Semrush, FirstPageSage, 2023-2025).',
      'Actual CTR varies significantly by search intent, SERP features, industry, and brand recognition.',
      'Use these as directional guidance, not absolute targets.',
    );
    sections.push(meta);

    return { content: [{ type: 'text' as const, text: sections.join('\n') }] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text' as const, text: `Error analyzing CTR benchmarks: ${message}` }],
      isError: true,
    };
  }
}
