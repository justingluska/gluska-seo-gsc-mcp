import { describe, it, expect, vi } from 'vitest';
import { handleListProperties } from '../../src/tools/properties.js';
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

describe('handleListProperties', () => {
  it('should list properties with type detection', async () => {
    const api = createMockApi({
      listSites: vi.fn().mockResolvedValue([
        { siteUrl: 'https://example.com/', permissionLevel: 'siteOwner' },
        { siteUrl: 'sc-domain:example.org', permissionLevel: 'siteFullUser' },
      ]),
    });

    const result = await handleListProperties(api);

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('2 property');
    expect(result.content[0].text).toContain('https://example.com/');
    expect(result.content[0].text).toContain('URL Prefix');
    expect(result.content[0].text).toContain('sc-domain:example.org');
    expect(result.content[0].text).toContain('Domain');
    expect(result.content[0].text).toContain('siteOwner');
  });

  it('should handle no properties', async () => {
    const api = createMockApi({
      listSites: vi.fn().mockResolvedValue([]),
    });

    const result = await handleListProperties(api);
    expect(result.content[0].text).toContain('No Search Console properties found');
  });

  it('should handle API errors', async () => {
    const api = createMockApi({
      listSites: vi.fn().mockRejectedValue(new Error('Auth failed')),
    });

    const result = await handleListProperties(api);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Auth failed');
  });
});
