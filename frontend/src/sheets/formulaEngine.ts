// Formula engine with dependency tracking and circular reference detection

export type CellGetter = (ref: string) => string;

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
type Token = { type: 'number' | 'string' | 'ref' | 'range' | 'func' | 'op' | 'paren' | 'comma'; value: string };

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    if (expr[i] === ' ') { i++; continue; }
    if (expr[i] === '(' || expr[i] === ')') { tokens.push({ type: 'paren', value: expr[i] }); i++; continue; }
    if (expr[i] === ',') { tokens.push({ type: 'comma', value: ',' }); i++; continue; }
    if ('"\''.includes(expr[i])) {
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

// Simple recursive descent evaluator
function evaluate(tokens: Token[], get: CellGetter): number | string {
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
      left = op === '*' ? l * r : r !== 0 ? l / r : NaN;
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

export function evaluateFormula(formula: string, get: CellGetter): string {
  try {
    const expr = formula.startsWith('=') ? formula.slice(1) : formula;
    const tokens = tokenize(expr);
    const result = evaluate(tokens, get);
    return String(result);
  } catch {
    return '#ERROR!';
  }
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
