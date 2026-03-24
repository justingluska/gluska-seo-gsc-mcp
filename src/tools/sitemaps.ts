import { z } from 'zod';
import { GoogleSearchConsoleAPI } from '../api/search-console.js';
import { formatTable } from '../utils/formatting.js';

export const listSitemapsSchema = {
  siteUrl: z.string().describe('The site URL'),
};

export const submitSitemapSchema = {
  siteUrl: z.string().describe('The site URL'),
  sitemapUrl: z.string().url().describe('The full URL of the sitemap to submit'),
};

export const deleteSitemapSchema = {
  siteUrl: z.string().describe('The site URL'),
  sitemapUrl: z.string().url().describe('The full URL of the sitemap to delete'),
};

export async function handleListSitemaps(
  api: GoogleSearchConsoleAPI,
  args: { siteUrl: string },
) {
  try {
    const sitemaps = await api.listSitemaps(args.siteUrl);

    if (sitemaps.length === 0) {
      return {
        content: [{
          type: 'text' as const,
          text: `No sitemaps found for ${args.siteUrl}.\n\nYou can submit a sitemap using the submit_sitemap tool.`,
        }],
      };
    }

    const headers = ['Sitemap URL', 'Type', 'Status', 'Last Submitted', 'Errors', 'Warnings'];
    const rows = sitemaps.map((s) => [
      s.path || 'N/A',
      s.isSitemapsIndex ? 'Index' : s.type || 'Sitemap',
      s.isPending ? 'Pending' : 'Processed',
      s.lastSubmitted || 'N/A',
      s.errors || '0',
      s.warnings || '0',
    ]);

    // Content details
    const contentDetails: string[] = [];
    for (const s of sitemaps) {
      if (s.contents && s.contents.length > 0) {
        contentDetails.push(`\n${s.path}:`);
        for (const c of s.contents) {
          contentDetails.push(`  ${c.type || 'unknown'}: ${c.submitted || 0} submitted, ${c.indexed || 0} indexed`);
        }
      }
    }

    const output = [
      `Sitemaps for ${args.siteUrl}`,
      `Total: ${sitemaps.length} sitemap(s)`,
      '',
      formatTable(headers, rows),
    ];

    if (contentDetails.length > 0) {
      output.push('', '## Content Details', ...contentDetails);
    }

    return { content: [{ type: 'text' as const, text: output.join('\n') }] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text' as const, text: `Error listing sitemaps: ${message}` }],
      isError: true,
    };
  }
}

export async function handleSubmitSitemap(
  api: GoogleSearchConsoleAPI,
  args: { siteUrl: string; sitemapUrl: string },
) {
  try {
    await api.submitSitemap(args.siteUrl, args.sitemapUrl);
    return {
      content: [{
        type: 'text' as const,
        text: `Sitemap submitted successfully: ${args.sitemapUrl}\n\nGoogle will process the sitemap shortly. Use the list_sitemaps tool to check its status.`,
      }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{
        type: 'text' as const,
        text: `Error submitting sitemap: ${message}\n\nMake sure:\n- The sitemap URL is accessible and returns valid XML\n- The sitemap URL belongs to the specified site property`,
      }],
      isError: true,
    };
  }
}

export async function handleDeleteSitemap(
  api: GoogleSearchConsoleAPI,
  args: { siteUrl: string; sitemapUrl: string },
) {
  try {
    await api.deleteSitemap(args.siteUrl, args.sitemapUrl);
    return {
      content: [{
        type: 'text' as const,
        text: `Sitemap removed: ${args.sitemapUrl}\n\nThis only removes it from Search Console tracking — Google may still crawl URLs discovered from this sitemap.`,
      }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text' as const, text: `Error deleting sitemap: ${message}` }],
      isError: true,
    };
  }
}
