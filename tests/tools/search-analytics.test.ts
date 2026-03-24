import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleSearchAnalytics } from '../../src/tools/search-analytics.js';
import { GoogleSearchConsoleAPI } from '../../src/api/search-console.js';

// Mock the API
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

describe('handleSearchAnalytics', () => {
  it('should return formatted results for a successful query', async () => {
    const api = createMockApi({
      querySearchAnalytics: vi.fn().mockResolvedValue({
        rows: [
          { keys: ['test query'], clicks: 100, impressions: 1000, ctr: 0.1, position: 5.5 },
          { keys: ['another query'], clicks: 50, impressions: 500, ctr: 0.1, position: 8.2 },
        ],
        responseAggregationType: 'auto',
      }),
    });

    const result = await handleSearchAnalytics(api, {
      siteUrl: 'https://example.com/',
      startDate: '2025-01-01',
      endDate: '2025-01-07',
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('Search Analytics for https://example.com/');
    expect(result.content[0].text).toContain('test query');
    expect(result.content[0].text).toContain('another query');
    expect(result.content[0].text).toContain('150'); // total clicks
    expect(result.content[0].text).toContain('2 rows');
  });

  it('should handle empty results with helpful message', async () => {
    const api = createMockApi({
      querySearchAnalytics: vi.fn().mockResolvedValue({ rows: [] }),
    });

    const result = await handleSearchAnalytics(api, {
      siteUrl: 'https://example.com/',
      startDate: '2025-01-01',
      endDate: '2025-01-07',
    });

    expect(result.content[0].text).toContain('No data found');
    expect(result.content[0].text).toContain('This could mean');
  });

  it('should reject invalid start date', async () => {
    const api = createMockApi();

    const result = await handleSearchAnalytics(api, {
      siteUrl: 'https://example.com/',
      startDate: 'not-a-date',
      endDate: '2025-01-07',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid start date');
  });

  it('should reject invalid end date', async () => {
    const api = createMockApi();

    const result = await handleSearchAnalytics(api, {
      siteUrl: 'https://example.com/',
      startDate: '2025-01-01',
      endDate: 'bad',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid end date');
  });

  it('should use default dates when not specified', async () => {
    const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
    const api = createMockApi({ querySearchAnalytics: mockQuery });

    await handleSearchAnalytics(api, { siteUrl: 'https://example.com/' });

    expect(mockQuery).toHaveBeenCalledOnce();
    const callArgs = mockQuery.mock.calls[0][0];
    expect(callArgs.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(callArgs.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should pass dimensions and filters correctly', async () => {
    const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
    const api = createMockApi({ querySearchAnalytics: mockQuery });

    await handleSearchAnalytics(api, {
      siteUrl: 'https://example.com/',
      startDate: '2025-01-01',
      endDate: '2025-01-07',
      dimensions: ['query', 'page'],
      searchType: 'discover',
      filters: [{ dimension: 'query', operator: 'contains', expression: 'test' }],
      rowLimit: 5000,
    });

    const callArgs = mockQuery.mock.calls[0][0];
    expect(callArgs.dimensions).toEqual(['query', 'page']);
    expect(callArgs.searchType).toBe('discover');
    expect(callArgs.dimensionFilterGroups).toEqual([
      { groupType: 'and', filters: [{ dimension: 'query', operator: 'contains', expression: 'test' }] },
    ]);
    expect(callArgs.rowLimit).toBe(5000);
  });

  it('should handle API errors with troubleshooting guidance', async () => {
    const api = createMockApi({
      querySearchAnalytics: vi.fn().mockRejectedValue(new Error('403 Forbidden')),
    });

    const result = await handleSearchAnalytics(api, {
      siteUrl: 'https://example.com/',
      startDate: '2025-01-01',
      endDate: '2025-01-07',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('403 Forbidden');
    expect(result.content[0].text).toContain('Troubleshooting');
  });
});
