// Formula engine with dependency tracking and circular reference detection

import { evaluateLatexFormula } from '../utils/mathSolver';
import { serializeSparkline } from './Sparkline';

export type CellGetter = (ref: string) => string;

// Cross-sheet cell getter: resolves Sheet2!A1 or 'My Sheet'!A1 references
export type CrossSheetGetter = (sheetName: string, ref: string) => string;

// Error types
export const ERRORS = {
  REF: '#REF!',
  NAME: '#NAME?',
  VALUE: '#VALUE!',
  DIV0: '#DIV/0!',
  NA: '#N/A',
  NULL: '#NULL!',
  SPILL: '#SPILL!',
  CIRCULAR: '#CIRCULAR!',
  ERROR: '#ERROR!',
} as const;

export function isFormulaError(val: string): boolean {
  return val.startsWith('#') && (val.endsWith('!') || val.endsWith('?'));
}

// Volatile function names — recalculate on every change
export const VOLATILE_FUNCTIONS = new Set(['NOW', 'TODAY', 'RAND', 'RANDBETWEEN']);

// Array formula result — 2D array of values
export interface ArrayResult {
  values: (string | number)[][];  // rows x cols
  sourceCell: string;             // the cell that contains the array formula
}

// Check if a formula is an array formula (wrapped in {= })
export function isArrayFormula(formula: string): boolean {
  return formula.startsWith('{=') && formula.endsWith('}');
}

// Strip array formula braces
export function stripArrayBraces(formula: string): string {
  if (isArrayFormula(formula)) return '=' + formula.slice(2, -1);
  return formula;
}

// Parse cross-sheet reference: "Sheet2!A1" or "'My Sheet'!A1:B10"
export function parseCrossSheetRef(ref: string): { sheetName: string; cellRef: string } | null {
  // 'Sheet Name'!ref
  const quoted = ref.match(/^'([^']+)'!(.+)$/);
  if (quoted) return { sheetName: quoted[1], cellRef: quoted[2] };
  // SheetName!ref (no spaces)
  const unquoted = ref.match(/^([A-Za-z0-9_]+)!(.+)$/);
  if (unquoted) return { sheetName: unquoted[1], cellRef: unquoted[2] };
  return null;
}

// Parse column letter(s) to 0-based index
export function colToIndex(col: string): number {
  let idx = 0;
  for (let i = 0; i < col.length; i++) {
    idx = idx * 26 + (col.charCodeAt(i) - 64);
  }
  return idx - 1;
}

export function indexToCol(idx: number): string {
  let s = '';
  idx += 1;
  while (idx > 0) {
    idx--;
    s = String.fromCharCode(65 + (idx % 26)) + s;
    idx = Math.floor(idx / 26);
  }
  return s;
}

export function parseCellRef(ref: string): { col: number; row: number } | null {
  const m = ref.match(/^([A-Z]+)(\d+)$/);
  if (!m) return null;
  return { col: colToIndex(m[1]), row: parseInt(m[2]) - 1 };
}

export function cellId(col: number, row: number): string {
  return `${indexToCol(col)}${row + 1}`;
}

// Expand a range like A1:C3 into individual cell refs
export function expandRange(range: string): string[] {
  const [startRef, endRef] = range.split(':');
  const start = parseCellRef(startRef);
  const end = parseCellRef(endRef);
  if (!start || !end) return [];
  const refs: string[] = [];
  const minCol = Math.min(start.col, end.col);
  const maxCol = Math.max(start.col, end.col);
  const minRow = Math.min(start.row, end.row);
  const maxRow = Math.max(start.row, end.row);
  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      refs.push(cellId(c, r));
    }
  }
  return refs;
}

// Extract all cell references from a formula (for dependency tracking)
export function extractRefs(formula: string): string[] {
  const refs: string[] = [];
  const rangePattern = /([A-Z]+\d+):([A-Z]+\d+)/g;
  const cellPattern = /[A-Z]+\d+/g;
  
  let m: RegExpExecArray | null;
  const rangePositions = new Set<number>();
  while ((m = rangePattern.exec(formula)) !== null) {
    refs.push(...expandRange(m[0]));
    for (let i = m.index; i < m.index + m[0].length; i++) rangePositions.add(i);
  }
  
  cellPattern.lastIndex = 0;
  while ((m = cellPattern.exec(formula)) !== null) {
    if (!rangePositions.has(m.index)) {
      refs.push(m[0]);
    }
  }
  return refs;
}

// All known function names
const ALL_FUNC_NAMES = new Set([
  // Original
  'SUM', 'AVERAGE', 'COUNT', 'MIN', 'MAX', 'ABS', 'ROUND', 'NOW', 'TODAY',
  'IF', 'CONCATENATE',
  // Lookup
  'VLOOKUP', 'HLOOKUP', 'INDEX', 'MATCH',
  // Conditional
  'COUNTIF', 'SUMIF', 'AVERAGEIF', 'COUNTIFS', 'SUMIFS',
  // Text
  'LEFT', 'RIGHT', 'MID', 'LEN', 'TRIM', 'UPPER', 'LOWER', 'PROPER', 'FIND', 'SUBSTITUTE', 'TEXT',
  // Date
  'DATE', 'YEAR', 'MONTH', 'DAY', 'DATEDIF', 'WEEKDAY', 'EOMONTH',
  // Math
  'CEILING', 'FLOOR', 'MOD', 'POWER', 'SQRT', 'LOG', 'LN', 'PI', 'RAND', 'RANDBETWEEN',
  // Logic
  'AND', 'OR', 'NOT', 'IFERROR', 'ISBLANK', 'ISNA',
  // Stats
  'MEDIAN', 'STDEV', 'VAR', 'LARGE', 'SMALL', 'RANK',
  // LaTeX
  'LATEX',
  // Sparkline
  'SPARKLINE',
  // Array functions
  'ARRAYFORMULA', 'UNIQUE', 'SORT', 'FILTER', 'TRANSPOSE', 'FLATTEN', 'SEQUENCE',
  // Lambda-style
  'MAP', 'REDUCE',
]);

