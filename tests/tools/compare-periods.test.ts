import { describe, it, expect, vi } from 'vitest';
import { handleComparePeriods } from '../../src/tools/compare-periods.js';
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

describe('handleComparePeriods', () => {
  it('should compute deltas between two periods', async () => {
    const api = createMockApi({
      querySearchAnalytics: vi
        .fn()
        .mockResolvedValueOnce({
          rows: [
            { keys: ['query a'], clicks: 100, impressions: 1000, ctr: 0.1, position: 5 },
            { keys: ['query b'], clicks: 50, impressions: 500, ctr: 0.1, position: 10 },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            { keys: ['query a'], clicks: 150, impressions: 1200, ctr: 0.125, position: 4 },
            { keys: ['query b'], clicks: 30, impressions: 400, ctr: 0.075, position: 12 },
          ],
        }),
    });

    const result = await handleComparePeriods(api, {
      siteUrl: 'https://example.com/',
      period1StartDate: '2025-01-01',
      period1EndDate: '2025-01-07',
      period2StartDate: '2025-01-08',
      period2EndDate: '2025-01-14',
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('Period Comparison');
    expect(result.content[0].text).toContain('query a');
    expect(result.content[0].text).toContain('query b');
    // Should show overall totals
    expect(result.content[0].text).toContain('Overall');
  });

  it('should handle queries that appear in only one period', async () => {
    const api = createMockApi({
      querySearchAnalytics: vi
        .fn()
        .mockResolvedValueOnce({
          rows: [{ keys: ['old query'], clicks: 100, impressions: 1000, ctr: 0.1, position: 5 }],
        })
        .mockResolvedValueOnce({
          rows: [{ keys: ['new query'], clicks: 50, impressions: 500, ctr: 0.1, position: 8 }],
        }),
    });

    const result = await handleComparePeriods(api, {
      siteUrl: 'https://example.com/',
      period1StartDate: '2025-01-01',
      period1EndDate: '2025-01-07',
      period2StartDate: '2025-01-08',
      period2EndDate: '2025-01-14',
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('old query');
    expect(result.content[0].text).toContain('new query');
  });

  it('should reject invalid dates', async () => {
    const api = createMockApi();

    const result = await handleComparePeriods(api, {
      siteUrl: 'https://example.com/',
      period1StartDate: 'bad-date',
      period1EndDate: '2025-01-07',
      period2StartDate: '2025-01-08',
      period2EndDate: '2025-01-14',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid date');
  });

  it('should handle API errors', async () => {
    const api = createMockApi({
      querySearchAnalytics: vi.fn().mockRejectedValue(new Error('Network error')),
    });

    const result = await handleComparePeriods(api, {
      siteUrl: 'https://example.com/',
      period1StartDate: '2025-01-01',
      period1EndDate: '2025-01-07',
      period2StartDate: '2025-01-08',
      period2EndDate: '2025-01-14',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Network error');
  });
});
