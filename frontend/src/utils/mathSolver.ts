/**
 * mathSolver.ts — LaTeX-aware equation solver with variable substitution.
 * Uses math.js for robust expression evaluation after converting LaTeX to plain math.
 */
import { evaluate as mathEvaluate } from 'mathjs';

export interface SolveResult {
  result: number | null;
  substituted: string;
  missing: string[];
}

/**
 * Convert a LaTeX math string into a math.js-compatible expression string.
 */
export function latexToExpr(latex: string): string {
  let expr = latex.trim();

  // Remove display-mode delimiters
  expr = expr.replace(/^\$+/, '').replace(/\$+$/, '');
  expr = expr.replace(/^\\[(\[]/, '').replace(/\\[)\]]$/, '');

  // \left( and \right)
  expr = expr.replace(/\\left\s*([(\[{|])/g, '$1');
  expr = expr.replace(/\\right\s*([)\]}|])/g, '$1');

  // \cdot → *
  expr = expr.replace(/\\cdot/g, '*');
  // \times → *
  expr = expr.replace(/\\times/g, '*');
  // \div → /
  expr = expr.replace(/\\div/g, '/');
  // \pm → + (take positive branch)
  expr = expr.replace(/\\pm/g, '+');

  // \frac{a}{b} → ((a)/(b))
  // Handle nested fracs by repeating
  for (let i = 0; i < 10; i++) {
    const before = expr;
    expr = expr.replace(/\\frac\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g, '(($1)/($2))');
    if (expr === before) break;
  }

  // \sqrt[n]{x} → nthRoot(x, n)
  expr = expr.replace(/\\sqrt\s*\[([^\]]+)\]\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g, 'nthRoot($2, $1)');
  // \sqrt{x} → sqrt(x)
  expr = expr.replace(/\\sqrt\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g, 'sqrt($1)');

  // Trig / log functions: \sin, \cos, \tan, \log, \ln, \abs
  expr = expr.replace(/\\sin\s*/g, 'sin');
  expr = expr.replace(/\\cos\s*/g, 'cos');
  expr = expr.replace(/\\tan\s*/g, 'tan');
  expr = expr.replace(/\\arcsin\s*/g, 'asin');
  expr = expr.replace(/\\arccos\s*/g, 'acos');
  expr = expr.replace(/\\arctan\s*/g, 'atan');
  expr = expr.replace(/\\log\s*/g, 'log10');
  expr = expr.replace(/\\ln\s*/g, 'log');
  expr = expr.replace(/\\abs\s*\{([^{}]*)\}/g, 'abs($1)');
  expr = expr.replace(/\\exp\s*/g, 'exp');

  // Constants
  expr = expr.replace(/\\pi/g, 'pi');
  expr = expr.replace(/\\infty/g, 'Infinity');

  // Superscripts: x^{expr} or x^n (single char)
  // Already valid math.js syntax if we keep ^ — math.js uses ^ for power
  expr = expr.replace(/\^{([^{}]*)}/g, '^($1)');

  // Subscripts: strip them (often just labeling like x_1)
  expr = expr.replace(/_\{[^{}]*\}/g, '');
  expr = expr.replace(/_[a-zA-Z0-9]/g, '');

  // Remove remaining braces
  expr = expr.replace(/[{}]/g, '');

  // \, \; \! \quad — whitespace commands
  expr = expr.replace(/\\[,;!]\s*/g, ' ');
  expr = expr.replace(/\\quad\s*/g, ' ');
  expr = expr.replace(/\\qquad\s*/g, ' ');
  expr = expr.replace(/\\text\s*\{[^}]*\}/g, '');

  // Remove any remaining backslash commands we don't handle
  expr = expr.replace(/\\[a-zA-Z]+/g, '');

  // Implicit multiplication: number followed by letter, or ) followed by (, letter followed by (
  // 2x → 2*x, xy → x*y, )(  → )*(, 2( → 2*(
  expr = expr.replace(/(\d)([a-zA-Z])/g, '$1*$2');
  expr = expr.replace(/([a-zA-Z])(\d)/g, '$1*$2');
  expr = expr.replace(/(\))(\()/g, '$1*$2');
  expr = expr.replace(/(\d)(\()/g, '$1*$2');
  expr = expr.replace(/(\))([a-zA-Z])/g, '$1*$2');
  // letter followed by ( — but not if it's a function name
  const funcNames = new Set(['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'log', 'log10', 'sqrt', 'abs', 'exp', 'nthRoot', 'pi']);
  expr = expr.replace(/([a-zA-Z]+)(\()/g, (_, name, paren) => {
    if (funcNames.has(name)) return name + paren;
    // If single letter, it's implicit mult: x( → x*(
    if (name.length === 1) return name + '*' + paren;
    return name + paren;
  });

  // Clean up whitespace
  expr = expr.replace(/\s+/g, ' ').trim();

  return expr;
}

/**
 * Extract variable names (single lowercase/uppercase letters or short identifiers)
 * from a LaTeX expression, excluding known function/constant names.
 */
export function extractVariables(latex: string): string[] {
  const expr = latexToExpr(latex);
  const reserved = new Set([
    'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'log', 'log10',
    'sqrt', 'abs', 'exp', 'nthRoot', 'pi', 'e', 'Infinity', 'i',
  ]);

  const vars = new Set<string>();
  // Match variable-like tokens: single letters or short identifiers
  const tokens = expr.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
  for (const t of tokens) {
    if (!reserved.has(t) && !/^\d/.test(t)) {
      vars.add(t);
    }
  }
  return Array.from(vars).sort();
}

/**
 * Solve a LaTeX equation by substituting variables and evaluating.
 */
export function solveEquation(
  latex: string,
  variables: Record<string, number>
): SolveResult {
  try {
    const expr = latexToExpr(latex);
    const needed = extractVariables(latex);
    const missing = needed.filter(v => variables[v] === undefined && variables[v.toLowerCase()] === undefined);

    if (missing.length > 0) {
      // Build partial substitution string
      let substituted = expr;
      for (const [k, v] of Object.entries(variables)) {
        substituted = substituted.replace(new RegExp(`\\b${k}\\b`, 'g'), String(v));
      }
      return { result: null, substituted, missing };
    }

    // Build scope for math.js
    const scope: Record<string, number> = { ...variables };
    // Ensure 'e' is Euler's number if not a user variable
    if (scope['e'] === undefined) scope['e'] = Math.E;

    const result = mathEvaluate(expr, scope);
    const numResult = typeof result === 'number' ? result : Number(result);

    // Build substituted string showing variable replacements
    let substituted = expr;
    for (const v of needed) {
      const val = variables[v] ?? variables[v.toLowerCase()];
      if (val !== undefined) {
        substituted = substituted.replace(new RegExp(`\\b${v}\\b`, 'g'), String(val));
      }
    }

    return {
      result: isNaN(numResult) ? null : numResult,
      substituted,
      missing: [],
    };
  } catch (err) {
    return { result: null, substituted: latex, missing: [] };
  }
}

/**
 * Evaluate a LaTeX formula using cell references from a spreadsheet.
 * Maps positional alphabetical variables (a, b, c...) to provided values.
 */
export function evaluateLatexFormula(
  latex: string,
  cellValues: number[]
): SolveResult {
  const vars = extractVariables(latex).sort();
  const scope: Record<string, number> = {};
  for (let i = 0; i < vars.length && i < cellValues.length; i++) {
    scope[vars[i]] = cellValues[i];
  }
  return solveEquation(latex, scope);
}

/**
 * Format a numeric result for display — round to reasonable precision.
 */
export function formatResult(n: number): string {
  if (Number.isInteger(n)) return String(n);
  // Up to 6 decimal places, trim trailing zeros
  return parseFloat(n.toFixed(6)).toString();
}