// Built-in numeric functions (simple signature)
const FUNCTIONS: Record<string, (args: number[][]) => number | string> = {
  SUM: (args) => args.flat().reduce((a, b) => a + b, 0),
  AVERAGE: (args) => { const flat = args.flat(); return flat.length ? flat.reduce((a, b) => a + b, 0) / flat.length : 0; },
  COUNT: (args) => args.flat().filter(v => !isNaN(v)).length,
  MIN: (args) => Math.min(...args.flat()),
  MAX: (args) => Math.max(...args.flat()),
  ABS: (args) => Math.abs(args.flat()[0]),
  ROUND: (args) => { const flat = args.flat(); return Math.round(flat[0] * Math.pow(10, flat[1] || 0)) / Math.pow(10, flat[1] || 0); },
  NOW: () => Date.now(),
  TODAY: () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); },
  // Math
  CEILING: (args) => { const f = args.flat(); const s = f[1] || 1; return Math.ceil(f[0] / s) * s; },
  FLOOR: (args) => { const f = args.flat(); const s = f[1] || 1; return Math.floor(f[0] / s) * s; },
  MOD: (args) => { const f = args.flat(); return f[0] % f[1]; },
  POWER: (args) => { const f = args.flat(); return Math.pow(f[0], f[1]); },
  SQRT: (args) => Math.sqrt(args.flat()[0]),
  LOG: (args) => { const f = args.flat(); return f.length > 1 ? Math.log(f[0]) / Math.log(f[1]) : Math.log10(f[0]); },
  LN: (args) => Math.log(args.flat()[0]),
  PI: () => Math.PI,
  RAND: () => Math.random(),
  RANDBETWEEN: (args) => { const f = args.flat(); return Math.floor(Math.random() * (f[1] - f[0] + 1)) + f[0]; },
  // Stats
  MEDIAN: (args) => {
    const s = args.flat().sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  },
  STDEV: (args) => {
    const f = args.flat();
    const mean = f.reduce((a, b) => a + b, 0) / f.length;
    return Math.sqrt(f.reduce((s, v) => s + (v - mean) ** 2, 0) / (f.length - 1));
  },
  VAR: (args) => {
    const f = args.flat();
    const mean = f.reduce((a, b) => a + b, 0) / f.length;
    return f.reduce((s, v) => s + (v - mean) ** 2, 0) / (f.length - 1);
  },
  LARGE: (args) => {
    const f = args[0] || [];
    const k = (args[1] || [1])[0];
    const sorted = [...f].sort((a, b) => b - a);
    return sorted[k - 1] ?? 0;
  },
  SMALL: (args) => {
    const f = args[0] || [];
    const k = (args[1] || [1])[0];
    const sorted = [...f].sort((a, b) => a - b);
    return sorted[k - 1] ?? 0;
  },
  RANK: (args) => {
    const val = (args[0] || [0])[0];
    const range = args[1] || [];
    const order = (args[2] || [0])[0];
    const sorted = [...range].sort((a, b) => order ? a - b : b - a);
    return sorted.indexOf(val) + 1 || 0;
  },
  // Date
  DATE: (args) => { const f = args.flat(); return new Date(f[0], f[1] - 1, f[2]).getTime(); },
  YEAR: (args) => new Date(args.flat()[0]).getFullYear(),
  MONTH: (args) => new Date(args.flat()[0]).getMonth() + 1,
  DAY: (args) => new Date(args.flat()[0]).getDate(),
  WEEKDAY: (args) => { const f = args.flat(); const d = new Date(f[0]).getDay(); return (f[1] === 2) ? (d === 0 ? 7 : d) : d + 1; },
  EOMONTH: (args) => {
    const f = args.flat();
    const d = new Date(f[0]);
    d.setMonth(d.getMonth() + (f[1] || 0) + 1, 0);
    return d.getTime();
  },
};

// Tokenizer for formula parsing

type Token = { type: 'number' | 'string' | 'ref' | 'range' | 'func' | 'op' | 'paren' | 'comma' | 'crossref' | 'crossrange'; value: string };

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    if (expr[i] === ' ') { i++; continue; }
    if (expr[i] === '(' || expr[i] === ')') { tokens.push({ type: 'paren', value: expr[i] }); i++; continue; }
    if (expr[i] === ',') { tokens.push({ type: 'comma', value: ',' }); i++; continue; }
    // Quoted sheet reference: 'Sheet Name'!A1 or 'Sheet Name'!A1:B2
    if (expr[i] === "'") {
      i++; // skip opening quote
      let sheetName = '';
      while (i < expr.length && expr[i] !== "'") { sheetName += expr[i]; i++; }
      if (i < expr.length) i++; // skip closing quote
      if (i < expr.length && expr[i] === '!') {
        i++; // skip !
        let ref = '';
        while (i < expr.length && /[A-Za-z0-9:]/.test(expr[i])) { ref += expr[i]; i++; }
        const upper = ref.toUpperCase();
        if (upper.includes(':')) {
          tokens.push({ type: 'crossrange', value: `'${sheetName}'!${upper}` });
        } else {
          tokens.push({ type: 'crossref', value: `'${sheetName}'!${upper}` });
        }
        continue;
      }
      // fallback: treat as string
      tokens.push({ type: 'string', value: sheetName });
      continue;
    }
    if (expr[i] === '"') {
      const q = expr[i]; i++;
      let s = '';
      while (i < expr.length && expr[i] !== q) { s += expr[i]; i++; }
      i++;
      tokens.push({ type: 'string', value: s });
      continue;
    }
    if ('+-*/^&=<>!'.includes(expr[i])) {
      let op = expr[i]; i++;
      if (i < expr.length && (expr[i] === '=' || (op === '<' && expr[i] === '>'))) { op += expr[i]; i++; }
      tokens.push({ type: 'op', value: op }); continue;
    }
    if (/\d/.test(expr[i]) || (expr[i] === '.' && i + 1 < expr.length && /\d/.test(expr[i + 1]))) {
      let num = '';
      while (i < expr.length && /[\d.]/.test(expr[i])) { num += expr[i]; i++; }
      tokens.push({ type: 'number', value: num }); continue;
    }
    if (/[A-Za-z]/.test(expr[i])) {
      let id = '';
      while (i < expr.length && /[A-Za-z0-9_]/.test(expr[i])) { id += expr[i]; i++; }
      // Check for cross-sheet reference: SheetName!A1 or SheetName!A1:B2
      if (i < expr.length && expr[i] === '!' && !ALL_FUNC_NAMES.has(id.toUpperCase())) {
        i++; // skip !
        let ref = '';
        while (i < expr.length && /[A-Za-z0-9:]/.test(expr[i])) { ref += expr[i]; i++; }
        const upper = ref.toUpperCase();
        if (upper.includes(':')) {
          tokens.push({ type: 'crossrange', value: `${id}!${upper}` });
        } else {
          tokens.push({ type: 'crossref', value: `${id}!${upper}` });
        }
        continue;
      }
      if (i < expr.length && expr[i] === ':') {
        i++;
        let id2 = '';
        while (i < expr.length && /[A-Za-z0-9]/.test(expr[i])) { id2 += expr[i]; i++; }
        tokens.push({ type: 'range', value: `${id.toUpperCase()}:${id2.toUpperCase()}` }); continue;
      }
      const upper = id.toUpperCase();
      if (i < expr.length && expr[i] === '(' && ALL_FUNC_NAMES.has(upper)) {
        tokens.push({ type: 'func', value: upper }); continue;
      }
      if (/^[A-Z]+\d+$/.test(upper)) {
        tokens.push({ type: 'ref', value: upper }); continue;
      }
      // TRUE/FALSE literals
      if (upper === 'TRUE') { tokens.push({ type: 'number', value: '1' }); continue; }
      if (upper === 'FALSE') { tokens.push({ type: 'number', value: '0' }); continue; }
      tokens.push({ type: 'ref', value: upper }); continue;
    }
    i++;
  }
  return tokens;
}

