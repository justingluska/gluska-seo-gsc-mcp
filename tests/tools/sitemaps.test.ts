import { describe, it, expect, vi } from 'vitest';
import { handleListSitemaps, handleSubmitSitemap, handleDeleteSitemap } from '../../src/tools/sitemaps.js';
import { GoogleSearchConsoleAPI } from '../../src/api/search-console.js';

function createMockApi(overrides: Partial<GoogleSearchConsoleAPI> = {}): GoogleSearchConsoleAPI {
  return {
    querySearchAnalytics: vi.fn(),
    inspectUrl: vi.fn(),
    listSitemaps: vi.fn(),
    getSitemap: vi.fn(),
    submitSitemap: vi.fn(),
    deleteSitemap: vi.fn(),
    listSites: vi.fn(),
    getSite: vi.fn(),
    getInspectionQuotaRemaining: vi.fn().mockReturnValue(2000),
    ...overrides,
  } as unknown as GoogleSearchConsoleAPI;
}

describe('handleListSitemaps', () => {
  it('should list sitemaps with details', async () => {
    const api = createMockApi({
      listSitemaps: vi.fn().mockResolvedValue([
        {
          path: 'https://example.com/sitemap.xml',
          type: 'sitemap',
          isPending: false,
          isSitemapsIndex: false,
          lastSubmitted: '2025-01-15',
          errors: '0',
          warnings: '2',
          contents: [{ type: 'web', submitted: '1000', indexed: '950' }],
        },
      ]),
    });

    const result = await handleListSitemaps(api, { siteUrl: 'https://example.com/' });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('sitemap.xml');
    expect(result.content[0].text).toContain('1 sitemap');
    expect(result.content[0].text).toContain('1000 submitted');
    expect(result.content[0].text).toContain('950 indexed');
  });

  it('should handle empty sitemaps', async () => {
    const api = createMockApi({
      listSitemaps: vi.fn().mockResolvedValue([]),
    });

    const result = await handleListSitemaps(api, { siteUrl: 'https://example.com/' });
    expect(result.content[0].text).toContain('No sitemaps found');
  });
});

describe('handleSubmitSitemap', () => {
  it('should confirm successful submission', async () => {
    const api = createMockApi({
      submitSitemap: vi.fn().mockResolvedValue(undefined),
    });

    const result = await handleSubmitSitemap(api, {
      siteUrl: 'https://example.com/',
      sitemapUrl: 'https://example.com/sitemap.xml',
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('submitted successfully');
  });

  it('should handle submission errors', async () => {
    const api = createMockApi({
      submitSitemap: vi.fn().mockRejectedValue(new Error('Invalid sitemap')),
    });

    const result = await handleSubmitSitemap(api, {
      siteUrl: 'https://example.com/',
      sitemapUrl: 'https://example.com/bad-sitemap.xml',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid sitemap');
  });
});

describe('handleDeleteSitemap', () => {
  it('should confirm successful deletion', async () => {
    const api = createMockApi({
      deleteSitemap: vi.fn().mockResolvedValue(undefined),
    });

    const result = await handleDeleteSitemap(api, {
      siteUrl: 'https://example.com/',
      sitemapUrl: 'https://example.com/old-sitemap.xml',
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('Sitemap removed');
  });
});
