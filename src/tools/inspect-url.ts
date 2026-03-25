import { z } from 'zod';
import { GoogleSearchConsoleAPI } from '../api/search-console.js';
import { resolveSiteUrl } from '../utils/site-url.js';
import { formatMeta } from '../utils/meta.js';

export const inspectUrlSchema = {
  url: z.string().url().describe('The URL to inspect'),
  siteUrl: z.string().optional().describe('The site URL that contains this page. Falls back to GSC_DEFAULT_SITE_URL if not provided.'),
  languageCode: z.string().optional().describe('Language code for results (e.g., "en-US")'),
};

export const batchInspectUrlsSchema = {
  urls: z.array(z.string().url()).min(1).max(100).describe('URLs to inspect (max 100)'),
  siteUrl: z.string().optional().describe('The site URL that contains these pages. Falls back to GSC_DEFAULT_SITE_URL if not provided.'),
};

export async function handleInspectUrl(
  api: GoogleSearchConsoleAPI,
  args: { url: string; siteUrl?: string; languageCode?: string },
) {
  const siteUrl = resolveSiteUrl(args.siteUrl);
  if (!siteUrl) {
    return { content: [{ type: 'text' as const, text: 'No site URL provided. Either pass siteUrl or set the GSC_DEFAULT_SITE_URL environment variable.' }], isError: true };
  }

  try {
    const result = await api.inspectUrl(args.url, siteUrl, args.languageCode);
    const idx = result.indexStatusResult;
    const mobile = result.mobileUsabilityResult;
    const rich = result.richResultsResult;
    const amp = result.ampResult;

    const sections: string[] = [`URL Inspection: ${args.url}`, ''];

    // Index Status
    sections.push('## Index Status');
    if (idx) {
      sections.push(`Verdict: ${idx.verdict || 'UNKNOWN'}`);
      sections.push(`Coverage: ${idx.coverageState || 'N/A'}`);
      sections.push(`Indexing: ${idx.indexingState || 'N/A'}`);
      sections.push(`Robots.txt: ${idx.robotsTxtState || 'N/A'}`);
      sections.push(`Page fetch: ${idx.pageFetchState || 'N/A'}`);
      sections.push(`Last crawl: ${idx.lastCrawlTime || 'Never'}`);
      sections.push(`Crawled as: ${idx.crawledAs || 'N/A'}`);
      if (idx.googleCanonical) sections.push(`Google canonical: ${idx.googleCanonical}`);
      if (idx.userCanonical) sections.push(`User canonical: ${idx.userCanonical}`);
      if (idx.googleCanonical && idx.userCanonical && idx.googleCanonical !== idx.userCanonical) {
        sections.push(`⚠ Canonical mismatch — Google chose a different canonical than declared`);
      }
      if (idx.sitemap && idx.sitemap.length > 0) sections.push(`Sitemaps: ${idx.sitemap.join(', ')}`);
      if (idx.referringUrls && idx.referringUrls.length > 0) {
        sections.push(`Referring URLs: ${idx.referringUrls.slice(0, 5).join(', ')}${idx.referringUrls.length > 5 ? ` (+${idx.referringUrls.length - 5} more)` : ''}`);
      }
    } else {
      sections.push('No index status data available');
    }

    // Mobile Usability
    if (mobile) {
      sections.push('', '## Mobile Usability');
      sections.push(`Verdict: ${mobile.verdict || 'UNKNOWN'}`);
      if (mobile.issues && mobile.issues.length > 0) {
        sections.push('Issues:');
        for (const issue of mobile.issues) {
          sections.push(`  - ${issue.issueType}: ${issue.message || ''} (${issue.severity || 'unknown'})`);
        }
      }
    }

    // Rich Results
    if (rich) {
      sections.push('', '## Rich Results');
      sections.push(`Verdict: ${rich.verdict || 'UNKNOWN'}`);
      if (rich.detectedItems && rich.detectedItems.length > 0) {
        for (const item of rich.detectedItems) {
          sections.push(`  Type: ${item.richResultType || 'Unknown'}`);
          if (item.items) {
            for (const sub of item.items) {
              if (sub.issues && sub.issues.length > 0) {
                for (const issue of sub.issues) {
                  sections.push(`    - ${issue.issueMessage || 'Unknown issue'} (${issue.severity || ''})`);
                }
              }
            }
          }
        }
      }
    }

    // AMP
    if (amp) {
      sections.push('', '## AMP');
      sections.push(`Verdict: ${amp.verdict || 'UNKNOWN'}`);
      if (amp.issues && amp.issues.length > 0) {
        for (const issue of amp.issues) {
          sections.push(`  - ${issue.issueType}: ${issue.issueMessage || ''} (${issue.severity || ''})`);
        }
      }
    }

    if (result.inspectionResultLink) {
      sections.push('', `View in Search Console: ${result.inspectionResultLink}`);
    }

    sections.push(formatMeta('inspect_url', { url: args.url, siteUrl }));

    return { content: [{ type: 'text' as const, text: sections.join('\n') }] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{
        type: 'text' as const,
        text: `Error inspecting URL: ${message}\n\nTroubleshooting:\n- Ensure the URL belongs to the specified site property\n- The URL must be fully qualified (include protocol)\n- Daily inspection quota: ${api.getInspectionQuotaRemaining()} remaining`,
      }],
      isError: true,
    };
  }
}

