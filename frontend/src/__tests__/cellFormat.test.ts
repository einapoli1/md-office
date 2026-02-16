import { describe, it, expect } from 'vitest';
import { formatCellValue, getBorderCSS } from '../sheets/cellFormat';

describe('formatCellValue', () => {
  it('returns raw value for general format', () => {
    expect(formatCellValue('hello')).toBe('hello');
    expect(formatCellValue('42', { numberFormat: 'general' })).toBe('42');
  });

  it('formats number with 2 decimals', () => {
    expect(formatCellValue('1234.5', { numberFormat: 'number' })).toBe('1,234.50');
  });

  it('formats currency USD', () => {
    const result = formatCellValue('1234.5', { numberFormat: 'currency', currencySymbol: '$' });
    expect(result).toContain('$');
    expect(result).toContain('1,234');
  });

  it('formats currency EUR', () => {
    const result = formatCellValue('100', { numberFormat: 'currency', currencySymbol: '€' });
    expect(result).toContain('€');
  });

  it('formats percentage', () => {
    expect(formatCellValue('0.75', { numberFormat: 'percentage' })).toBe('75.0%');
  });

  it('formats accounting positive', () => {
    const result = formatCellValue('100', { numberFormat: 'accounting' });
    expect(result).toContain('$');
    expect(result).toContain('100.00');
  });

  it('formats accounting negative with parens', () => {
    const result = formatCellValue('-50', { numberFormat: 'accounting' });
    expect(result).toContain('(');
    expect(result).toContain('50.00');
  });

  it('formats date MM/DD/YYYY', () => {
    // Use epoch ms to avoid timezone issues
    const d = new Date(2024, 5, 15).getTime(); // June 15 2024 local
    const result = formatCellValue(String(d), { numberFormat: 'date', dateFormat: 'MM/DD/YYYY' });
    expect(result).toBe('06/15/2024');
  });

  it('formats date YYYY-MM-DD', () => {
    const d = new Date(2024, 5, 15).getTime();
    const result = formatCellValue(String(d), { numberFormat: 'date', dateFormat: 'YYYY-MM-DD' });
    expect(result).toBe('2024-06-15');
  });

  it('formats time 12h', () => {
    const d = new Date(2024, 0, 1, 14, 30, 0).getTime();
    const result = formatCellValue(String(d), { numberFormat: 'time', timeFormat: '12h' });
    expect(result).toContain('PM');
  });

  it('formats time HH:MM', () => {
    const d = new Date(2024, 0, 1, 9, 5, 0).getTime();
    const result = formatCellValue(String(d), { numberFormat: 'time', timeFormat: 'HH:MM' });
    expect(result).toBe('09:05');
  });

  it('formats scientific notation', () => {
    expect(formatCellValue('12345', { numberFormat: 'scientific' })).toBe('1.23e+4');
  });

  it('formats fraction', () => {
    const result = formatCellValue('0.5', { numberFormat: 'fraction' });
    expect(result).toBe('1/2');
  });

  it('formats phone number', () => {
    expect(formatCellValue('5551234567', { numberFormat: 'phone' })).toBe('(555) 123-4567');
  });

  it('formats rating as stars', () => {
    expect(formatCellValue('3', { numberFormat: 'rating' })).toBe('★★★☆☆');
  });

  it('formats boolean', () => {
    expect(formatCellValue('true', { numberFormat: 'boolean' })).toBe('☑');
    expect(formatCellValue('false', { numberFormat: 'boolean' })).toBe('☐');
  });

  it('formats duration', () => {
    expect(formatCellValue('3661', { numberFormat: 'duration' })).toBe('1h 1m 1s');
  });

  it('returns raw value for NaN with number format', () => {
    expect(formatCellValue('abc', { numberFormat: 'number' })).toBe('abc');
  });

  it('formats text as-is', () => {
    expect(formatCellValue('42', { numberFormat: 'text' })).toBe('42');
  });

  it('custom format with comma grouping', () => {
    const result = formatCellValue('1234567', { numberFormat: 'custom', customFormat: '#,##0.00' });
    expect(result).toContain('1,234,567.00');
  });

  it('progress format', () => {
    expect(formatCellValue('75', { numberFormat: 'progress' })).toBe('75%');
  });
});

describe('getBorderCSS', () => {
  it('returns undefined for none', () => {
    expect(getBorderCSS('none')).toBeUndefined();
    expect(getBorderCSS(undefined)).toBeUndefined();
  });
  it('returns thin border', () => {
    expect(getBorderCSS('thin')).toBe('1px solid #333');
  });
  it('returns thick border', () => {
    expect(getBorderCSS('thick')).toBe('2px solid #333');
  });
  it('handles object border with custom color', () => {
    const result = getBorderCSS({ style: 'thin', lineStyle: 'dashed', color: '#f00' });
    expect(result).toBe('1px dashed #f00');
  });
});
