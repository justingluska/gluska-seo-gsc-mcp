import { google } from 'googleapis';
import { RateLimiter, DailyQuota } from '../utils/rate-limiter.js';
import { log } from '../utils/logger.js';
import type { AuthClient } from '../auth/client.js';

export interface UrlNotificationResponse {
  urlNotificationMetadata?: {
    url?: string;
    latestUpdate?: {
      url?: string;
      type?: string;
      notifyTime?: string;
    };
    latestRemove?: {
      url?: string;
      type?: string;
      notifyTime?: string;
    };
  };
}

/**
 * Wrapper around Google Indexing API with rate limiting.
 *
 * Note: The Indexing API is officially restricted to pages with
 * JobPosting or BroadcastEvent (in VideoObject) structured data.
 */
export class GoogleIndexingAPI {
  private publishLimiter = new RateLimiter(200);
  private metadataLimiter = new RateLimiter(600);
  private publishDailyQuota = new DailyQuota(200);
  private metadataDailyQuota = new DailyQuota(600);
  private auth: AuthClient;

  constructor(auth: AuthClient) {
    this.auth = auth;
  }

  /**
   * Notify Google that a URL has been updated or removed.
   */
  async publishNotification(
    url: string,
    type: 'URL_UPDATED' | 'URL_DELETED',
  ): Promise<UrlNotificationResponse> {
    await this.publishLimiter.acquire();

    if (!this.publishDailyQuota.canProceed()) {
      throw new Error(
        `Indexing API publish daily quota exceeded (200/day). ${this.publishDailyQuota.remaining()} remaining. Try again tomorrow.`,
      );
    }

    this.publishDailyQuota.consume();

    const indexing = google.indexing({ version: 'v3', auth: this.auth });

    const response = await indexing.urlNotifications.publish({
      requestBody: {
        url,
        type,
      },
    });

    log.info(`URL notification published: ${type} for ${url}`);
    return response.data as UrlNotificationResponse;
  }

  /**
   * Get notification status for a URL.
   */
  async getNotificationStatus(url: string): Promise<UrlNotificationResponse> {
    await this.metadataLimiter.acquire();

    if (!this.metadataDailyQuota.canProceed()) {
      throw new Error(
        `Indexing API metadata daily quota exceeded (600/day). ${this.metadataDailyQuota.remaining()} remaining. Try again tomorrow.`,
      );
    }

    this.metadataDailyQuota.consume();

    const indexing = google.indexing({ version: 'v3', auth: this.auth });

    const response = await indexing.urlNotifications.getMetadata({
      url,
    });

    return response.data as UrlNotificationResponse;
  }

  /**
   * Get remaining daily quotas.
   */
  getQuotaRemaining(): { publish: number; metadata: number } {
    return {
      publish: this.publishDailyQuota.remaining(),
      metadata: this.metadataDailyQuota.remaining(),
    };
  }
}
