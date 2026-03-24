import { describe, it, expect, vi } from 'vitest';
import { handleInspectUrl, handleBatchInspectUrls } from '../../src/tools/inspect-url.js';
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

describe('handleInspectUrl', () => {
  it('should return formatted inspection results', async () => {
    const api = createMockApi({
      inspectUrl: vi.fn().mockResolvedValue({
        indexStatusResult: {
          verdict: 'PASS',
          coverageState: 'Submitted and indexed',
          robotsTxtState: 'ALLOWED',
          indexingState: 'INDEXING_ALLOWED',
          lastCrawlTime: '2025-01-15T10:00:00Z',
          pageFetchState: 'SUCCESSFUL',
          googleCanonical: 'https://example.com/page',
          userCanonical: 'https://example.com/page',
          crawledAs: 'DESKTOP',
        },
        mobileUsabilityResult: {
          verdict: 'PASS',
          issues: [],
        },
        inspectionResultLink: 'https://search.google.com/search-console/inspect?...',
      }),
    });

    const result = await handleInspectUrl(api, {
      url: 'https://example.com/page',
      siteUrl: 'https://example.com/',
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('PASS');
    expect(result.content[0].text).toContain('Submitted and indexed');
    expect(result.content[0].text).toContain('ALLOWED');
    expect(result.content[0].text).toContain('DESKTOP');
  });

  it('should detect canonical mismatch', async () => {
    const api = createMockApi({
      inspectUrl: vi.fn().mockResolvedValue({
        indexStatusResult: {
          verdict: 'NEUTRAL',
          googleCanonical: 'https://example.com/canonical',
          userCanonical: 'https://example.com/page',
        },
      }),
    });

    const result = await handleInspectUrl(api, {
      url: 'https://example.com/page',
      siteUrl: 'https://example.com/',
    });

    expect(result.content[0].text).toContain('Canonical mismatch');
  });

  it('should handle API errors with quota info', async () => {
    const api = createMockApi({
      inspectUrl: vi.fn().mockRejectedValue(new Error('403 Forbidden')),
      getInspectionQuotaRemaining: vi.fn().mockReturnValue(1500),
    });

    const result = await handleInspectUrl(api, {
      url: 'https://example.com/page',
      siteUrl: 'https://example.com/',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('403 Forbidden');
    expect(result.content[0].text).toContain('1500');
  });
});

describe('handleBatchInspectUrls', () => {
  it('should inspect multiple URLs and summarize', async () => {
    const api = createMockApi({
      inspectUrl: vi
        .fn()
        .mockResolvedValueOnce({
          indexStatusResult: { verdict: 'PASS', coverageState: 'Indexed', indexingState: 'INDEXING_ALLOWED', lastCrawlTime: '2025-01-15' },
        })
        .mockResolvedValueOnce({
          indexStatusResult: { verdict: 'FAIL', coverageState: 'Not indexed', indexingState: 'BLOCKED_BY_ROBOTS_TXT', lastCrawlTime: '2025-01-10' },
        }),
      getInspectionQuotaRemaining: vi.fn().mockReturnValue(1998),
    });

    const result = await handleBatchInspectUrls(api, {
      urls: ['https://example.com/page1', 'https://example.com/page2'],
      siteUrl: 'https://example.com/',
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('Inspected: 2/2');
    expect(result.content[0].text).toContain('PASS: 1');
    expect(result.content[0].text).toContain('FAIL: 1');
  });

  it('should reject if quota insufficient', async () => {
    const api = createMockApi({
      getInspectionQuotaRemaining: vi.fn().mockReturnValue(1),
    });

    const result = await handleBatchInspectUrls(api, {
      urls: ['https://example.com/1', 'https://example.com/2', 'https://example.com/3'],
      siteUrl: 'https://example.com/',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Cannot inspect 3 URLs');
    expect(result.content[0].text).toContain('1 daily inspections remaining');
  });

  it('should handle partial failures gracefully', async () => {
    const api = createMockApi({
      inspectUrl: vi
        .fn()
        .mockResolvedValueOnce({
          indexStatusResult: { verdict: 'PASS' },
        })
        .mockRejectedValueOnce(new Error('Timeout')),
      getInspectionQuotaRemaining: vi.fn().mockReturnValue(2000),
    });

    const result = await handleBatchInspectUrls(api, {
      urls: ['https://example.com/good', 'https://example.com/bad'],
      siteUrl: 'https://example.com/',
    });

    expect(result.content[0].text).toContain('Inspected: 1/2');
    expect(result.content[0].text).toContain('Errors: 1');
    expect(result.content[0].text).toContain('Timeout');
  });
});