// Helper to get 2D range values with dimensions
function getRangeAs2D(rangeStr: string, get: CellGetter): { values: (number | string)[][]; rows: number; cols: number } {
  const [startRef, endRef] = rangeStr.split(':');
  const start = parseCellRef(startRef);
  const end = parseCellRef(endRef);
  if (!start || !end) return { values: [], rows: 0, cols: 0 };
  const minCol = Math.min(start.col, end.col);
  const maxCol = Math.max(start.col, end.col);
  const minRow = Math.min(start.row, end.row);
  const maxRow = Math.max(start.row, end.row);
  const rows = maxRow - minRow + 1;
  const cols = maxCol - minCol + 1;
  const values: (number | string)[][] = [];
  for (let r = minRow; r <= maxRow; r++) {
    const row: (number | string)[] = [];
    for (let c = minCol; c <= maxCol; c++) {
      const v = get(cellId(c, r));
      const n = parseFloat(v);
      row.push(v === '' ? '' : isNaN(n) ? v : n);
    }
    values.push(row);
  }
  return { values, rows, cols };
}

// Simple recursive descent evaluator
function evaluate(tokens: Token[], get: CellGetter, crossSheetGet?: CrossSheetGetter): number | string {
  let pos = 0;

  function peek(): Token | undefined { return tokens[pos]; }
  function next(): Token { return tokens[pos++]; }

  function parseExpr(): number | string {
    let left = parseComparison();
    while (peek()?.value === '&') {
      next();
      const right = parseComparison();
      left = String(left) + String(right);
    }
    return left;
  }

  function parseComparison(): number | string {
    let left = parseAddSub();
    const ops = ['=', '==', '<', '>', '<=', '>=', '<>', '!='];
    while (peek() && ops.includes(peek()!.value)) {
      const op = next().value;
      const right = parseAddSub();
      const l = typeof left === 'number' ? left : parseFloat(left as string);
      const r = typeof right === 'number' ? right : parseFloat(right as string);
      switch (op) {
        case '=': case '==': left = l === r ? 1 : 0; break;
        case '<>': case '!=': left = l !== r ? 1 : 0; break;
        case '<': left = l < r ? 1 : 0; break;
        case '>': left = l > r ? 1 : 0; break;
        case '<=': left = l <= r ? 1 : 0; break;
        case '>=': left = l >= r ? 1 : 0; break;
      }
    }
    return left;
  }

  function parseAddSub(): number | string {
    let left = parseMulDiv();
    while (peek()?.value === '+' || peek()?.value === '-') {
      const op = next().value;
      const right = parseMulDiv();
      const l = typeof left === 'number' ? left : parseFloat(String(left)) || 0;
      const r = typeof right === 'number' ? right : parseFloat(String(right)) || 0;
      left = op === '+' ? l + r : l - r;
    }
    return left;
  }

  function parseMulDiv(): number | string {
    let left = parsePower();
    while (peek()?.value === '*' || peek()?.value === '/') {
      const op = next().value;
      const right = parsePower();
      const l = typeof left === 'number' ? left : parseFloat(String(left)) || 0;
      const r = typeof right === 'number' ? right : parseFloat(String(right)) || 0;
      left = op === '*' ? l * r : r !== 0 ? l / r : ERRORS.DIV0;
    }
    return left;
  }

  function parsePower(): number | string {
    let base = parseUnary();
    while (peek()?.value === '^') {
      next();
      const exp = parseUnary();
      base = Math.pow(
        typeof base === 'number' ? base : parseFloat(String(base)) || 0,
        typeof exp === 'number' ? exp : parseFloat(String(exp)) || 0
      );
    }
    return base;
  }

  function parseUnary(): number | string {
    if (peek()?.value === '-') {
      next();
      const v = parsePrimary();
      return -(typeof v === 'number' ? v : parseFloat(String(v)) || 0);
    }
    if (peek()?.value === '+') { next(); }
    return parsePrimary();
  }

  // Collect raw string args (for text/lookup functions that need strings not numbers)
  function collectArgs(): (number | string)[] {
    const args: (number | string)[] = [];
    while (peek() && peek()!.value !== ')') {
      if (peek()?.type === 'range') {
        const range = next().value;
        const refs = expandRange(range);
        // For text funcs, push each value individually
        for (const r of refs) {
          const v = get(r);
          const n = parseFloat(v);
          args.push(isNaN(n) ? v : n);
        }
      } else {
        args.push(parseExpr());
      }
      if (peek()?.value === ',') next();
    }
    if (peek()?.value === ')') next();
    return args;
  }

  // Collect args preserving range grouping for VLOOKUP etc
  function collectArgsGrouped(): (number | string)[][] {
    const args: (number | string)[][] = [];
    while (peek() && peek()!.value !== ')') {
      if (peek()?.type === 'range') {
        const range = next().value;
        const refs = expandRange(range);
        args.push(refs.map(r => { const v = get(r); const n = parseFloat(v); return isNaN(n) ? v : n; }));
      } else {
        args.push([parseExpr()]);
      }
      if (peek()?.value === ',') next();
    }
    if (peek()?.value === ')') next();
    return args;
  }

  function getRangeValues(rangeStr: string): string[] {
    return expandRange(rangeStr).map(r => get(r));
  }

  function parsePrimary(): number | string {
    const t = peek();
    if (!t) return 0;

    if (t.type === 'number') { next(); return parseFloat(t.value); }
    if (t.type === 'string') { next(); return t.value; }

    if (t.type === 'paren' && t.value === '(') {
      next();
      const val = parseExpr();
      if (peek()?.value === ')') next();
      return val;
    }

    if (t.type === 'func') {
      const fname = next().value;
      if (peek()?.value === '(') next();
      
      // Special functions that need custom parsing
      if (fname === 'IF') {
        const cond = parseExpr();
        if (peek()?.value === ',') next();
        const trueVal = parseExpr();
        if (peek()?.value === ',') next();
        const falseVal = parseExpr();
        if (peek()?.value === ')') next();
        return (typeof cond === 'number' ? cond !== 0 : cond !== '') ? trueVal : falseVal;
      }

      if (fname === 'IFERROR') {
        const savedPos = pos;
        try {
          const val = parseExpr();
          if (peek()?.value === ',') next();
          const fallback = parseExpr();
          if (peek()?.value === ')') next();
          if (typeof val === 'string' && val.startsWith('#')) return fallback;
          if (typeof val === 'number' && isNaN(val)) return fallback;
          return val;
        } catch {
          pos = savedPos;
          // skip to closing paren
          let depth = 1;
          while (pos < tokens.length && depth > 0) {
            if (tokens[pos].value === '(') depth++;
            if (tokens[pos].value === ')') depth--;
            pos++;
          }
          return 0;
        }
      }

      if (fname === 'CONCATENATE') {
        const parts: string[] = [];
        while (peek() && peek()!.value !== ')') {
          parts.push(String(parseExpr()));
          if (peek()?.value === ',') next();
        }
        if (peek()?.value === ')') next();
        return parts.join('');
      }

      // Text functions
      if (fname === 'LEFT') {
        const args = collectArgs();
        const s = String(args[0] ?? '');
        const n = Number(args[1] ?? 1);
        return s.substring(0, n);
      }
      if (fname === 'RIGHT') {
        const args = collectArgs();
        const s = String(args[0] ?? '');
        const n = Number(args[1] ?? 1);
        return s.substring(s.length - n);
      }
      if (fname === 'MID') {
        const args = collectArgs();
        const s = String(args[0] ?? '');
        const start = Number(args[1] ?? 1);
        const len = Number(args[2] ?? 1);
        return s.substring(start - 1, start - 1 + len);
      }
      if (fname === 'LEN') {
        const args = collectArgs();
        return String(args[0] ?? '').length;
      }
      if (fname === 'TRIM') {
        const args = collectArgs();
        return String(args[0] ?? '').trim();
      }
      if (fname === 'UPPER') {
        const args = collectArgs();
        return String(args[0] ?? '').toUpperCase();
      }
      if (fname === 'LOWER') {
        const args = collectArgs();
        return String(args[0] ?? '').toLowerCase();
      }
      if (fname === 'PROPER') {
        const args = collectArgs();
        return String(args[0] ?? '').replace(/\b\w/g, c => c.toUpperCase());
      }
      if (fname === 'FIND') {
        const args = collectArgs();
        const needle = String(args[0] ?? '');
        const haystack = String(args[1] ?? '');
        const start = Number(args[2] ?? 1);
        const idx = haystack.indexOf(needle, start - 1);
        return idx === -1 ? '#VALUE!' : idx + 1;
      }
      if (fname === 'SUBSTITUTE') {
        const args = collectArgs();
        const text = String(args[0] ?? '');
        const oldText = String(args[1] ?? '');
        const newText = String(args[2] ?? '');
        const instance = args[3] !== undefined ? Number(args[3]) : undefined;
        if (instance === undefined) return text.split(oldText).join(newText);
        let count = 0;
        return text.replace(new RegExp(oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), (match) => {
          count++;
          return count === instance ? newText : match;
        });
      }
      if (fname === 'TEXT') {
        const args = collectArgs();
        const val = Number(args[0] ?? 0);
        const fmt = String(args[1] ?? '');
        if (fmt.includes('yyyy') || fmt.includes('mm') || fmt.includes('dd')) {
          const d = new Date(val);
          return fmt
            .replace('yyyy', String(d.getFullYear()))
            .replace('mm', String(d.getMonth() + 1).padStart(2, '0'))
            .replace('dd', String(d.getDate()).padStart(2, '0'));
        }
        if (fmt.includes('#') || fmt.includes('0')) {
          const decimals = (fmt.split('.')[1] || '').length;
          return val.toFixed(decimals);
        }
        return String(val);
      }

      // Lookup functions
      if (fname === 'VLOOKUP') {
        const args = collectArgsGrouped();
        const lookupVal = (args[0] || [0])[0];
        const tableRange = args[1] || [];
        const colIdx = Number((args[2] || [1])[0]);
        const exactMatch = (args[3] || [0])[0];
        // Determine range dimensions from the range token
        // tableRange is flat values; we need to figure out columns
        // Re-parse: look back to find the range token
        // For simplicity, we need the range string. Let's get it from tokens before pos.
        // Actually we need the dimensions. Let's scan tokens for the range.
        let rangeCols = 1;
        for (let ti = 0; ti < tokens.length; ti++) {
          if (tokens[ti].type === 'range') {
            const [s, e] = tokens[ti].value.split(':');
            const sp = parseCellRef(s), ep = parseCellRef(e);
            if (sp && ep) { rangeCols = Math.abs(ep.col - sp.col) + 1; break; }
          }
        }
        const rows = Math.floor(tableRange.length / rangeCols);
        for (let r = 0; r < rows; r++) {
          const cellVal = tableRange[r * rangeCols];
          const match = exactMatch === 0 || String(exactMatch) === 'false'
            ? String(cellVal) === String(lookupVal)
            : String(cellVal) === String(lookupVal);
          if (match) {
            return colIdx - 1 < rangeCols ? tableRange[r * rangeCols + colIdx - 1] : '#REF!';
          }
        }
        return '#N/A';
      }

      if (fname === 'HLOOKUP') {
        const args = collectArgsGrouped();
        const lookupVal = (args[0] || [0])[0];
        const tableRange = args[1] || [];
        const rowIdx = Number((args[2] || [1])[0]);
        let rangeCols = 1;
        for (let ti = 0; ti < tokens.length; ti++) {
          if (tokens[ti].type === 'range') {
            const [s, e] = tokens[ti].value.split(':');
            const sp = parseCellRef(s), ep = parseCellRef(e);
            if (sp && ep) { rangeCols = Math.abs(ep.col - sp.col) + 1; break; }
          }
        }
        for (let c = 0; c < rangeCols; c++) {
          if (String(tableRange[c]) === String(lookupVal)) {
            const idx = (rowIdx - 1) * rangeCols + c;
            return idx < tableRange.length ? tableRange[idx] : '#REF!';
          }
        }
        return '#N/A';
      }

      if (fname === 'INDEX') {
        const args = collectArgsGrouped();
        const range = args[0] || [];
        const rowNum = Number((args[1] || [1])[0]);
        const colNum = Number((args[2] || [1])[0]);
        let rangeCols = 1;
        for (let ti = 0; ti < tokens.length; ti++) {
          if (tokens[ti].type === 'range') {
            const [s, e] = tokens[ti].value.split(':');
            const sp = parseCellRef(s), ep = parseCellRef(e);
            if (sp && ep) { rangeCols = Math.abs(ep.col - sp.col) + 1; break; }
          }
        }
        const idx = (rowNum - 1) * rangeCols + (colNum - 1);
        return idx >= 0 && idx < range.length ? range[idx] : '#REF!';
      }

      if (fname === 'MATCH') {
        const args = collectArgsGrouped();
        const lookupVal = (args[0] || [0])[0];
        const range = args[1] || [];
        for (let i = 0; i < range.length; i++) {
          if (String(range[i]) === String(lookupVal)) return i + 1;
        }
        return '#N/A';
      }

      // Conditional functions
      if (fname === 'COUNTIF') {
        const rangeToken = peek()?.type === 'range' ? next().value : null;
        const rangeVals = rangeToken ? getRangeValues(rangeToken) : [];
        if (peek()?.value === ',') next();
        const criteria = parseExpr();
        if (peek()?.value === ')') next();
        return countIf(rangeVals, criteria);
      }
      if (fname === 'SUMIF') {
        const rangeToken = peek()?.type === 'range' ? next().value : null;
        const rangeVals = rangeToken ? getRangeValues(rangeToken) : [];
        if (peek()?.value === ',') next();
        const criteria = parseExpr();
        if (peek()?.value === ',') next();
        const sumRangeToken = peek()?.type === 'range' ? next().value : null;
        const sumVals = sumRangeToken ? getRangeValues(sumRangeToken) : rangeVals;
        if (peek()?.value === ')') next();
        return sumIf(rangeVals, criteria, sumVals);
      }
      if (fname === 'AVERAGEIF') {
        const rangeToken = peek()?.type === 'range' ? next().value : null;
        const rangeVals = rangeToken ? getRangeValues(rangeToken) : [];
        if (peek()?.value === ',') next();
        const criteria = parseExpr();
        if (peek()?.value === ',') next();
        const sumRangeToken = peek()?.type === 'range' ? next().value : null;
        const sumVals = sumRangeToken ? getRangeValues(sumRangeToken) : rangeVals;
        if (peek()?.value === ')') next();
        let sum = 0, cnt = 0;
        for (let i = 0; i < rangeVals.length; i++) {
          if (matchesCriteria(rangeVals[i], criteria)) {
            sum += parseFloat(sumVals[i]) || 0;
            cnt++;
          }
        }
        return cnt ? sum / cnt : 0;
      }
      if (fname === 'COUNTIFS') {
        const pairs: { range: string[]; criteria: number | string }[] = [];
        while (peek() && peek()!.value !== ')') {
          const rt = peek()?.type === 'range' ? next().value : null;
          const rv = rt ? getRangeValues(rt) : [];
          if (peek()?.value === ',') next();
          const crit = parseExpr();
          pairs.push({ range: rv, criteria: crit });
          if (peek()?.value === ',') next();
        }
        if (peek()?.value === ')') next();
        if (!pairs.length) return 0;
        let cnt = 0;
        for (let i = 0; i < pairs[0].range.length; i++) {
          if (pairs.every(p => matchesCriteria(p.range[i] ?? '', p.criteria))) cnt++;
        }
        return cnt;
      }
      if (fname === 'SUMIFS') {
        const sumRangeToken = peek()?.type === 'range' ? next().value : null;
        const sumVals = sumRangeToken ? getRangeValues(sumRangeToken) : [];
        if (peek()?.value === ',') next();
        const pairs: { range: string[]; criteria: number | string }[] = [];
        while (peek() && peek()!.value !== ')') {
          const rt = peek()?.type === 'range' ? next().value : null;
          const rv = rt ? getRangeValues(rt) : [];
          if (peek()?.value === ',') next();
          const crit = parseExpr();
          pairs.push({ range: rv, criteria: crit });
          if (peek()?.value === ',') next();
        }
        if (peek()?.value === ')') next();
        let sum = 0;
        for (let i = 0; i < sumVals.length; i++) {
          if (pairs.every(p => matchesCriteria(p.range[i] ?? '', p.criteria))) {
            sum += parseFloat(sumVals[i]) || 0;
          }
        }
        return sum;
      }

      // Date
      if (fname === 'DATEDIF') {
        const args = collectArgs();
        const d1 = new Date(Number(args[0]));
        const d2 = new Date(Number(args[1]));
        const unit = String(args[2] ?? 'D').toUpperCase();
        const diffMs = d2.getTime() - d1.getTime();
        if (unit === 'D') return Math.floor(diffMs / 86400000);
        if (unit === 'M') return (d2.getFullYear() - d1.getFullYear()) * 12 + d2.getMonth() - d1.getMonth();
        if (unit === 'Y') return d2.getFullYear() - d1.getFullYear();
        return Math.floor(diffMs / 86400000);
      }

      // Logic
      if (fname === 'AND') {
        const args = collectArgs();
        return args.every(a => typeof a === 'number' ? a !== 0 : a !== '') ? 1 : 0;
      }
      if (fname === 'OR') {
        const args = collectArgs();
        return args.some(a => typeof a === 'number' ? a !== 0 : a !== '') ? 1 : 0;
      }
      if (fname === 'NOT') {
        const args = collectArgs();
        const v = args[0];
        return (typeof v === 'number' ? v === 0 : v === '') ? 1 : 0;
      }
      if (fname === 'ISBLANK') {
        // Need the raw value
        const args = collectArgs();
        return (args[0] === '' || args[0] === 0 || args[0] === undefined) ? 1 : 0;
      }
      if (fname === 'ISNA') {
        const args = collectArgs();
        return String(args[0]) === '#N/A' ? 1 : 0;
      }

      // Array functions
      if (fname === 'SEQUENCE') {
        const args = collectArgs();
        // Return first value for scalar context; array evaluation happens at higher level
        return Number(args[2] ?? 1);
      }

      if (fname === 'UNIQUE') {
        // In scalar context, return first unique value
        const rangeToken = peek()?.type === 'range' ? next().value : null;
        const vals = rangeToken ? getRangeValues(rangeToken) : [];
        if (peek()?.value === ')') next();
        const unique = [...new Set(vals.filter(v => v !== ''))];
        const n = parseFloat(unique[0] ?? '');
        return unique.length > 0 ? (isNaN(n) ? unique[0] : n) : '';
      }

      if (fname === 'SORT') {
        const rangeToken = peek()?.type === 'range' ? next().value : null;
        const vals = rangeToken ? getRangeValues(rangeToken).filter(v => v !== '') : [];
        if (peek()?.value === ',') next();
        if (peek() && peek()!.value !== ')') parseExpr(); // colIdx (consumed)
        if (peek()?.value === ',') next();
        const ascending = peek() && peek()!.value !== ')' ? parseExpr() : 1;
        if (peek()?.value === ')') next();
        const sorted = [...vals].sort((a, b) => {
          const na = parseFloat(a), nb = parseFloat(b);
          if (!isNaN(na) && !isNaN(nb)) return ascending ? na - nb : nb - na;
          return ascending ? a.localeCompare(b) : b.localeCompare(a);
        });
        const n = parseFloat(sorted[0] ?? '');
        return sorted.length > 0 ? (isNaN(n) ? sorted[0] : n) : '';
      }

      if (fname === 'FILTER') {
        const rangeToken = peek()?.type === 'range' ? next().value : null;
        const vals = rangeToken ? getRangeValues(rangeToken) : [];
        if (peek()?.value === ',') next();
        const condRangeToken = peek()?.type === 'range' ? next().value : null;
        const condVals = condRangeToken ? getRangeValues(condRangeToken) : [];
        if (peek()?.value === ',') next();
        const cond = peek() && peek()!.value !== ')' ? parseExpr() : '';
        if (peek()?.value === ')') next();
        const filtered = vals.filter((_, i) => {
          if (cond !== '') return matchesCriteria(condVals[i] ?? '', cond);
          return condVals[i] !== '' && condVals[i] !== '0' && condVals[i] !== 'FALSE';
        });
        const n = parseFloat(filtered[0] ?? '');
        return filtered.length > 0 ? (isNaN(n) ? filtered[0] : n) : ERRORS.NA;
      }

      if (fname === 'TRANSPOSE') {
        // In scalar context return first value
        const rangeToken = peek()?.type === 'range' ? next().value : null;
        if (rangeToken) {
          const vals = getRangeValues(rangeToken);
          if (peek()?.value === ')') next();
          const n = parseFloat(vals[0] ?? '');
          return vals.length > 0 ? (isNaN(n) ? vals[0] : n) : '';
        }
        if (peek()?.value === ')') next();
        return '';
      }

      if (fname === 'FLATTEN') {
        const rangeToken = peek()?.type === 'range' ? next().value : null;
        const vals = rangeToken ? getRangeValues(rangeToken).filter(v => v !== '') : [];
        if (peek()?.value === ')') next();
        const n = parseFloat(vals[0] ?? '');
        return vals.length > 0 ? (isNaN(n) ? vals[0] : n) : '';
      }

      if (fname === 'ARRAYFORMULA') {
        // In scalar context, just evaluate the inner expression
        const result = parseExpr();
        if (peek()?.value === ')') next();
        return result;
      }

      if (fname === 'MAP') {
        // MAP(range, operation) — simplified: apply operation string to each value
        const rangeToken = peek()?.type === 'range' ? next().value : null;
        const vals = rangeToken ? getRangeValues(rangeToken) : [];
        if (peek()?.value === ',') next();
        const op = peek() && peek()!.value !== ')' ? parseExpr() : '';
        if (peek()?.value === ')') next();
        // Return sum as scalar fallback
        if (String(op).toUpperCase() === 'SUM') return vals.reduce((s, v) => s + (parseFloat(v) || 0), 0);
        const n = parseFloat(vals[0] ?? '');
        return vals.length > 0 ? (isNaN(n) ? vals[0] : n) : '';
      }

      if (fname === 'REDUCE') {
        // REDUCE(initial, range, operation) — simplified
        const initialVal = parseExpr();
        if (peek()?.value === ',') next();
        const rangeToken = peek()?.type === 'range' ? next().value : null;
        const vals = rangeToken ? getRangeValues(rangeToken) : [];
        if (peek()?.value === ',') next();
        const op = peek() && peek()!.value !== ')' ? parseExpr() : '';
        if (peek()?.value === ')') next();
        const opStr = String(op).toUpperCase();
        let acc = typeof initialVal === 'number' ? initialVal : parseFloat(String(initialVal)) || 0;
        for (const v of vals) {
          const n = parseFloat(v) || 0;
          if (opStr === 'SUM' || opStr === '+') acc += n;
          else if (opStr === 'PRODUCT' || opStr === '*') acc *= n;
          else if (opStr === 'MAX') acc = Math.max(acc, n);
          else if (opStr === 'MIN') acc = Math.min(acc, n);
          else acc += n; // default to sum
        }
        return acc;
      }

      // SPARKLINE(range, chartType, color)
      if (fname === 'SPARKLINE') {
        const sparkData: number[] = [];
        // First arg: range or values
        if (peek()?.type === 'range') {
          const range = next().value;
          const refs = expandRange(range);
          for (const r of refs) {
            const v = parseFloat(get(r));
            sparkData.push(isNaN(v) ? 0 : v);
          }
        } else {
          const v = parseExpr();
          sparkData.push(typeof v === 'number' ? v : parseFloat(String(v)) || 0);
        }
        if (peek()?.value === ',') next();
        // Second arg: chart type (string)
        let chartType = 'line';
        if (peek() && peek()!.value !== ')') {
          const ct = parseExpr();
          chartType = String(ct);
          if (peek()?.value === ',') next();
        }
        // Third arg: color (string)
        let color = '#4285f4';
        if (peek() && peek()!.value !== ')') {
          const cc = parseExpr();
          color = String(cc);
        }
        if (peek()?.value === ')') next();
        return serializeSparkline({ type: 'sparkline', data: sparkData, chartType, color });
      }

      // LATEX("expression", val1, val2, ...) — evaluate LaTeX with positional args
      if (fname === 'LATEX') {
        const args = collectArgs();
        if (args.length < 1) return '#VALUE!';
        const latexStr = String(args[0]);
        const cellValues = args.slice(1).map(a => typeof a === 'number' ? a : parseFloat(String(a)) || 0);
        const result = evaluateLatexFormula(latexStr, cellValues);
        return result.result !== null ? result.result : '#VALUE!';
      }

      // Numeric functions (SUM, AVERAGE, etc.)
      const args: number[][] = [];
      while (peek() && peek()!.value !== ')') {
        if (peek()?.type === 'range') {
          const range = next().value;
          const refs = expandRange(range);
          args.push(refs.map(r => parseFloat(get(r)) || 0));
        } else {
          const v = parseExpr();
          args.push([typeof v === 'number' ? v : parseFloat(String(v)) || 0]);
        }
        if (peek()?.value === ',') next();
      }
      if (peek()?.value === ')') next();

      if (fname === 'NOW' || fname === 'TODAY' || fname === 'PI' || fname === 'RAND') return FUNCTIONS[fname]([]);
      const fn = FUNCTIONS[fname];
      return fn ? fn(args) : 0;
    }

    if (t.type === 'crossref') {
      next();
      if (!crossSheetGet) return ERRORS.REF;
      const parsed = parseCrossSheetRef(t.value);
      if (!parsed) return ERRORS.REF;
      const val = crossSheetGet(parsed.sheetName, parsed.cellRef);
      const num = parseFloat(val);
      return isNaN(num) ? val : num;
    }

    if (t.type === 'crossrange') {
      next();
      if (!crossSheetGet) return ERRORS.REF;
      const parsed = parseCrossSheetRef(t.value);
      if (!parsed) return ERRORS.REF;
      const refs = expandRange(parsed.cellRef);
      return refs.reduce((sum, r) => sum + (parseFloat(crossSheetGet(parsed.sheetName, r)) || 0), 0);
    }

    if (t.type === 'ref') {
      next();
      const val = get(t.value.toUpperCase());
      const num = parseFloat(val);
      return isNaN(num) ? val : num;
    }

    if (t.type === 'range') {
      next();
      const refs = expandRange(t.value);
      return refs.reduce((sum, r) => sum + (parseFloat(get(r)) || 0), 0);
    }

    next();
    return 0;
  }

  return parseExpr();
}

