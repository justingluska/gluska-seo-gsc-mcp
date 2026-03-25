import { z } from 'zod';
import { GoogleIndexingAPI } from '../api/indexing.js';
import { formatMeta } from '../utils/meta.js';

export const notifyUrlUpdateSchema = {
  url: z.string().url().describe('The URL to notify Google about'),
  type: z
    .enum(['URL_UPDATED', 'URL_DELETED'])
    .describe('Whether the URL was updated or deleted'),
};

export const getIndexingStatusSchema = {
  url: z.string().url().describe('The URL to check notification status for'),
};

export async function handleNotifyUrlUpdate(
  api: GoogleIndexingAPI,
  args: { url: string; type: 'URL_UPDATED' | 'URL_DELETED' },
) {
  try {
    const result = await api.publishNotification(args.url, args.type);
    const meta = result.urlNotificationMetadata;
    const quota = api.getQuotaRemaining();

    const sections = [
      `URL notification published: ${args.type}`,
      `URL: ${args.url}`,
      '',
    ];

    if (meta?.latestUpdate) {
      sections.push(`Latest update notification: ${meta.latestUpdate.notifyTime || 'N/A'}`);
    }
    if (meta?.latestRemove) {
      sections.push(`Latest remove notification: ${meta.latestRemove.notifyTime || 'N/A'}`);
    }

    sections.push(
      '',
      `Quota remaining: ${quota.publish} publish, ${quota.metadata} metadata requests today`,
      '',
      'Note: The Indexing API is officially supported for pages with JobPosting or BroadcastEvent structured data. Google may not process notifications for other page types.',
      formatMeta('notify_url_update', { url: args.url, type: args.type }),
    );

    return { content: [{ type: 'text' as const, text: sections.join('\n') }] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{
        type: 'text' as const,
        text: `Error publishing URL notification: ${message}\n\nCommon issues:\n- The Indexing API requires separate enablement in Google Cloud Console\n- The authenticated account needs Indexing API permissions\n- Quota: 200 publish requests/day`,
      }],
      isError: true,
    };
  }
}

export async function handleGetIndexingStatus(
  api: GoogleIndexingAPI,
  args: { url: string },
) {
  try {
    const result = await api.getNotificationStatus(args.url);
    const meta = result.urlNotificationMetadata;
    const quota = api.getQuotaRemaining();

    const sections = [
      `Indexing notification status for: ${args.url}`,
      '',
    ];

    if (meta?.latestUpdate) {
      sections.push(`Last update notification:`);
      sections.push(`  Type: ${meta.latestUpdate.type || 'N/A'}`);
      sections.push(`  Time: ${meta.latestUpdate.notifyTime || 'N/A'}`);
    } else {
      sections.push('No update notifications found for this URL.');
    }

    if (meta?.latestRemove) {
      sections.push(`Last remove notification:`);
      sections.push(`  Type: ${meta.latestRemove.type || 'N/A'}`);
      sections.push(`  Time: ${meta.latestRemove.notifyTime || 'N/A'}`);
    }

    sections.push(`\nQuota remaining: ${quota.publish} publish, ${quota.metadata} metadata requests today`);
    sections.push(formatMeta('get_indexing_status', { url: args.url }));

    return { content: [{ type: 'text' as const, text: sections.join('\n') }] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text' as const, text: `Error checking indexing status: ${message}` }],
      isError: true,
    };
  }
}
