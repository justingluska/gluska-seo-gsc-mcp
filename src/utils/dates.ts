/**
 * Date utilities for GSC API queries.
 * All dates are in YYYY-MM-DD format as required by the API.
 */

/**
 * Returns today's date in YYYY-MM-DD format.
 */
export function today(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Returns a date N days ago in YYYY-MM-DD format.
 */
export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

/**
 * Validates a date string is in YYYY-MM-DD format.
 */
export function isValidDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

/**
 * Returns sensible default date range (last 7 days, excluding today and yesterday for data freshness).
 */
export function defaultDateRange(): { startDate: string; endDate: string } {
  return {
    startDate: daysAgo(9),
    endDate: daysAgo(2),
  };
}

/**
 * Calculates the number of days between two date strings.
 */
export function daysBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}
