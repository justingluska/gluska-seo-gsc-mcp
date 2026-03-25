export { searchAnalyticsSchema, handleSearchAnalytics } from './search-analytics.js';
export { comparePeriodsSchema, handleComparePeriods } from './compare-periods.js';
export { findOpportunitiesSchema, handleFindOpportunities } from './find-opportunities.js';
export {
  inspectUrlSchema,
  batchInspectUrlsSchema,
  handleInspectUrl,
  handleBatchInspectUrls,
} from './inspect-url.js';
export {
  listSitemapsSchema,
  submitSitemapSchema,
  deleteSitemapSchema,
  handleListSitemaps,
  handleSubmitSitemap,
  handleDeleteSitemap,
} from './sitemaps.js';
export { listPropertiesSchema, handleListProperties } from './properties.js';
export {
  notifyUrlUpdateSchema,
  getIndexingStatusSchema,
  handleNotifyUrlUpdate,
  handleGetIndexingStatus,
} from './indexing.js';
export { verifyClaimSchema, handleVerifyClaim } from './verify-claim.js';
export { diagnoseTrafficDropsSchema, handleDiagnoseTrafficDrops } from './traffic-drops.js';
export { cannibalizationSchema, handleCannibalization } from './cannibalization.js';
export { contentDecaySchema, handleContentDecay } from './content-decay.js';
export { ctrBenchmarksSchema, handleCTRBenchmarks } from './ctr-benchmarks.js';
export { topicClustersSchema, handleTopicClusters } from './topic-clusters.js';
