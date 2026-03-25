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
  verifyClaimSchema,
  handleVerifyClaim,
  diagnoseTrafficDropsSchema,
  handleDiagnoseTrafficDrops,
  cannibalizationSchema,
  handleCannibalization,
  contentDecaySchema,
  handleContentDecay,
  ctrBenchmarksSchema,
  handleCTRBenchmarks,
  topicClustersSchema,
  handleTopicClusters,
} from './tools/index.js';

// Guardrail suffix appended to analytics tool descriptions to reduce hallucination.
const GUARDRAIL = ' IMPORTANT: Base your analysis only on the data returned by this tool. Report exact numbers from the response. Do not speculate about causes the data does not support. If the data is insufficient to answer, say so rather than guessing.';

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
      'Query Google Search Console performance data. Supports all dimensions (query, page, country, device, searchAppearance, date), all search types (web, discover, googleNews, news, image, video), regex filters, hourly data, and up to 25K rows per request.' + GUARDRAIL,
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
      'Compare search performance between two date ranges. Returns delta calculations for clicks, impressions, CTR, and position. Useful for tracking impact of SEO changes, algorithm updates, or seasonal trends.' + GUARDRAIL,
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
      'Automatically identify SEO opportunities: quick wins (position 5-20 with high impressions but low CTR), declining content (pages losing traffic), and emerging queries (new or rapidly growing). Compares recent 7-day window to 28 days prior.' + GUARDRAIL,
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
      'Inspect a single URL in Google Search Console. Returns index status, mobile usability, rich results, AMP status, canonical information, and last crawl time. Daily quota: 2,000 inspections.' + GUARDRAIL,
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
      'Inspect multiple URLs at once. Returns a summary of index status across all URLs with issues highlighted. Rate-limited to respect the 2,000/day quota. Max 100 URLs per call.' + GUARDRAIL,
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
      'List all sitemaps submitted for a site in Search Console. Shows status, submission date, error/warning counts, and content type details (URLs submitted vs indexed).' + GUARDRAIL,
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

  // --- Verify Claim (Anti-Hallucination) ---
  server.registerTool('verify_claim', {
    title: 'Verify Claim',
    description:
      'Self-check a claim about search performance data before presenting it. Re-queries the Google Search Console API to verify that a specific metric matches the expected value. Use this tool to confirm numbers before stating them in your analysis, especially for claims from earlier in the conversation.' + GUARDRAIL,
    inputSchema: verifyClaimSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  }, async (args) => {
    const { gsc } = await ensureApis();
    return handleVerifyClaim(gsc, args);
  });

  // --- Diagnose Traffic Drops ---
  server.registerTool('diagnose_traffic_drops', {
    title: 'Diagnose Traffic Drops',
    description:
      'Find pages that lost traffic and diagnose why. Categorizes each drop as: ranking loss (position got worse), CTR collapse (position held but CTR dropped — possible SERP feature changes), or demand decline (search impressions dropped — seasonality or trend shift). Compares recent 7-day window to 28 days prior.' + GUARDRAIL,
    inputSchema: diagnoseTrafficDropsSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  }, async (args) => {
    const { gsc } = await ensureApis();
    return handleDiagnoseTrafficDrops(gsc, args);
  });

  // --- Keyword Cannibalization ---
  server.registerTool('cannibalization', {
    title: 'Keyword Cannibalization',
    description:
      'Detect keyword cannibalization — queries where multiple pages from the same site compete against each other, splitting ranking potential. Shows which pages rank for the same keywords so you can consolidate or differentiate.' + GUARDRAIL,
    inputSchema: cannibalizationSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  }, async (args) => {
    const { gsc } = await ensureApis();
    return handleCannibalization(gsc, args);
  });

  // --- Content Decay ---
  server.registerTool('content_decay', {
    title: 'Content Decay',
    description:
      'Detect content decay — pages with 3 or more consecutive months of traffic decline. One bad month is noise; sustained decline is a pattern that needs attention. Surfaces pages that should be refreshed before they disappear from search results.' + GUARDRAIL,
    inputSchema: contentDecaySchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  }, async (args) => {
    const { gsc } = await ensureApis();
    return handleContentDecay(gsc, args);
  });

  // --- CTR Benchmarks ---
  server.registerTool('ctr_benchmarks', {
    title: 'CTR vs Benchmarks',
    description:
      'Compare your actual click-through rates against industry-average benchmarks by position. Identifies pages or queries with CTR below expected levels — candidates for title tag and meta description optimization. Benchmarks are aggregated from multiple studies and should be used as directional guidance.' + GUARDRAIL,
    inputSchema: ctrBenchmarksSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  }, async (args) => {
    const { gsc } = await ensureApis();
    return handleCTRBenchmarks(gsc, args);
  });

  // --- Topic Clusters ---
  server.registerTool('topic_clusters', {
    title: 'Topic Clusters',
    description:
      'Analyze performance of all pages under a URL path prefix (e.g., "/blog/", "/docs/seo/", "/products/"). Shows aggregate and per-page metrics plus the top queries driving traffic to the cluster. Useful for understanding how entire content sections perform.' + GUARDRAIL,
    inputSchema: topicClustersSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  }, async (args) => {
    const { gsc } = await ensureApis();
    return handleTopicClusters(gsc, args);
  });

  log.info(`Registered 17 tools`);

  return server;
}