// Helper: criteria matching for COUNTIF/SUMIF etc
function matchesCriteria(cellVal: string, criteria: number | string): boolean {
  const cs = String(criteria);
  if (cs.startsWith('>=')) return (parseFloat(cellVal) || 0) >= parseFloat(cs.slice(2));
  if (cs.startsWith('<=')) return (parseFloat(cellVal) || 0) <= parseFloat(cs.slice(2));
  if (cs.startsWith('<>')) return cellVal !== cs.slice(2);
  if (cs.startsWith('>')) return (parseFloat(cellVal) || 0) > parseFloat(cs.slice(1));
  if (cs.startsWith('<')) return (parseFloat(cellVal) || 0) < parseFloat(cs.slice(1));
  if (cs.startsWith('=')) return cellVal === cs.slice(1);
  if (cs.includes('*') || cs.includes('?')) {
    const pattern = cs.replace(/\*/g, '.*').replace(/\?/g, '.');
    return new RegExp(`^${pattern}$`, 'i').test(cellVal);
  }
  return cellVal === cs || (parseFloat(cellVal) === parseFloat(cs) && !isNaN(parseFloat(cs)));
}

function countIf(rangeVals: string[], criteria: number | string): number {
  return rangeVals.filter(v => matchesCriteria(v, criteria)).length;
}

