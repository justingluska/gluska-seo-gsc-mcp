import { google, searchconsole_v1 } from 'googleapis';
import { RateLimiter, DailyQuota } from '../utils/rate-limiter.js';
import { log } from '../utils/logger.js';
import type { AuthClient } from '../auth/client.js';

type SearchConsole = searchconsole_v1.Searchconsole;

export interface SearchAnalyticsQuery {
  siteUrl: string;
  startDate: string;
  endDate: string;
  dimensions?: string[];
  searchType?: string;
  dataState?: string;
  dimensionFilterGroups?: Array<{
    groupType?: string;
    filters: Array<{
      dimension: string;
      operator: string;
      expression: string;
    }>;
  }>;
  rowLimit?: number;
  startRow?: number;
  aggregationType?: string;
}

export interface SearchAnalyticsRow {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
}

export interface SearchAnalyticsResponse {
  rows: SearchAnalyticsRow[];
  responseAggregationType?: string;
}

export interface InspectionResult {
  inspectionResultLink?: string;
  indexStatusResult?: {
    verdict?: string;
    coverageState?: string;
    robotsTxtState?: string;
    indexingState?: string;
    lastCrawlTime?: string;
    pageFetchState?: string;
    googleCanonical?: string;
    userCanonical?: string;
    crawledAs?: string;
    sitemap?: string[];
    referringUrls?: string[];
  };
  mobileUsabilityResult?: {
    verdict?: string;
    issues?: Array<{ issueType?: string; severity?: string; message?: string }>;
  };
  richResultsResult?: {
    verdict?: string;
    detectedItems?: Array<{
      richResultType?: string;
      items?: Array<{ name?: string; issues?: Array<{ issueMessage?: string; severity?: string }> }>;
    }>;
  };
  ampResult?: {
    verdict?: string;
    issues?: Array<{ issueType?: string; severity?: string; issueMessage?: string }>;
  };
}

export interface SitemapInfo {
  path?: string;
  lastSubmitted?: string;
  isPending?: boolean;
  isSitemapsIndex?: boolean;
  type?: string;
  lastDownloaded?: string;
  warnings?: string;
  errors?: string;
  contents?: Array<{
    type?: string;
    submitted?: string;
    indexed?: string;
  }>;
}

export interface SiteInfo {
  siteUrl?: string;
  permissionLevel?: string;
}

/**
 * Wrapper around Google Search Console API with rate limiting and response curation.
 */
export class GoogleSearchConsoleAPI {
  private searchConsole: SearchConsole;
  private analyticsLimiter = new RateLimiter(1200);
  private inspectionLimiter = new RateLimiter(600);
  private generalLimiter = new RateLimiter(200);
  private inspectionDailyQuota = new DailyQuota(2000);

  constructor(auth: AuthClient) {
    this.searchConsole = google.searchconsole({ version: 'v1', auth });
  }

  /**
   * Query search analytics data.
   */
  async querySearchAnalytics(query: SearchAnalyticsQuery): Promise<SearchAnalyticsResponse> {
    await this.analyticsLimiter.acquire();

    log.debug('Querying search analytics', {
      siteUrl: query.siteUrl,
      startDate: query.startDate,
      endDate: query.endDate,
      dimensions: query.dimensions,
    });

    const response = await this.searchConsole.searchanalytics.query({
      siteUrl: query.siteUrl,
      requestBody: {
        startDate: query.startDate,
        endDate: query.endDate,
        dimensions: query.dimensions,
        type: query.searchType,
        dataState: query.dataState,
        dimensionFilterGroups: query.dimensionFilterGroups,
        rowLimit: query.rowLimit || 1000,
        startRow: query.startRow || 0,
        aggregationType: query.aggregationType,
      },
    });

    return {
      rows: (response.data.rows as SearchAnalyticsRow[]) || [],
      responseAggregationType: response.data.responseAggregationType || undefined,
    };
  }

  /**
   * Inspect a URL's index status.
   */
  async inspectUrl(
    inspectionUrl: string,
    siteUrl: string,
    languageCode?: string,
  ): Promise<InspectionResult> {
    await this.inspectionLimiter.acquire();

    if (!this.inspectionDailyQuota.canProceed()) {
      throw new Error(
        `URL Inspection daily quota exceeded (2,000/day). ${this.inspectionDailyQuota.remaining()} remaining. Try again tomorrow.`,
      );
    }

    this.inspectionDailyQuota.consume();

    const response = await this.searchConsole.urlInspection.index.inspect({
      requestBody: {
        inspectionUrl,
        siteUrl,
        languageCode,
      },
    });

    return (response.data.inspectionResult as InspectionResult) || {};
  }

  /**
   * List all sitemaps for a site.
   */
  async listSitemaps(siteUrl: string): Promise<SitemapInfo[]> {
    await this.generalLimiter.acquire();

    const response = await this.searchConsole.sitemaps.list({ siteUrl });
    return (response.data.sitemap as SitemapInfo[]) || [];
  }

  /**
   * Get details for a specific sitemap.
   */
  async getSitemap(siteUrl: string, feedpath: string): Promise<SitemapInfo> {
    await this.generalLimiter.acquire();

    const response = await this.searchConsole.sitemaps.get({ siteUrl, feedpath });
    return response.data as SitemapInfo;
  }

  /**
   * Submit a sitemap.
   */
  async submitSitemap(siteUrl: string, feedpath: string): Promise<void> {
    await this.generalLimiter.acquire();

    await this.searchConsole.sitemaps.submit({ siteUrl, feedpath });
    log.info(`Sitemap submitted: ${feedpath}`);
  }

  /**
   * Delete a sitemap.
   */
  async deleteSitemap(siteUrl: string, feedpath: string): Promise<void> {
    await this.generalLimiter.acquire();

    await this.searchConsole.sitemaps.delete({ siteUrl, feedpath });
    log.info(`Sitemap deleted: ${feedpath}`);
  }

  /**
   * List all sites/properties the user has access to.
   */
  async listSites(): Promise<SiteInfo[]> {
    await this.generalLimiter.acquire();

    const response = await this.searchConsole.sites.list();
    return (response.data.siteEntry as SiteInfo[]) || [];
  }

  /**
   * Get details for a specific site.
   */
  async getSite(siteUrl: string): Promise<SiteInfo> {
    await this.generalLimiter.acquire();

    const response = await this.searchConsole.sites.get({ siteUrl });
    return response.data as SiteInfo;
  }

  /**
   * Get remaining daily quota for URL inspection.
   */
  getInspectionQuotaRemaining(): number {
    return this.inspectionDailyQuota.remaining();
  }
}
