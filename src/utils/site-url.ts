/**
 * Resolves the site URL, using the default if not explicitly provided.
 */
export function resolveSiteUrl(siteUrl?: string): string | null {
  if (siteUrl) return siteUrl;
  return process.env.GSC_DEFAULT_SITE_URL || null;
}