function sumIf(rangeVals: string[], criteria: number | string, sumVals: string[]): number {
  let sum = 0;
  for (let i = 0; i < rangeVals.length; i++) {
    if (matchesCriteria(rangeVals[i], criteria)) sum += parseFloat(sumVals[i]) || 0;
  }
  return sum;
}

// Resolve named ranges in a formula string before tokenization
export function resolveNamedRanges(formula: string, namedRanges: Record<string, string>): string {
  if (!namedRanges || Object.keys(namedRanges).length === 0) return formula;
  let resolved = formula;
  // Sort by length descending to avoid partial matches
  const names = Object.keys(namedRanges).sort((a, b) => b.length - a.length);
  for (const name of names) {
    // Replace name with its range value, case-insensitive, but only if not part of a larger identifier
    const pattern = new RegExp(`\\b${name}\\b`, 'gi');
    let rangeValue = namedRanges[name];
    // Strip sheet prefix if present (e.g. "Sheet1!A1:A50" -> "A1:A50") for same-sheet resolution
    if (rangeValue.includes('!')) {
      rangeValue = rangeValue.split('!')[1];
    }
    resolved = resolved.replace(pattern, rangeValue);
  }
  return resolved;
}

export function evaluateFormula(formula: string, get: CellGetter, namedRanges?: Record<string, string>, crossSheetGet?: CrossSheetGetter): string {
  try {
    let expr = formula.startsWith('=') ? formula.slice(1) : formula;
    if (namedRanges) {
      expr = resolveNamedRanges(expr, namedRanges);
    }
    const tokens = tokenize(expr);
    const result = evaluate(tokens, get, crossSheetGet);
    return String(result);
  } catch {
    return ERRORS.ERROR;
  }
}

