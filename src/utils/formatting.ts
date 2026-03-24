/**
 * Formats numbers for human-readable display.
 */
export function formatNumber(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}K`;
  return String(n);
}

/**
 * Formats CTR as percentage.
 */
export function formatCTR(ctr: number): string {
  return `${(ctr * 100).toFixed(2)}%`;
}

/**
 * Formats position to 1 decimal place.
 */
export function formatPosition(pos: number): string {
  return pos.toFixed(1);
}

/**
 * Formats a delta value with + or - prefix.
 */
export function formatDelta(value: number, formatter: (n: number) => string = String): string {
  if (value === 0) return formatter(0);
  const prefix = value > 0 ? '+' : '-';
  return `${prefix}${formatter(Math.abs(value))}`;
}

/**
 * Formats a percentage change.
 */
export function formatPercentChange(oldVal: number, newVal: number): string {
  if (oldVal === 0) return newVal > 0 ? '+inf%' : '0%';
  const change = ((newVal - oldVal) / oldVal) * 100;
  const prefix = change > 0 ? '+' : '';
  return `${prefix}${change.toFixed(1)}%`;
}

/**
 * Creates a text-based table for curated tool responses.
 */
export function formatTable(
  headers: string[],
  rows: string[][],
  options?: { maxRows?: number },
): string {
  const maxRows = options?.maxRows || rows.length;
  const displayRows = rows.slice(0, maxRows);

  // Calculate column widths
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...displayRows.map((r) => (r[i] || '').length)),
  );

  const divider = widths.map((w) => '-'.repeat(w)).join(' | ');
  const headerLine = headers.map((h, i) => h.padEnd(widths[i])).join(' | ');
  const bodyLines = displayRows.map((row) =>
    row.map((cell, i) => (cell || '').padEnd(widths[i])).join(' | '),
  );

  const parts = [headerLine, divider, ...bodyLines];

  if (rows.length > maxRows) {
    parts.push(`\n... and ${rows.length - maxRows} more rows`);
  }

  return parts.join('\n');
}
