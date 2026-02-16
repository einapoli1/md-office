// Fill logic for drag-fill (auto-complete) in spreadsheet

import { indexToCol } from './formulaEngine';

export type PatternType = 'number' | 'date' | 'formula' | 'copy';

export interface Pattern {
  type: PatternType;
  values: string[];
  increment?: number;
  dateIndex?: number; // starting month index for date patterns
}

const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAMES_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function findInSequence(val: string, sequences: string[][]): { seqIdx: number; itemIdx: number } | null {
  for (let si = 0; si < sequences.length; si++) {
    const idx = sequences[si].findIndex(s => s.toLowerCase() === val.toLowerCase());
    if (idx !== -1) return { seqIdx: si, itemIdx: idx };
  }
  return null;
}

/** Detect a fill pattern from an array of cell values */
export function detectPattern(cells: string[]): Pattern {
  if (cells.length === 0) return { type: 'copy', values: [] };

  // Check if all are formulas
  if (cells.every(c => c.startsWith('='))) {
    return { type: 'formula', values: cells };
  }

  // Check date/day sequences
  const dateSequences = [MONTH_NAMES_SHORT, MONTH_NAMES_LONG, DAY_NAMES_SHORT, DAY_NAMES_LONG];
  if (cells.length >= 1) {
    const first = findInSequence(cells[0], dateSequences);
    if (first !== null) {
      const seq = dateSequences[first.seqIdx];
      // Verify the sequence matches
      let isDateSeq = true;
      for (let i = 1; i < cells.length; i++) {
        const expected = seq[(first.itemIdx + i) % seq.length];
        if (cells[i].toLowerCase() !== expected.toLowerCase()) { isDateSeq = false; break; }
      }
      if (isDateSeq) {
        return { type: 'date', values: cells, dateIndex: first.itemIdx, increment: 1 };
      }
    }
  }

  // Check number sequences
  const nums = cells.map(c => parseFloat(c));
  if (nums.every(n => !isNaN(n))) {
    if (cells.length === 1) {
      return { type: 'number', values: cells, increment: 1 };
    }
    // Detect constant increment
    const increments: number[] = [];
    for (let i = 1; i < nums.length; i++) {
      increments.push(nums[i] - nums[i - 1]);
    }
    const allSame = increments.every(inc => Math.abs(inc - increments[0]) < 1e-10);
    if (allSame) {
      return { type: 'number', values: cells, increment: increments[0] };
    }
    // No consistent increment, just copy
    return { type: 'copy', values: cells };
  }

  // Default: copy pattern
  return { type: 'copy', values: cells };
}

/** Generate fill values based on detected pattern */
export function generateFill(pattern: Pattern, count: number): string[] {
  const result: string[] = [];
  if (count <= 0) return result;

  switch (pattern.type) {
    case 'number': {
      const lastNum = parseFloat(pattern.values[pattern.values.length - 1]);
      const inc = pattern.increment ?? 1;
      for (let i = 1; i <= count; i++) {
        const val = lastNum + inc * i;
        // Preserve decimal places from original
        const decimals = pattern.values[0].includes('.') ? (pattern.values[0].split('.')[1]?.length ?? 0) : 0;
        result.push(decimals > 0 ? val.toFixed(decimals) : String(val));
      }
      break;
    }
    case 'date': {
      const dateSequences = [MONTH_NAMES_SHORT, MONTH_NAMES_LONG, DAY_NAMES_SHORT, DAY_NAMES_LONG];
      // Find which sequence
      const first = findInSequence(pattern.values[0], dateSequences);
      if (first) {
        const seq = dateSequences[first.seqIdx];
        const lastIdx = first.itemIdx + pattern.values.length - 1;
        for (let i = 1; i <= count; i++) {
          // Preserve original casing style
          const item = seq[(lastIdx + i) % seq.length];
          const orig = pattern.values[0];
          if (orig === orig.toUpperCase()) result.push(item.toUpperCase());
          else if (orig === orig.toLowerCase()) result.push(item.toLowerCase());
          else result.push(item);
        }
      }
      break;
    }
    case 'formula': {
      // Use the last formula and adjust references based on fill direction
      // The caller passes rowDelta/colDelta via adjustFormula
      // Here we just return the last value repeated — actual adjustment happens in the caller
      for (let i = 0; i < count; i++) {
        result.push(pattern.values[pattern.values.length - 1]);
      }
      break;
    }
    case 'copy': {
      for (let i = 0; i < count; i++) {
        result.push(pattern.values[i % pattern.values.length]);
      }
      break;
    }
  }
  return result;
}

/**
 * Adjust relative cell references in a formula by row/col delta.
 * $A$1 stays fixed, $A1 adjusts row only, A$1 adjusts col only, A1 adjusts both.
 */