// Evaluate an array formula and return 2D results
export function evaluateArrayFormula(
  formula: string,
  sourceCell: string,
  get: CellGetter,
  namedRanges?: Record<string, string>,
  crossSheetGet?: CrossSheetGetter
): ArrayResult | null {
  try {
    const stripped = stripArrayBraces(formula);
    const expr = stripped.startsWith('=') ? stripped.slice(1) : stripped;
    const resolved = namedRanges ? resolveNamedRanges(expr, namedRanges) : expr;

    // Check for SEQUENCE function
    const seqMatch = resolved.match(/^SEQUENCE\s*\((.+)\)$/i);
    if (seqMatch) {
      const args = seqMatch[1].split(',').map(s => parseFloat(s.trim()) || 1);
      const rows = args[0] || 1;
      const cols = args[1] || 1;
      const start = args[2] ?? 1;
      const step = args[3] ?? 1;
      const values: (number | string)[][] = [];
      let val = start;
      for (let r = 0; r < rows; r++) {
        const row: (number | string)[] = [];
        for (let c = 0; c < cols; c++) {
          row.push(val);
          val += step;
        }
        values.push(row);
      }
      return { values, sourceCell };
    }

    // Check for UNIQUE function
    const uniqueMatch = resolved.match(/^UNIQUE\s*\(([A-Z]+\d+:[A-Z]+\d+)\)$/i);
    if (uniqueMatch) {
      const refs = expandRange(uniqueMatch[1].toUpperCase());
      const vals = refs.map(r => get(r)).filter(v => v !== '');
      const unique = [...new Set(vals)];
      const values = unique.map(v => {
        const n = parseFloat(v);
        return [isNaN(n) ? v : n] as (number | string)[];
      });
      return { values, sourceCell };
    }

    // Check for SORT function
    const sortMatch = resolved.match(/^SORT\s*\(([A-Z]+\d+:[A-Z]+\d+)(?:\s*,\s*(\d+))?(?:\s*,\s*(\d+|TRUE|FALSE))?\)$/i);
    if (sortMatch) {
      const range2D = getRangeAs2D(sortMatch[1].toUpperCase(), get);
      const _colIdx = parseInt(sortMatch[2] ?? '1') - 1;
      const ascStr = (sortMatch[3] ?? '1').toUpperCase();
      const ascending = ascStr !== '0' && ascStr !== 'FALSE';
      const sorted = [...range2D.values].filter(row => row.some(v => v !== '')).sort((a, b) => {
        const va = a[_colIdx] ?? '', vb = b[_colIdx] ?? '';
        const na = typeof va === 'number' ? va : parseFloat(String(va));
        const nb = typeof vb === 'number' ? vb : parseFloat(String(vb));
        if (!isNaN(na) && !isNaN(nb)) return ascending ? na - nb : nb - na;
        return ascending ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
      });
      return { values: sorted, sourceCell };
    }

    // Check for TRANSPOSE function
    const transposeMatch = resolved.match(/^TRANSPOSE\s*\(([A-Z]+\d+:[A-Z]+\d+)\)$/i);
    if (transposeMatch) {
      const range2D = getRangeAs2D(transposeMatch[1].toUpperCase(), get);
      const transposed: (number | string)[][] = [];
      for (let c = 0; c < range2D.cols; c++) {
        const row: (number | string)[] = [];
        for (let r = 0; r < range2D.rows; r++) {
          row.push(range2D.values[r]?.[c] ?? '');
        }
        transposed.push(row);
      }
      return { values: transposed, sourceCell };
    }

    // Check for FLATTEN function
    const flattenMatch = resolved.match(/^FLATTEN\s*\(([A-Z]+\d+:[A-Z]+\d+)\)$/i);
    if (flattenMatch) {
      const refs = expandRange(flattenMatch[1].toUpperCase());
      const vals = refs.map(r => { const v = get(r); const n = parseFloat(v); return v === '' ? '' : isNaN(n) ? v : n; });
      return { values: vals.map(v => [v]), sourceCell };
    }

    // Check for FILTER function
    const filterMatch = resolved.match(/^FILTER\s*\(([A-Z]+\d+:[A-Z]+\d+)\s*,\s*([A-Z]+\d+:[A-Z]+\d+)\s*,\s*(.+)\)$/i);
    if (filterMatch) {
      const range2D = getRangeAs2D(filterMatch[1].toUpperCase(), get);
      const condRefs = expandRange(filterMatch[2].toUpperCase());
      const condVals = condRefs.map(r => get(r));
      const condExpr = filterMatch[3].trim();
      const filtered = range2D.values.filter((_, i) => matchesCriteria(condVals[i] ?? '', condExpr));
      if (filtered.length === 0) return { values: [[ERRORS.NA]], sourceCell };
      return { values: filtered, sourceCell };
    }

    // Range arithmetic: e.g. {=A1:A10*B1:B10}
    const rangeArith = resolved.match(/^([A-Z]+\d+:[A-Z]+\d+)\s*([+\-*/^])\s*([A-Z]+\d+:[A-Z]+\d+)$/i);
    if (rangeArith) {
      const refs1 = expandRange(rangeArith[1].toUpperCase());
      const op = rangeArith[2];
      const refs2 = expandRange(rangeArith[3].toUpperCase());
      const len = Math.max(refs1.length, refs2.length);
      const values: (number | string)[][] = [];
      for (let i = 0; i < len; i++) {
        const a = parseFloat(get(refs1[i] ?? '')) || 0;
        const b = parseFloat(get(refs2[i] ?? '')) || 0;
        let res: number;
        switch (op) {
          case '+': res = a + b; break;
          case '-': res = a - b; break;
          case '*': res = a * b; break;
          case '/': res = b !== 0 ? a / b : NaN; break;
          case '^': res = Math.pow(a, b); break;
          default: res = a + b;
        }
        values.push([isNaN(res) ? ERRORS.DIV0 : res]);
      }
      return { values, sourceCell };
    }

    // Fallback: evaluate as scalar
    const tokens = tokenize(resolved);
    const result = evaluate(tokens, get, crossSheetGet);
    return { values: [[typeof result === 'number' ? result : result]], sourceCell };
  } catch {
    return { values: [[ERRORS.ERROR]], sourceCell };
  }
}

