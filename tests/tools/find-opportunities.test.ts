import { describe, it, expect, vi } from 'vitest';
import { handleFindOpportunities } from '../../src/tools/find-opportunities.js';
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

describe('handleFindOpportunities', () => {
  it('should identify quick wins', async () => {
    const api = createMockApi({
      querySearchAnalytics: vi
        .fn()
        .mockResolvedValueOnce({
          // Recent data
          rows: [
            { keys: ['quick win query', '/page1'], clicks: 5, impressions: 500, ctr: 0.01, position: 8 },
            { keys: ['good query', '/page2'], clicks: 100, impressions: 200, ctr: 0.5, position: 2 },
          ],
        })
        .mockResolvedValueOnce({
          // Prior data
          rows: [
            { keys: ['quick win query', '/page1'], clicks: 3, impressions: 400, ctr: 0.0075, position: 9 },
            { keys: ['good query', '/page2'], clicks: 90, impressions: 180, ctr: 0.5, position: 2 },
          ],
        }),
    });

    const result = await handleFindOpportunities(api, {
      siteUrl: 'https://example.com/',
      type: 'quick_wins',
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('Quick Wins');
    expect(result.content[0].text).toContain('quick win query');
    // good query should NOT appear (high CTR, low position)
  });

  it('should identify declining content', async () => {
    const api = createMockApi({
      querySearchAnalytics: vi
        .fn()
        .mockResolvedValueOnce({
          rows: [
            { keys: ['declining query', '/page1'], clicks: 10, impressions: 100, ctr: 0.1, position: 15 },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            { keys: ['declining query', '/page1'], clicks: 100, impressions: 1000, ctr: 0.1, position: 5 },
          ],
        }),
    });

    const result = await handleFindOpportunities(api, {
      siteUrl: 'https://example.com/',
      type: 'declining',
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('Declining Content');
    expect(result.content[0].text).toContain('declining query');
  });

  it('should identify emerging queries', async () => {
    const api = createMockApi({
      querySearchAnalytics: vi
        .fn()
        .mockResolvedValueOnce({
          rows: [
            { keys: ['brand new query', '/page1'], clicks: 50, impressions: 500, ctr: 0.1, position: 3 },
          ],
        })
        .mockResolvedValueOnce({
          rows: [], // Query didn't exist before
        }),
    });

    const result = await handleFindOpportunities(api, {
      siteUrl: 'https://example.com/',
      type: 'emerging',
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('Emerging Queries');
    expect(result.content[0].text).toContain('brand new query');
  });

  it('should show all opportunity types when type is "all"', async () => {
    const api = createMockApi({
      querySearchAnalytics: vi.fn().mockResolvedValue({ rows: [] }),
    });

    const result = await handleFindOpportunities(api, {
      siteUrl: 'https://example.com/',
      type: 'all',
    });

    expect(result.content[0].text).toContain('Quick Wins');
    expect(result.content[0].text).toContain('Declining Content');
    expect(result.content[0].text).toContain('Emerging Queries');
  });

  it('should handle API errors', async () => {
    const api = createMockApi({
      querySearchAnalytics: vi.fn().mockRejectedValue(new Error('Quota exceeded')),
    });

    const result = await handleFindOpportunities(api, {
      siteUrl: 'https://example.com/',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Quota exceeded');
  });
});
