import { z } from 'zod';
import { GoogleSearchConsoleAPI } from '../api/search-console.js';
import { formatTable } from '../utils/formatting.js';
import { formatMeta } from '../utils/meta.js';

export const listPropertiesSchema = {};

export async function handleListProperties(api: GoogleSearchConsoleAPI) {
  try {
    const sites = await api.listSites();

    if (sites.length === 0) {
      return {
        content: [{
          type: 'text' as const,
          text: 'No Search Console properties found.\n\nMake sure the authenticated account (OAuth user or service account email) has been granted access to at least one property in Search Console (Settings > Users and permissions).',
        }],
      };
    }

    const headers = ['Property', 'Type', 'Permission'];
    const rows = sites.map((s) => [
      s.siteUrl || 'N/A',
      (s.siteUrl || '').startsWith('sc-domain:') ? 'Domain' : 'URL Prefix',
      s.permissionLevel || 'N/A',
    ]);

    const output = [
      `Search Console Properties`,
      `Total: ${sites.length} property/properties`,
      '',
      formatTable(headers, rows),
      '',
      'Use any of these site URLs with other tools (e.g., search_analytics, inspect_url).',
      formatMeta('list_properties', {}),
    ].join('\n');

    return { content: [{ type: 'text' as const, text: output }] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text' as const, text: `Error listing properties: ${message}` }],
      isError: true,
    };
  }
}
