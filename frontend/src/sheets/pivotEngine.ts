// Pivot table engine

export type AggregationType = 'SUM' | 'COUNT' | 'AVERAGE' | 'MIN' | 'MAX';

export interface PivotConfig {
  id: string;
  sourceRange: string;        // e.g. "A1:F100"
  sourceSheet: number;
  rowFields: string[];         // column headers used as row grouping
  colFields: string[];         // column headers used as column grouping
  valueFields: { field: string; aggregation: AggregationType }[];
  filterFields: { field: string; selectedValues: string[] }[];
  targetSheet?: number;        // sheet index to write results
  targetCell?: string;         // top-left cell for output
  showGrandTotals: boolean;
}

export interface PivotResult {
  headers: string[];           // column headers for the output table
  rows: string[][];            // each row of output data
  rowKeys: string[][];         // grouped row key values
  colKeys: string[][];         // grouped column key values
}

interface DataRow {
  [field: string]: string;
}

function aggregate(values: number[], type: AggregationType): number {
  if (values.length === 0) return 0;
  switch (type) {
    case 'SUM': return values.reduce((a, b) => a + b, 0);
    case 'COUNT': return values.length;
    case 'AVERAGE': return values.reduce((a, b) => a + b, 0) / values.length;
    case 'MIN': return Math.min(...values);
    case 'MAX': return Math.max(...values);
  }
}

function getGroupKey(row: DataRow, fields: string[]): string {
  return fields.map(f => row[f] ?? '').join('|||');
}

export function buildPivot(data: DataRow[], config: PivotConfig): PivotResult {
  // Apply filters
  let filtered = data;
  for (const filter of config.filterFields) {
    if (filter.selectedValues.length > 0) {
      const allowed = new Set(filter.selectedValues);
      filtered = filtered.filter(row => allowed.has(row[filter.field] ?? ''));
    }
  }

  // Collect unique row and column keys
  const rowKeysMap = new Map<string, string[]>();
  const colKeysMap = new Map<string, string[]>();

  for (const row of filtered) {
    const rk = getGroupKey(row, config.rowFields);
    if (!rowKeysMap.has(rk)) rowKeysMap.set(rk, config.rowFields.map(f => row[f] ?? ''));
    const ck = getGroupKey(row, config.colFields);
    if (!colKeysMap.has(ck)) colKeysMap.set(ck, config.colFields.map(f => row[f] ?? ''));
  }

  const rowKeys = Array.from(rowKeysMap.values()).sort((a, b) => a.join('').localeCompare(b.join('')));
  const colKeys = Array.from(colKeysMap.values()).sort((a, b) => a.join('').localeCompare(b.join('')));

  // Build aggregation buckets: rowKey -> colKey -> valueField -> number[]
  const buckets = new Map<string, Map<string, Map<string, number[]>>>();

  for (const row of filtered) {
    const rk = getGroupKey(row, config.rowFields);
    const ck = getGroupKey(row, config.colFields);
    if (!buckets.has(rk)) buckets.set(rk, new Map());
    const rowBucket = buckets.get(rk)!;
    if (!rowBucket.has(ck)) rowBucket.set(ck, new Map());
    const colBucket = rowBucket.get(ck)!;
    for (const vf of config.valueFields) {
      if (!colBucket.has(vf.field)) colBucket.set(vf.field, []);
      const num = parseFloat(row[vf.field] ?? '');
      colBucket.get(vf.field)!.push(isNaN(num) ? 0 : num);
    }
  }

  // Build headers
  const headers: string[] = [...config.rowFields];
  if (config.colFields.length > 0) {
    for (const ck of colKeys) {
      for (const vf of config.valueFields) {
        const colLabel = ck.join(' / ');
        headers.push(colLabel ? `${vf.field} (${vf.aggregation}) - ${colLabel}` : `${vf.field} (${vf.aggregation})`);
      }
    }
  } else {
    for (const vf of config.valueFields) {
      headers.push(`${vf.field} (${vf.aggregation})`);
    }
  }
  if (config.showGrandTotals && config.colFields.length > 0) {
    for (const vf of config.valueFields) {
      headers.push(`${vf.field} Grand Total`);
    }
  }

  // Build rows
  const rows: string[][] = [];
  const grandColTotals = new Map<string, number[]>(); // colKey+vf -> values for grand total row

  for (const rk of rowKeys) {
    const rkStr = getGroupKey({ ...Object.fromEntries(config.rowFields.map((f, i) => [f, rk[i]])) } as DataRow, config.rowFields);
    const row: string[] = [...rk];
    const rowBucket = buckets.get(rkStr);

    if (config.colFields.length > 0) {
      const rowGrandValues = new Map<string, number[]>();
      for (const ck of colKeys) {
        const ckStr = ck.join('|||');
        const colBucket = rowBucket?.get(ckStr);
        for (const vf of config.valueFields) {
          const values = colBucket?.get(vf.field) ?? [];
          row.push(String(aggregate(values, vf.aggregation)));
          // Grand total for this row
          if (!rowGrandValues.has(vf.field)) rowGrandValues.set(vf.field, []);
          rowGrandValues.get(vf.field)!.push(...values);
          // Grand total for column
          const gKey = `${ckStr}|||${vf.field}`;
          if (!grandColTotals.has(gKey)) grandColTotals.set(gKey, []);
          grandColTotals.get(gKey)!.push(...values);
        }
      }
      if (config.showGrandTotals) {
        for (const vf of config.valueFields) {
          const vals = rowGrandValues.get(vf.field) ?? [];
          row.push(String(aggregate(vals, vf.aggregation)));
        }
      }
    } else {
      // No column grouping — just aggregate all values for each value field
      for (const vf of config.valueFields) {
        const allVals: number[] = [];
        if (rowBucket) {
          for (const colBucket of rowBucket.values()) {
            allVals.push(...(colBucket.get(vf.field) ?? []));
          }
        }
        row.push(String(aggregate(allVals, vf.aggregation)));
      }
    }

    rows.push(row);
  }

  // Grand total row
  if (config.showGrandTotals) {
    const grandRow: string[] = config.rowFields.map((_, i) => i === 0 ? 'Grand Total' : '');
    if (config.colFields.length > 0) {
      for (const ck of colKeys) {
        const ckStr = ck.join('|||');
        for (const vf of config.valueFields) {
          const gKey = `${ckStr}|||${vf.field}`;
          const vals = grandColTotals.get(gKey) ?? [];
          grandRow.push(String(aggregate(vals, vf.aggregation)));
        }
      }
      // Overall grand total
      for (const vf of config.valueFields) {
        const allVals: number[] = [];
        for (const [key, vals] of grandColTotals) {
          if (key.endsWith(`|||${vf.field}`)) allVals.push(...vals);
        }
        grandRow.push(String(aggregate(allVals, vf.aggregation)));
      }
    } else {
      for (const vf of config.valueFields) {
        const allVals: number[] = [];
        for (const rowBucket of buckets.values()) {
          for (const colBucket of rowBucket.values()) {
            allVals.push(...(colBucket.get(vf.field) ?? []));
          }
        }
        grandRow.push(String(aggregate(allVals, vf.aggregation)));
      }
    }
    rows.push(grandRow);
  }

  return { headers, rows, rowKeys, colKeys };
}

