import { describe, it, expect } from 'vitest';
import { buildPivot, type PivotConfig } from '../pivotEngine';

function makeConfig(overrides: Partial<PivotConfig> = {}): PivotConfig {
  return {
    id: 'test',
    sourceRange: 'A1:C10',
    sourceSheet: 0,
    rowFields: [],
    colFields: [],
    valueFields: [],
    filterFields: [],
    showGrandTotals: false,
    ...overrides,
  };
}

const sampleData = [
  { Region: 'East', Product: 'A', Sales: '100' },
  { Region: 'East', Product: 'B', Sales: '200' },
  { Region: 'West', Product: 'A', Sales: '150' },
  { Region: 'West', Product: 'B', Sales: '250' },
  { Region: 'East', Product: 'A', Sales: '50' },
];

describe('buildPivot', () => {
  it('basic SUM aggregation by row', () => {
    const config = makeConfig({
      rowFields: ['Region'],
      valueFields: [{ field: 'Sales', aggregation: 'SUM' }],
    });
    const result = buildPivot(sampleData, config);
    expect(result.headers).toContain('Region');
    expect(result.headers).toContain('Sales (SUM)');
    expect(result.rows).toHaveLength(2);
    // East: 100+200+50=350, West: 150+250=400
    const eastRow = result.rows.find(r => r[0] === 'East')!;
    const westRow = result.rows.find(r => r[0] === 'West')!;
    expect(eastRow[1]).toBe('350');
    expect(westRow[1]).toBe('400');
  });

  it('COUNT aggregation', () => {
    const config = makeConfig({
      rowFields: ['Region'],
      valueFields: [{ field: 'Sales', aggregation: 'COUNT' }],
    });
    const result = buildPivot(sampleData, config);
    const eastRow = result.rows.find(r => r[0] === 'East')!;
    expect(eastRow[1]).toBe('3');
  });

  it('AVERAGE aggregation', () => {
    const config = makeConfig({
      rowFields: ['Product'],
      valueFields: [{ field: 'Sales', aggregation: 'AVERAGE' }],
    });
    const result = buildPivot(sampleData, config);
    // Product A: (100+150+50)/3 = 100
    const aRow = result.rows.find(r => r[0] === 'A')!;
    expect(aRow[1]).toBe('100');
  });

  it('multi-level grouping (row + col)', () => {
    const config = makeConfig({
      rowFields: ['Region'],
      colFields: ['Product'],
      valueFields: [{ field: 'Sales', aggregation: 'SUM' }],
    });
    const result = buildPivot(sampleData, config);
    expect(result.rows).toHaveLength(2);
    expect(result.colKeys).toHaveLength(2); // A, B
  });

  it('filters data', () => {
    const config = makeConfig({
      rowFields: ['Region'],
      valueFields: [{ field: 'Sales', aggregation: 'SUM' }],
      filterFields: [{ field: 'Product', selectedValues: ['A'] }],
    });
    const result = buildPivot(sampleData, config);
    const eastRow = result.rows.find(r => r[0] === 'East')!;
    // East Product A: 100+50=150
    expect(eastRow[1]).toBe('150');
  });

  it('grand totals', () => {
    const config = makeConfig({
      rowFields: ['Region'],
      valueFields: [{ field: 'Sales', aggregation: 'SUM' }],
      showGrandTotals: true,
    });
    const result = buildPivot(sampleData, config);
    const lastRow = result.rows[result.rows.length - 1];
    expect(lastRow[0]).toBe('Grand Total');
    expect(lastRow[1]).toBe('750');
  });
});
