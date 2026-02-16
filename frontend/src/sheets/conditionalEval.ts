// Conditional formatting evaluation engine

import type React from 'react';

export type ConditionalRuleType = 'cellValue' | 'text' | 'colorScale' | 'dataBars' | 'iconSet';

export type CellValueOperator = 'gt' | 'lt' | 'between' | 'eq' | 'neq' | 'gte' | 'lte';
export type TextOperator = 'contains' | 'startsWith' | 'endsWith' | 'isExactly';
export type IconSetType = 'arrows' | 'circles';

export interface ConditionalStyle {
  textColor?: string;
  backgroundColor?: string;
  bold?: boolean;
  italic?: boolean;
}

export interface ConditionalRule {
  id: string;
  range: string; // e.g. "A1:C10"
  type: ConditionalRuleType;
  // cellValue
  operator?: CellValueOperator | TextOperator;
  values?: string[]; // 1 or 2 values
  style?: ConditionalStyle;
  // colorScale
  colorScaleColors?: string[]; // 2 or 3 hex colors
  // dataBars
  dataBarColor?: string;
  // iconSet
  iconSetType?: IconSetType;
  iconThresholds?: number[]; // 2 thresholds: [low, high]
}

export interface ValidationRuleType {
  type: 'number' | 'text' | 'list' | 'date' | 'custom';
  operator?: string;
  values?: string[];
  listItems?: string[];
  customFormula?: string;
  onInvalid: 'warning' | 'reject' | 'info';
  errorMessage?: string;
}

export interface ValidationRule {
  id: string;
  range: string;
  rule: ValidationRuleType;
}

// Parse range like "A1:C10" into {minCol, maxCol, minRow, maxRow}
function parseRange(range: string): { minCol: number; maxCol: number; minRow: number; maxRow: number } | null {
  const m = range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
  if (!m) return null;
  const colToIdx = (c: string) => {
    let idx = 0;
    for (let i = 0; i < c.length; i++) idx = idx * 26 + (c.toUpperCase().charCodeAt(i) - 64);
    return idx - 1;
  };
  return {
    minCol: colToIdx(m[1]),
    maxCol: colToIdx(m[3]),
    minRow: parseInt(m[2]) - 1,
    maxRow: parseInt(m[4]) - 1,
  };
}

export function isCellInRange(col: number, row: number, range: string): boolean {
  const r = parseRange(range);
  if (!r) return false;
  return col >= r.minCol && col <= r.maxCol && row >= r.minRow && row <= r.maxRow;
}

export function evaluateConditionalFormats(
  col: number,
  row: number,
  value: string,
  rules: ConditionalRule[],
  allValues?: number[] // all numeric values in range, for color scale/data bars
): { style: React.CSSProperties; icon?: string; dataBarWidth?: number } {
  const result: React.CSSProperties = {};
  let icon: string | undefined;
  let dataBarWidth: number | undefined;

  for (const rule of rules) {
    if (!isCellInRange(col, row, rule.range)) continue;

    const num = parseFloat(value);

    if (rule.type === 'cellValue' && rule.operator && rule.style) {
      const v1 = parseFloat(rule.values?.[0] ?? '');
      const v2 = parseFloat(rule.values?.[1] ?? '');
      let match = false;
      switch (rule.operator as CellValueOperator) {
        case 'gt': match = num > v1; break;
        case 'lt': match = num < v1; break;
        case 'gte': match = num >= v1; break;
        case 'lte': match = num <= v1; break;
        case 'eq': match = num === v1 || value === (rule.values?.[0] ?? ''); break;
        case 'neq': match = num !== v1 && value !== (rule.values?.[0] ?? ''); break;
        case 'between': match = num >= v1 && num <= v2; break;
      }
      if (match) {
        if (rule.style.textColor) result.color = rule.style.textColor;
        if (rule.style.backgroundColor) result.backgroundColor = rule.style.backgroundColor;
        if (rule.style.bold) result.fontWeight = 'bold';
        if (rule.style.italic) result.fontStyle = 'italic';
      }
    }

    if (rule.type === 'text' && rule.operator && rule.style) {
      const target = (rule.values?.[0] ?? '').toLowerCase();
      const val = value.toLowerCase();
      let match = false;
      switch (rule.operator as TextOperator) {
        case 'contains': match = val.includes(target); break;
        case 'startsWith': match = val.startsWith(target); break;
        case 'endsWith': match = val.endsWith(target); break;
        case 'isExactly': match = val === target; break;
      }
      if (match) {
        if (rule.style.textColor) result.color = rule.style.textColor;
        if (rule.style.backgroundColor) result.backgroundColor = rule.style.backgroundColor;
        if (rule.style.bold) result.fontWeight = 'bold';
        if (rule.style.italic) result.fontStyle = 'italic';
      }
    }

    if (rule.type === 'colorScale' && rule.colorScaleColors && allValues && allValues.length > 0 && !isNaN(num)) {
      const min = Math.min(...allValues);
      const max = Math.max(...allValues);
      const range = max - min || 1;
      const pct = (num - min) / range;
      const colors = rule.colorScaleColors;
      result.backgroundColor = interpolateColor(colors, pct);
    }

    if (rule.type === 'dataBars' && allValues && allValues.length > 0 && !isNaN(num)) {
      const max = Math.max(...allValues.map(Math.abs));
      dataBarWidth = max === 0 ? 0 : Math.round((Math.abs(num) / max) * 100);
    }

    if (rule.type === 'iconSet' && rule.iconThresholds && !isNaN(num)) {
      const [low, high] = rule.iconThresholds;
      if (rule.iconSetType === 'circles') {
        icon = num >= high ? '🟢' : num >= low ? '🟡' : '🔴';
      } else {
        icon = num >= high ? '↑' : num >= low ? '→' : '↓';
      }
    }
  }

  return { style: result, icon, dataBarWidth };
}