// Check if an array formula result can spill without conflicts
export function checkSpillConflict(
  sourceCell: string,
  result: ArrayResult,
  existingCells: Record<string, { value: string; formula?: string }>
): string | null {
  const source = parseCellRef(sourceCell);
  if (!source) return null;
  for (let r = 0; r < result.values.length; r++) {
    for (let c = 0; c < (result.values[r]?.length ?? 0); c++) {
      if (r === 0 && c === 0) continue; // skip source cell
      const id = cellId(source.col + c, source.row + r);
      const existing = existingCells[id];
      if (existing && (existing.value !== '' || existing.formula)) {
        return id; // blocked by this cell
      }
    }
  }
  return null;
}

// Get all cells in a spill range from a source cell
export function getSpillRange(sourceCell: string, result: ArrayResult): string[] {
  const source = parseCellRef(sourceCell);
  if (!source) return [];
  const cells: string[] = [];
  for (let r = 0; r < result.values.length; r++) {
    for (let c = 0; c < (result.values[r]?.length ?? 0); c++) {
      cells.push(cellId(source.col + c, source.row + r));
    }
  }
  return cells;
}

// Check if formula contains volatile functions
export function isVolatile(formula: string): boolean {
  const upper = formula.toUpperCase();
  for (const fn of VOLATILE_FUNCTIONS) {
    if (upper.includes(fn + '(')) return true;
  }
  return false;
}

