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
function expandRange(range: string): string[] {
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
  
  // First expand ranges
  let m: RegExpExecArray | null;
  const rangePositions = new Set<number>();
  while ((m = rangePattern.exec(formula)) !== null) {
    refs.push(...expandRange(m[0]));
    for (let i = m.index; i < m.index + m[0].length; i++) rangePositions.add(i);
  }
  
  // Then individual refs not in ranges
  cellPattern.lastIndex = 0;
  while ((m = cellPattern.exec(formula)) !== null) {
    if (!rangePositions.has(m.index)) {
      refs.push(m[0]);
    }
  }
  return refs;
}

// Built-in functions
const FUNCTIONS: Record<string, (args: number[][]) => number | string> = {
  SUM: (args) => args.flat().reduce((a, b) => a + b, 0),
  AVERAGE: (args) => { const flat = args.flat(); return flat.reduce((a, b) => a + b, 0) / flat.length; },
  COUNT: (args) => args.flat().filter(v => !isNaN(v)).length,
  MIN: (args) => Math.min(...args.flat()),
  MAX: (args) => Math.max(...args.flat()),
  ABS: (args) => Math.abs(args.flat()[0]),
  ROUND: (args) => { const flat = args.flat(); return Math.round(flat[0] * Math.pow(10, flat[1] || 0)) / Math.pow(10, flat[1] || 0); },
  NOW: () => Date.now(),
  TODAY: () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); },
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
      i++; // skip closing quote
      tokens.push({ type: 'string', value: s });
      continue;
    }
    if ('+-*/^&=<>!'.includes(expr[i])) {
      let op = expr[i]; i++;
      if (i < expr.length && (expr[i] === '=' || (op === '<' && expr[i] === '>'))) { op += expr[i]; i++; }
      tokens.push({ type: 'op', value: op }); continue;
    }
    // Number
    if (/\d/.test(expr[i]) || (expr[i] === '.' && i + 1 < expr.length && /\d/.test(expr[i + 1]))) {
      let num = '';
      while (i < expr.length && /[\d.]/.test(expr[i])) { num += expr[i]; i++; }
      tokens.push({ type: 'number', value: num }); continue;
    }
    // Identifier (function name or cell ref or range)
    if (/[A-Za-z]/.test(expr[i])) {
      let id = '';
      while (i < expr.length && /[A-Za-z0-9_]/.test(expr[i])) { id += expr[i]; i++; }
      // Check for range
      if (i < expr.length && expr[i] === ':') {
        i++; // skip colon
        let id2 = '';
        while (i < expr.length && /[A-Za-z0-9]/.test(expr[i])) { id2 += expr[i]; i++; }
        tokens.push({ type: 'range', value: `${id.toUpperCase()}:${id2.toUpperCase()}` }); continue;
      }
      // Check if it's a function (followed by paren)
      const upper = id.toUpperCase();
      if (i < expr.length && expr[i] === '(' && upper in FUNCTIONS) {
        tokens.push({ type: 'func', value: upper }); continue;
      }
      // Check if it's IF or CONCATENATE
      if (i < expr.length && expr[i] === '(' && (upper === 'IF' || upper === 'CONCATENATE')) {
        tokens.push({ type: 'func', value: upper }); continue;
      }
      // Cell ref
      if (/^[A-Z]+\d+$/.test(upper)) {
        tokens.push({ type: 'ref', value: upper }); continue;
      }
      tokens.push({ type: 'ref', value: upper }); continue;
    }
    i++; // skip unknown
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

  function parsePrimary(): number | string {
    const t = peek();
    if (!t) return 0;

    if (t.type === 'number') { next(); return parseFloat(t.value); }
    if (t.type === 'string') { next(); return t.value; }

    if (t.type === 'paren' && t.value === '(') {
      next(); // skip (
      const val = parseExpr();
      if (peek()?.value === ')') next();
      return val;
    }

    if (t.type === 'func') {
      const fname = next().value;
      if (peek()?.value === '(') next(); // skip (
      
      if (fname === 'IF') {
        const cond = parseExpr();
        if (peek()?.value === ',') next();
        const trueVal = parseExpr();
        if (peek()?.value === ',') next();
        const falseVal = parseExpr();
        if (peek()?.value === ')') next();
        return (typeof cond === 'number' ? cond !== 0 : cond !== '') ? trueVal : falseVal;
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

      // Numeric functions
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

      if (fname === 'NOW' || fname === 'TODAY') return FUNCTIONS[fname]([]);
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
      // Standalone range — return sum
      next();
      const refs = expandRange(t.value);
      return refs.reduce((sum, r) => sum + (parseFloat(get(r)) || 0), 0);
    }

    next();
    return 0;
  }

  return parseExpr();
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
  private deps = new Map<string, Set<string>>(); // cell -> cells it depends on
  private rdeps = new Map<string, Set<string>>(); // cell -> cells that depend on it

  setDependencies(cell: string, dependsOn: string[]) {
    // Remove old reverse deps
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
    // Return topologically sorted list of all cells that need recalc
    const visited = new Set<string>();
    const result: string[] = [];
    const visiting = new Set<string>(); // for circular detection

    const visit = (c: string): boolean => {
      if (visiting.has(c)) return false; // circular!
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
        if (!visit(r)) {
          return ['#CIRCULAR!'];
        }
      }
    }
    return result;
  }

  hasCircular(cell: string, dependsOn: string[]): boolean {
    // Check if setting cell to depend on dependsOn would create a cycle
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
