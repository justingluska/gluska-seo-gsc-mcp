import { describe, it, expect, vi } from 'vitest';
import { handleNotifyUrlUpdate, handleGetIndexingStatus } from '../../src/tools/indexing.js';
import { GoogleIndexingAPI } from '../../src/api/indexing.js';

function createMockIndexingApi(overrides: Partial<GoogleIndexingAPI> = {}): GoogleIndexingAPI {
  return {
    publishNotification: vi.fn(),
    getNotificationStatus: vi.fn(),
    getQuotaRemaining: vi.fn().mockReturnValue({ publish: 200, metadata: 600 }),
    ...overrides,
  } as unknown as GoogleIndexingAPI;
}

describe('handleNotifyUrlUpdate', () => {
  it('should confirm URL_UPDATED notification', async () => {
    const api = createMockIndexingApi({
      publishNotification: vi.fn().mockResolvedValue({
        urlNotificationMetadata: {
          url: 'https://example.com/page',
          latestUpdate: {
            url: 'https://example.com/page',
            type: 'URL_UPDATED',
            notifyTime: '2025-01-15T10:00:00Z',
          },
        },
      }),
    });

    const result = await handleNotifyUrlUpdate(api, {
      url: 'https://example.com/page',
      type: 'URL_UPDATED',
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('URL_UPDATED');
    expect(result.content[0].text).toContain('Quota remaining');
    expect(result.content[0].text).toContain('JobPosting');
  });

  it('should confirm URL_DELETED notification', async () => {
    const api = createMockIndexingApi({
      publishNotification: vi.fn().mockResolvedValue({
        urlNotificationMetadata: {
          latestRemove: {
            type: 'URL_DELETED',
            notifyTime: '2025-01-15T10:00:00Z',
          },
        },
      }),
    });

    const result = await handleNotifyUrlUpdate(api, {
      url: 'https://example.com/old-page',
      type: 'URL_DELETED',
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('URL_DELETED');
  });

  it('should handle quota errors', async () => {
    const api = createMockIndexingApi({
      publishNotification: vi.fn().mockRejectedValue(new Error('Quota exceeded')),
    });

    const result = await handleNotifyUrlUpdate(api, {
      url: 'https://example.com/page',
      type: 'URL_UPDATED',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Quota exceeded');
  });
});

describe('handleGetIndexingStatus', () => {
  it('should return notification status', async () => {
    const api = createMockIndexingApi({
      getNotificationStatus: vi.fn().mockResolvedValue({
        urlNotificationMetadata: {
          url: 'https://example.com/page',
          latestUpdate: {
            type: 'URL_UPDATED',
            notifyTime: '2025-01-15T10:00:00Z',
          },
        },
      }),
    });

    const result = await handleGetIndexingStatus(api, {
      url: 'https://example.com/page',
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('URL_UPDATED');
    expect(result.content[0].text).toContain('2025-01-15');
  });

  it('should handle no notifications found', async () => {
    const api = createMockIndexingApi({
      getNotificationStatus: vi.fn().mockResolvedValue({
        urlNotificationMetadata: {},
      }),
    });

    const result = await handleGetIndexingStatus(api, {
      url: 'https://example.com/unknown',
    });

    expect(result.content[0].text).toContain('No update notifications found');
  });
});