function interpolateColor(colors: string[], pct: number): string {
  const p = Math.max(0, Math.min(1, pct));
  if (colors.length === 2) {
    return lerpColor(colors[0], colors[1], p);
  }
  if (colors.length >= 3) {
    if (p <= 0.5) return lerpColor(colors[0], colors[1], p * 2);
    return lerpColor(colors[1], colors[2], (p - 0.5) * 2);
  }
  return colors[0];
}

function lerpColor(a: string, b: string, t: number): string {
  const pa = hexToRgb(a), pb = hexToRgb(b);
  const r = Math.round(pa.r + (pb.r - pa.r) * t);
  const g = Math.round(pa.g + (pb.g - pa.g) * t);
  const bl = Math.round(pa.b + (pb.b - pa.b) * t);
  return `rgb(${r},${g},${bl})`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16) || 0,
    g: parseInt(h.substring(2, 4), 16) || 0,
    b: parseInt(h.substring(4, 6), 16) || 0,
  };
}

// Data validation
export function validateCell(value: string, rule: ValidationRuleType): { valid: boolean; message?: string } {
  if (!value && value !== '0') return { valid: true }; // empty is ok

  switch (rule.type) {
    case 'number': {
      const num = parseFloat(value);
      if (isNaN(num)) return { valid: false, message: rule.errorMessage || 'Must be a number' };
      const v1 = parseFloat(rule.values?.[0] ?? '');
      const v2 = parseFloat(rule.values?.[1] ?? '');
      switch (rule.operator) {
        case 'between': if (num < v1 || num > v2) return { valid: false, message: rule.errorMessage || `Must be between ${v1} and ${v2}` }; break;
        case 'notBetween': if (num >= v1 && num <= v2) return { valid: false, message: rule.errorMessage || `Must not be between ${v1} and ${v2}` }; break;
        case 'gt': if (num <= v1) return { valid: false, message: rule.errorMessage || `Must be > ${v1}` }; break;
        case 'lt': if (num >= v1) return { valid: false, message: rule.errorMessage || `Must be < ${v1}` }; break;
        case 'eq': if (num !== v1) return { valid: false, message: rule.errorMessage || `Must equal ${v1}` }; break;
      }
      break;
    }
    case 'text': {
      switch (rule.operator) {
        case 'maxLength': {
          const max = parseInt(rule.values?.[0] ?? '0');
          if (value.length > max) return { valid: false, message: rule.errorMessage || `Max ${max} characters` };
          break;
        }
        case 'email': if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return { valid: false, message: rule.errorMessage || 'Invalid email' }; break;
        case 'url': if (!/^https?:\/\/.+/.test(value)) return { valid: false, message: rule.errorMessage || 'Invalid URL' }; break;
      }
      break;
    }
    case 'list': {
      if (rule.listItems && !rule.listItems.includes(value)) {
        return { valid: false, message: rule.errorMessage || 'Must select from list' };
      }
      break;
    }
    case 'date': {
      const d = new Date(value);
      if (isNaN(d.getTime())) return { valid: false, message: rule.errorMessage || 'Invalid date' };
      const v1 = rule.values?.[0] ? new Date(rule.values[0]) : null;
      const v2 = rule.values?.[1] ? new Date(rule.values[1]) : null;
      switch (rule.operator) {
        case 'before': if (v1 && d >= v1) return { valid: false, message: rule.errorMessage || `Must be before ${rule.values![0]}` }; break;
        case 'after': if (v1 && d <= v1) return { valid: false, message: rule.errorMessage || `Must be after ${rule.values![0]}` }; break;
        case 'between': if (v1 && v2 && (d < v1 || d > v2)) return { valid: false, message: rule.errorMessage || `Must be between dates` }; break;
      }
      break;
    }
    case 'custom': {
      // Simple: evaluate as JS expression with VALUE variable
      try {
        const formula = rule.customFormula?.replace(/^=/, '') ?? 'true';
        const fn = new Function('VALUE', `return !!(${formula})`);
        if (!fn(value)) return { valid: false, message: rule.errorMessage || 'Validation failed' };
      } catch {
        return { valid: false, message: 'Invalid formula' };
      }
      break;
    }
  }
  return { valid: true };
}

// Collect numeric values in a range from sheet cells
export function getNumericValuesInRange(
  range: string,
  cells: Record<string, { value: string; computed?: string }>
): number[] {
  const r = parseRange(range);
  if (!r) return [];
  const nums: number[] = [];
  for (let row = r.minRow; row <= r.maxRow; row++) {
    for (let col = r.minCol; col <= r.maxCol; col++) {
      const colStr = String.fromCharCode(65 + col);
      const id = `${colStr}${row + 1}`;
      const cell = cells[id];
      if (cell) {
        const n = parseFloat(cell.computed ?? cell.value);
        if (!isNaN(n)) nums.push(n);
      }
    }
  }
  return nums;
}
