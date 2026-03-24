import { describe, it, expect } from 'vitest';
import {
  formatNumber,
  formatCTR,
  formatPosition,
  formatDelta,
  formatPercentChange,
  formatTable,
} from '../../src/utils/formatting.js';

describe('formatNumber', () => {
  it('should format millions', () => {
    expect(formatNumber(1_500_000)).toBe('1.5M');
    expect(formatNumber(1_000_000)).toBe('1.0M');
  });

  it('should format thousands', () => {
    expect(formatNumber(1_500)).toBe('1.5K');
    expect(formatNumber(1_000)).toBe('1.0K');
    expect(formatNumber(50_000)).toBe('50.0K');
  });

  it('should format small numbers directly', () => {
    expect(formatNumber(42)).toBe('42');
    expect(formatNumber(999)).toBe('999');
    expect(formatNumber(0)).toBe('0');
  });
});

describe('formatCTR', () => {
  it('should format as percentage', () => {
    expect(formatCTR(0.05)).toBe('5.00%');
    expect(formatCTR(0.1234)).toBe('12.34%');
    expect(formatCTR(0)).toBe('0.00%');
    expect(formatCTR(1)).toBe('100.00%');
  });
});

describe('formatPosition', () => {
  it('should format to 1 decimal', () => {
    expect(formatPosition(3.456)).toBe('3.5');
    expect(formatPosition(1)).toBe('1.0');
    expect(formatPosition(15.123)).toBe('15.1');
  });
});

describe('formatDelta', () => {
  it('should add + prefix for positive values', () => {
    expect(formatDelta(5)).toBe('+5');
    expect(formatDelta(100, formatNumber)).toBe('+100');
  });

  it('should include - for negative values', () => {
    expect(formatDelta(-5)).toBe('-5');
    expect(formatDelta(-1500, formatNumber)).toBe('-1.5K');
  });

  it('should handle zero', () => {
    expect(formatDelta(0)).toBe('0');
  });
});

describe('formatPercentChange', () => {
  it('should calculate percent change', () => {
    expect(formatPercentChange(100, 150)).toBe('+50.0%');
    expect(formatPercentChange(100, 50)).toBe('-50.0%');
    expect(formatPercentChange(100, 100)).toBe('0.0%');
  });

  it('should handle zero base', () => {
    expect(formatPercentChange(0, 100)).toBe('+inf%');
    expect(formatPercentChange(0, 0)).toBe('0%');
  });
});

describe('formatTable', () => {
  it('should create a formatted table', () => {
    const result = formatTable(
      ['Name', 'Value'],
      [
        ['foo', '123'],
        ['bar', '456'],
      ],
    );
    expect(result).toContain('Name');
    expect(result).toContain('Value');
    expect(result).toContain('foo');
    expect(result).toContain('123');
    expect(result).toContain('bar');
    expect(result).toContain('456');
    expect(result).toContain('---');
  });

  it('should respect maxRows option', () => {
    const result = formatTable(
      ['A'],
      [['1'], ['2'], ['3'], ['4'], ['5']],
      { maxRows: 2 },
    );
    expect(result).toContain('1');
    expect(result).toContain('2');
    expect(result).toContain('3 more rows');
    expect(result).not.toContain('| 3');
  });

  it('should handle empty rows', () => {
    const result = formatTable(['A', 'B'], []);
    expect(result).toContain('A');
    expect(result).toContain('B');
  });
});