// Extract cross-sheet references from a formula
export function extractCrossSheetRefs(formula: string): { sheetName: string; refs: string[] }[] {
  const results: { sheetName: string; refs: string[] }[] = [];
  // Quoted: 'Sheet Name'!A1:B2 or 'Sheet Name'!A1
  const quotedPattern = /'([^']+)'!([A-Z]+\d+(?::[A-Z]+\d+)?)/gi;
  let m: RegExpExecArray | null;
  while ((m = quotedPattern.exec(formula)) !== null) {
    const cellRef = m[2].toUpperCase();
    const refs = cellRef.includes(':') ? expandRange(cellRef) : [cellRef];
    results.push({ sheetName: m[1], refs });
  }
  // Unquoted: Sheet1!A1:B2 or Sheet2!A1
  const unquotedPattern = /([A-Za-z0-9_]+)!([A-Z]+\d+(?::[A-Z]+\d+)?)/gi;
  while ((m = unquotedPattern.exec(formula)) !== null) {
    // Skip if it was already matched as part of a quoted ref
    if (formula[m.index - 1] === "'") continue;
    const cellRef = m[2].toUpperCase();
    const refs = cellRef.includes(':') ? expandRange(cellRef) : [cellRef];
    results.push({ sheetName: m[1], refs });
  }
  return results;
}

// Dependency graph for recalculation
export class DependencyGraph {
  private deps = new Map<string, Set<string>>();
  private rdeps = new Map<string, Set<string>>();

  setDependencies(cell: string, dependsOn: string[]) {
    const old = this.deps.get(cell);
    if (old) {
      for (const o of old) {
        this.rdeps.get(o)?.delete(cell);
      }
    }
    this.deps.set(cell, new Set(dependsOn));
    for (const d of dependsOn) {
      if (!this.rdeps.has(d)) this.rdeps.set(d, new Set());
      this.rdeps.get(d)!.add(cell);
    }
  }

  getDependents(cell: string): string[] {
    const visited = new Set<string>();
    const result: string[] = [];
    const visiting = new Set<string>();

    const visit = (c: string): boolean => {
      if (visiting.has(c)) return false;
      if (visited.has(c)) return true;
      visiting.add(c);
      const rdep = this.rdeps.get(c);
      if (rdep) {
        for (const r of rdep) {
          if (!visit(r)) return false;
        }
      }
      visiting.delete(c);
      visited.add(c);
      result.push(c);
      return true;
    };

    const rdep = this.rdeps.get(cell);
    if (rdep) {
      for (const r of rdep) {
        if (!visit(r)) return ['#CIRCULAR!'];
      }
    }
    return result;
  }

  hasCircular(cell: string, dependsOn: string[]): boolean {
    const visited = new Set<string>();
    const check = (c: string): boolean => {
      if (c === cell) return true;
      if (visited.has(c)) return false;
      visited.add(c);
      const deps = this.deps.get(c);
      if (deps) {
        for (const d of deps) {
          if (check(d)) return true;
        }
      }
      return false;
    };
    return dependsOn.some(d => check(d));
  }

  removeDependencies(cell: string) {
    const old = this.deps.get(cell);
    if (old) {
      for (const o of old) {
        this.rdeps.get(o)?.delete(cell);
      }
    }
    this.deps.delete(cell);
  }
}