export function adjustFormula(formula: string, rowDelta: number, colDelta: number): string {
  // Match cell references with optional $ prefixes: $A$1, $A1, A$1, A1
  return formula.replace(/(\$?)([A-Z]+)(\$?)(\d+)/g, (_match, dollarCol: string, col: string, dollarRow: string, row: string) => {
    let newCol = col;
    let newRow = row;

    if (!dollarCol) {
      // Adjust column
      const colIdx = colToIndex(col) + colDelta;
      if (colIdx >= 0) newCol = indexToCol(colIdx);
    }

    if (!dollarRow) {
      // Adjust row
      const rowNum = parseInt(row) + rowDelta;
      if (rowNum >= 1) newRow = String(rowNum);
    }

    return `${dollarCol}${newCol}${dollarRow}${newRow}`;
  });
}

// Local helper (same as formulaEngine but avoids circular issues)
function colToIndex(col: string): number {
  let idx = 0;
  for (let i = 0; i < col.length; i++) {
    idx = idx * 26 + (col.charCodeAt(i) - 64);
  }
  return idx - 1;
}

/**
 * Parse formula references with colors for highlighting.
 * Returns array of { ref, range, color } for each cell/range reference found.
 */
const HIGHLIGHT_COLORS = [
  '#4285f4', // blue
  '#ea4335', // red
  '#34a853', // green
  '#9334e6', // purple
  '#ff6d01', // orange
  '#46bdc6', // teal
  '#f538a0', // pink
  '#185abc', // dark blue
];

export interface FormulaRef {
  text: string;      // the raw text matched (e.g. "A1" or "B2:C5")
  startIdx: number;  // start index in formula string
  endIdx: number;    // end index in formula string
  color: string;
  // Parsed cell coordinates
  cells: { col: number; row: number }[];
}

/** Extract cell/range references from a formula string with color assignments */
export function parseFormulaRefs(formula: string): FormulaRef[] {
  if (!formula.startsWith('=')) return [];
  const expr = formula.slice(1);
  const refs: FormulaRef[] = [];
  let colorIdx = 0;

  // Match ranges first (A1:B5), then individual cells
  const rangePattern = /(\$?[A-Z]+\$?\d+):(\$?[A-Z]+\$?\d+)/g;
  const matched = new Set<number>(); // positions already matched by ranges

  let m: RegExpExecArray | null;
  while ((m = rangePattern.exec(expr)) !== null) {
    const startRef = parseRefStr(m[1]);
    const endRef = parseRefStr(m[2]);
    if (!startRef || !endRef) continue;

    const cells: { col: number; row: number }[] = [];
    const minCol = Math.min(startRef.col, endRef.col);
    const maxCol = Math.max(startRef.col, endRef.col);
    const minRow = Math.min(startRef.row, endRef.row);
    const maxRow = Math.max(startRef.row, endRef.row);
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        cells.push({ col: c, row: r });
      }
    }

    const color = HIGHLIGHT_COLORS[colorIdx % HIGHLIGHT_COLORS.length];
    colorIdx++;
    refs.push({
      text: m[0],
      startIdx: m.index + 1, // +1 for the '='
      endIdx: m.index + m[0].length + 1,
      color,
      cells,
    });
    for (let i = m.index; i < m.index + m[0].length; i++) matched.add(i);
  }

  // Individual cell refs
  const cellPattern = /\$?[A-Z]+\$?\d+/g;
  cellPattern.lastIndex = 0;
  while ((m = cellPattern.exec(expr)) !== null) {
    if (matched.has(m.index)) continue;
    const ref = parseRefStr(m[0]);
    if (!ref) continue;

    const color = HIGHLIGHT_COLORS[colorIdx % HIGHLIGHT_COLORS.length];
    colorIdx++;
    refs.push({
      text: m[0],
      startIdx: m.index + 1,
      endIdx: m.index + m[0].length + 1,
      color,
      cells: [{ col: ref.col, row: ref.row }],
    });
  }

  return refs;
}

function parseRefStr(ref: string): { col: number; row: number } | null {
  const m = ref.match(/^\$?([A-Z]+)\$?(\d+)$/);
  if (!m) return null;
  return { col: colToIndex(m[1]), row: parseInt(m[2]) - 1 };
}

/**
 * Measure text width using a canvas context (for auto-sizing columns/rows).
 */
let measureCanvas: HTMLCanvasElement | null = null;
let measureCtx: CanvasRenderingContext2D | null = null;

export function measureTextWidth(text: string, font: string = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'): number {
  if (!measureCanvas) {
    measureCanvas = document.createElement('canvas');
    measureCtx = measureCanvas.getContext('2d');
  }
  if (!measureCtx) return text.length * 8;
  measureCtx.font = font;
  return measureCtx.measureText(text).width;
}

export function measureTextHeight(text: string, maxWidth: number, font: string = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'): number {
  const width = measureTextWidth(text, font);
  const lines = Math.max(1, Math.ceil(width / maxWidth));
  return lines * 20; // ~20px per line
}
