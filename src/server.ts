import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { version } from './version.js';
import { createAuthClient, type AuthClient } from './auth/client.js';
import { GoogleSearchConsoleAPI } from './api/search-console.js';
import { GoogleIndexingAPI } from './api/indexing.js';
import { log } from './utils/logger.js';
import {
  searchAnalyticsSchema,
  handleSearchAnalytics,
  comparePeriodsSchema,
  handleComparePeriods,
  findOpportunitiesSchema,
  handleFindOpportunities,
  inspectUrlSchema,
  handleInspectUrl,
  batchInspectUrlsSchema,
  handleBatchInspectUrls,
  listSitemapsSchema,
  handleListSitemaps,
  submitSitemapSchema,
  handleSubmitSitemap,
  deleteSitemapSchema,
  handleDeleteSitemap,
  listPropertiesSchema,
  handleListProperties,
  notifyUrlUpdateSchema,
  handleNotifyUrlUpdate,
  getIndexingStatusSchema,
  handleGetIndexingStatus,
} from './tools/index.js';

let gscApi: GoogleSearchConsoleAPI | null = null;
let indexingApi: GoogleIndexingAPI | null = null;

async function ensureApis(): Promise<{ gsc: GoogleSearchConsoleAPI; indexing: GoogleIndexingAPI }> {
  if (gscApi && indexingApi) {
    return { gsc: gscApi, indexing: indexingApi };
  }

  const auth = await createAuthClient();
  gscApi = new GoogleSearchConsoleAPI(auth);
  indexingApi = new GoogleIndexingAPI(auth);

  return { gsc: gscApi, indexing: indexingApi };
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: 'google-search-console',
    version,
  });

  // --- Search Analytics ---
  server.registerTool('search_analytics', {
    title: 'Search Analytics',
    description:
      'Query Google Search Console performance data. Supports all dimensions (query, page, country, device, searchAppearance, date), all search types (web, discover, googleNews, news, image, video), regex filters, hourly data, and up to 25K rows per request.',
    inputSchema: searchAnalyticsSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  }, async (args) => {
    const { gsc } = await ensureApis();
    return handleSearchAnalytics(gsc, args);
  });

  // --- Compare Periods ---
  server.registerTool('compare_periods', {
    title: 'Compare Periods',
    description:
      'Compare search performance between two date ranges. Returns delta calculations for clicks, impressions, CTR, and position. Useful for tracking impact of SEO changes, algorithm updates, or seasonal trends.',
    inputSchema: comparePeriodsSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  }, async (args) => {
    const { gsc } = await ensureApis();
    return handleComparePeriods(gsc, args);
  });

  // --- Find Opportunities ---
  server.registerTool('find_opportunities', {
    title: 'Find SEO Opportunities',
    description:
      'Automatically identify SEO opportunities: quick wins (position 5-20 with high impressions but low CTR), declining content (pages losing traffic), and emerging queries (new or rapidly growing). Compares recent 7-day window to 28 days prior.',
    inputSchema: findOpportunitiesSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  }, async (args) => {
    const { gsc } = await ensureApis();
    return handleFindOpportunities(gsc, args);
  });

  // --- Inspect URL ---
  server.registerTool('inspect_url', {
    title: 'Inspect URL',
    description:
      'Inspect a single URL in Google Search Console. Returns index status, mobile usability, rich results, AMP status, canonical information, and last crawl time. Daily quota: 2,000 inspections.',
    inputSchema: inspectUrlSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  }, async (args) => {
    const { gsc } = await ensureApis();
    return handleInspectUrl(gsc, args);
  });

  // --- Batch Inspect URLs ---
  server.registerTool('batch_inspect_urls', {
    title: 'Batch Inspect URLs',
    description:
      'Inspect multiple URLs at once. Returns a summary of index status across all URLs with issues highlighted. Rate-limited to respect the 2,000/day quota. Max 100 URLs per call.',
    inputSchema: batchInspectUrlsSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  }, async (args) => {
    const { gsc } = await ensureApis();
    return handleBatchInspectUrls(gsc, args);
  });

  // --- List Sitemaps ---
  server.registerTool('list_sitemaps', {
    title: 'List Sitemaps',
    description:
      'List all sitemaps submitted for a site in Search Console. Shows status, submission date, error/warning counts, and content type details (URLs submitted vs indexed).',
    inputSchema: listSitemapsSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  }, async (args) => {
    const { gsc } = await ensureApis();
    return handleListSitemaps(gsc, args);
  });

  // --- Submit Sitemap ---
  server.registerTool('submit_sitemap', {
    title: 'Submit Sitemap',
    description:
      'Submit a new sitemap to Google Search Console. The sitemap URL must be accessible and return valid XML.',
    inputSchema: submitSitemapSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  }, async (args) => {
    const { gsc } = await ensureApis();
    return handleSubmitSitemap(gsc, args);
  });

  // --- Delete Sitemap ---
  server.registerTool('delete_sitemap', {
    title: 'Delete Sitemap',
    description:
      'Remove a sitemap from Search Console tracking. This does not prevent Google from crawling URLs discovered from this sitemap.',
    inputSchema: deleteSitemapSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
    },
  }, async (args) => {
    const { gsc } = await ensureApis();
    return handleDeleteSitemap(gsc, args);
  });

  // --- List Properties ---
  server.registerTool('list_properties', {
    title: 'List Properties',
    description:
      'List all Google Search Console properties accessible to the authenticated account. Shows property type (domain vs URL prefix) and permission level.',
    inputSchema: listPropertiesSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  }, async () => {
    const { gsc } = await ensureApis();
    return handleListProperties(gsc);
  });

  // --- Notify URL Update (Indexing API) ---
  server.registerTool('notify_url_update', {
    title: 'Notify URL Update',
    description:
      'Submit a URL update or deletion notification to Google via the Indexing API. Note: Officially supported only for pages with JobPosting or BroadcastEvent structured data. Daily quota: 200 notifications.',
    inputSchema: notifyUrlUpdateSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
    },
  }, async (args) => {
    const { indexing } = await ensureApis();
    return handleNotifyUrlUpdate(indexing, args);
  });

  // --- Get Indexing Status ---
  server.registerTool('get_indexing_status', {
    title: 'Get Indexing Notification Status',
    description:
      'Check the status of Indexing API notifications for a URL. Shows the most recent update and removal notifications.',
    inputSchema: getIndexingStatusSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  }, async (args) => {
    const { indexing } = await ensureApis();
    return handleGetIndexingStatus(indexing, args);
  });

  log.info(`Registered 11 tools`);

  return server;
}