export async function handleBatchInspectUrls(
  api: GoogleSearchConsoleAPI,
  args: { urls: string[]; siteUrl?: string },
) {
  const siteUrl = resolveSiteUrl(args.siteUrl);
  if (!siteUrl) {
    return { content: [{ type: 'text' as const, text: 'No site URL provided. Either pass siteUrl or set the GSC_DEFAULT_SITE_URL environment variable.' }], isError: true };
  }

  const quotaRemaining = api.getInspectionQuotaRemaining();
  if (args.urls.length > quotaRemaining) {
    return {
      content: [{
        type: 'text' as const,
        text: `Cannot inspect ${args.urls.length} URLs — only ${quotaRemaining} daily inspections remaining. Reduce the number of URLs or try again tomorrow.`,
      }],
      isError: true,
    };
  }

  const results: Array<{ url: string; status: string; details: string }> = [];
  const errors: Array<{ url: string; error: string }> = [];

  for (const url of args.urls) {
    try {
      const result = await api.inspectUrl(url, siteUrl);
      const idx = result.indexStatusResult;
      results.push({
        url,
        status: idx?.verdict || 'UNKNOWN',
        details: [
          `coverage=${idx?.coverageState || 'N/A'}`,
          `indexing=${idx?.indexingState || 'N/A'}`,
          `crawled=${idx?.lastCrawlTime || 'never'}`,
          idx?.googleCanonical && idx?.userCanonical && idx.googleCanonical !== idx.userCanonical
            ? 'CANONICAL_MISMATCH'
            : '',
        ]
          .filter(Boolean)
          .join(', '),
      });
    } catch (error) {
      errors.push({
        url,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const sections: string[] = [
    `Batch URL Inspection for ${siteUrl}`,
    `Inspected: ${results.length}/${args.urls.length} | Errors: ${errors.length}`,
    `Quota remaining: ${api.getInspectionQuotaRemaining()}/day`,
    '',
  ];

  // Summary counts
  const verdictCounts = new Map<string, number>();
  for (const r of results) {
    verdictCounts.set(r.status, (verdictCounts.get(r.status) || 0) + 1);
  }
  sections.push('## Summary');
  for (const [verdict, count] of verdictCounts.entries()) {
    sections.push(`  ${verdict}: ${count}`);
  }
  sections.push('');

  // Issues (non-PASS results)
  const issues = results.filter((r) => r.status !== 'PASS');
  if (issues.length > 0) {
    sections.push('## URLs With Issues');
    for (const r of issues) {
      sections.push(`  ${r.status} | ${r.url}`);
      sections.push(`    ${r.details}`);
    }
    sections.push('');
  }

  if (errors.length > 0) {
    sections.push('## Inspection Errors');
    for (const e of errors) {
      sections.push(`  ${e.url}: ${e.error}`);
    }
  }

  sections.push(formatMeta('batch_inspect_urls', { siteUrl, urlCount: args.urls.length }));

  return { content: [{ type: 'text' as const, text: sections.join('\n') }] };
}
