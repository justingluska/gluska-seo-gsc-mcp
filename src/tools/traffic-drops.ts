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

export const diagnoseTrafficDropsSchema = {
  siteUrl: z.string().optional().describe('The site URL. Falls back to GSC_DEFAULT_SITE_URL if not provided.'),
  searchType: z.enum(['web', 'discover', 'googleNews', 'news', 'image', 'video']).optional(),
  rowLimit: z.number().min(1).max(25000).optional().describe('Max rows to analyze per period (default: 5000)'),
  minClicksDrop: z.number().optional().describe('Minimum click decrease to flag a page (default: 10)'),
};

type DropDiagnosis = 'ranking_loss' | 'ctr_collapse' | 'demand_decline' | 'mixed';

interface DiagnosedDrop {
  page: string;
  recentClicks: number;
  priorClicks: number;
  clickDelta: number;
  recentPosition: number;
  priorPosition: number;
  recentCTR: number;
  priorCTR: number;
  recentImpressions: number;
  priorImpressions: number;
  diagnosis: DropDiagnosis;
  explanation: string;
}

export async function handleDiagnoseTrafficDrops(
  api: GoogleSearchConsoleAPI,
  args: {
    siteUrl?: string;
    searchType?: string;
    rowLimit?: number;
    minClicksDrop?: number;
  },
) {
  const siteUrl = resolveSiteUrl(args.siteUrl);
  if (!siteUrl) {
    return { content: [{ type: 'text' as const, text: 'No site URL provided. Either pass siteUrl or set the GSC_DEFAULT_SITE_URL environment variable.' }], isError: true };
  }

  const rowLimit = args.rowLimit || 5000;
  const minClicksDrop = args.minClicksDrop || 10;

  try {
    const recentStart = daysAgo(9);
    const recentEnd = daysAgo(2);
    const priorStart = daysAgo(37);
    const priorEnd = daysAgo(30);

    const [recent, prior] = await Promise.all([
      api.querySearchAnalytics({
        siteUrl,
        startDate: recentStart,
        endDate: recentEnd,
        dimensions: ['page'],
        searchType: args.searchType,
        rowLimit,
        dataState: 'all',
      }),
      api.querySearchAnalytics({
        siteUrl,
        startDate: priorStart,
        endDate: priorEnd,
        dimensions: ['page'],
        searchType: args.searchType,
        rowLimit,
        dataState: 'all',
      }),
    ]);

    const keyFn = (row: SearchAnalyticsRow) => (row.keys || [])[0] || '';
    const priorMap = new Map(prior.rows.map((r) => [keyFn(r), r]));

    const drops: DiagnosedDrop[] = [];

    for (const r of recent.rows) {
      const page = keyFn(r);
      const p = priorMap.get(page);
      if (!p) continue;

      const clickDelta = (r.clicks || 0) - (p.clicks || 0);
      if (clickDelta >= -minClicksDrop) continue;

      const recentPos = r.position || 0;
      const priorPos = p.position || 0;
      const recentCTR = r.ctr || 0;
      const priorCTR = p.ctr || 0;
      const recentImp = r.impressions || 0;
      const priorImp = p.impressions || 0;

      const positionWorsened = recentPos - priorPos > 1;
      const ctrDropped = priorCTR > 0 && (recentCTR - priorCTR) / priorCTR < -0.15;
      const impressionsDropped = priorImp > 0 && (recentImp - priorImp) / priorImp < -0.2;

      let diagnosis: DropDiagnosis;
      let explanation: string;

      if (positionWorsened && !impressionsDropped) {
        diagnosis = 'ranking_loss';
        explanation = `Position dropped from ${priorPos.toFixed(1)} to ${recentPos.toFixed(1)}. Investigate content quality, backlinks, or algorithm changes.`;
      } else if (ctrDropped && !positionWorsened) {
        diagnosis = 'ctr_collapse';
        explanation = `CTR fell from ${(priorCTR * 100).toFixed(1)}% to ${(recentCTR * 100).toFixed(1)}% while position held. Check for SERP feature changes, competitor snippets, or stale title tags.`;
      } else if (impressionsDropped && !positionWorsened) {
        diagnosis = 'demand_decline';
        explanation = `Impressions dropped ${formatPercentChange(priorImp, recentImp)}. Search demand for this topic may be declining (seasonality, trend shift).`;
      } else {
        diagnosis = 'mixed';
        const factors: string[] = [];
        if (positionWorsened) factors.push('ranking loss');
        if (ctrDropped) factors.push('CTR decline');
        if (impressionsDropped) factors.push('demand decline');
        explanation = `Multiple factors: ${factors.join(' + ')}.`;
      }

      drops.push({
        page,
        recentClicks: r.clicks || 0,
        priorClicks: p.clicks || 0,
        clickDelta,
        recentPosition: recentPos,
        priorPosition: priorPos,
        recentCTR,
        priorCTR,
        recentImpressions: recentImp,
        priorImpressions: priorImp,
        diagnosis,
        explanation,
      });
    }

    drops.sort((a, b) => a.clickDelta - b.clickDelta);
    const topDrops = drops.slice(0, 25);

    if (topDrops.length === 0) {
      const meta = formatMeta('diagnose_traffic_drops', { siteUrl, recentStart, recentEnd, priorStart, priorEnd });
      return {
        content: [{
          type: 'text' as const,
          text: `No significant traffic drops detected for ${siteUrl}.\n\nRecent: ${recentStart} to ${recentEnd}\nPrior: ${priorStart} to ${priorEnd}\nMinimum drop threshold: ${minClicksDrop} clicks${meta}`,
        }],
      };
    }

    // Count by diagnosis type
    const counts = { ranking_loss: 0, ctr_collapse: 0, demand_decline: 0, mixed: 0 };
    for (const d of topDrops) counts[d.diagnosis]++;

    const headers = ['Page', 'Diagnosis', 'Prev Clicks', 'Now Clicks', 'Change', 'Prev Pos', 'Now Pos', 'Prev CTR', 'Now CTR'];
    const rows = topDrops.map((d) => [
      d.page.length > 55 ? d.page.slice(0, 52) + '...' : d.page,
      d.diagnosis.replace('_', ' '),
      formatNumber(d.priorClicks),
      formatNumber(d.recentClicks),
      formatPercentChange(d.priorClicks, d.recentClicks),
      formatPosition(d.priorPosition),
      formatPosition(d.recentPosition),
      formatCTR(d.priorCTR),
      formatCTR(d.recentCTR),
    ]);

    const diagnosisDetails = topDrops
      .map((d) => `• ${d.page}\n  ${d.explanation}`)
      .join('\n\n');

    const meta = formatMeta('diagnose_traffic_drops', { siteUrl, recentStart, recentEnd, priorStart, priorEnd, minClicksDrop });

    const output = [
      `Traffic Drop Diagnosis for ${siteUrl}`,
      `Recent: ${recentStart} to ${recentEnd} | Prior: ${priorStart} to ${priorEnd}`,
      '',
      `Found ${topDrops.length} pages with significant traffic drops:`,
      `  Ranking loss: ${counts.ranking_loss} | CTR collapse: ${counts.ctr_collapse} | Demand decline: ${counts.demand_decline} | Mixed: ${counts.mixed}`,
      '',
      formatTable(headers, rows),
      '',
      '## Detailed Diagnosis',
      '',
      diagnosisDetails,
      meta,
    ].join('\n');

    return { content: [{ type: 'text' as const, text: output }] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text' as const, text: `Error diagnosing traffic drops: ${message}` }],
      isError: true,
    };
  }
}
