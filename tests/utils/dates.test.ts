import { describe, it, expect } from 'vitest';
import { today, daysAgo, isValidDate, defaultDateRange, daysBetween } from '../../src/utils/dates.js';

describe('today', () => {
  it('should return a valid YYYY-MM-DD date', () => {
    const result = today();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(isValidDate(result)).toBe(true);
  });
});

describe('daysAgo', () => {
  it('should return a date N days before today', () => {
    const result = daysAgo(7);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const diff = daysBetween(result, today());
    expect(diff).toBe(7);
  });

  it('should return today for 0 days ago', () => {
    expect(daysAgo(0)).toBe(today());
  });
});

describe('isValidDate', () => {
  it('should accept valid dates', () => {
    expect(isValidDate('2025-01-15')).toBe(true);
    expect(isValidDate('2024-12-31')).toBe(true);
    expect(isValidDate('2026-03-24')).toBe(true);
  });

  it('should reject invalid formats', () => {
    expect(isValidDate('2025/01/15')).toBe(false);
    expect(isValidDate('01-15-2025')).toBe(false);
    expect(isValidDate('not-a-date')).toBe(false);
    expect(isValidDate('')).toBe(false);
  });

  it('should reject invalid dates', () => {
    expect(isValidDate('2025-13-01')).toBe(false); // month 13
    expect(isValidDate('2025-02-30')).toBe(false); // Feb 30
  });
});

describe('defaultDateRange', () => {
  it('should return a valid date range', () => {
    const range = defaultDateRange();
    expect(isValidDate(range.startDate)).toBe(true);
    expect(isValidDate(range.endDate)).toBe(true);
    expect(new Date(range.startDate) < new Date(range.endDate)).toBe(true);
  });

  it('should return a 7-day window', () => {
    const range = defaultDateRange();
    const diff = daysBetween(range.startDate, range.endDate);
    expect(diff).toBe(7);
  });
});

describe('daysBetween', () => {
  it('should calculate correct difference', () => {
    expect(daysBetween('2025-01-01', '2025-01-08')).toBe(7);
    expect(daysBetween('2025-01-01', '2025-01-01')).toBe(0);
    expect(daysBetween('2025-01-01', '2025-02-01')).toBe(31);
  });
});