// Extract data from sheet cells given a range and return as DataRow[]
// First row is treated as headers
import { expandRange, parseCellRef, cellId, indexToCol } from './formulaEngine';
import type { SheetData } from './sheetModel';

export function extractDataFromRange(sheet: SheetData, range: string): { headers: string[]; data: DataRow[] } {
  const refs = expandRange(range);
  if (refs.length === 0) return { headers: [], data: [] };

  const parsed = refs.map(r => parseCellRef(r)!).filter(Boolean);
  const minRow = Math.min(...parsed.map(p => p.row));
  const maxRow = Math.max(...parsed.map(p => p.row));
  const minCol = Math.min(...parsed.map(p => p.col));
  const maxCol = Math.max(...parsed.map(p => p.col));

  // First row = headers
  const headers: string[] = [];
  for (let c = minCol; c <= maxCol; c++) {
    const id = cellId(c, minRow);
    const cell = sheet.cells[id];
    headers.push(cell ? (cell.computed ?? cell.value) : indexToCol(c));
  }

  // Remaining rows = data
  const data: DataRow[] = [];
  for (let r = minRow + 1; r <= maxRow; r++) {
    const row: DataRow = {};
    let hasData = false;
    for (let c = minCol; c <= maxCol; c++) {
      const id = cellId(c, r);
      const cell = sheet.cells[id];
      const val = cell ? (cell.computed ?? cell.value) : '';
      row[headers[c - minCol]] = val;
      if (val) hasData = true;
    }
    if (hasData) data.push(row);
  }

  return { headers, data };
}
