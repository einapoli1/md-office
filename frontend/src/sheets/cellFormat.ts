// Cell formatting types and utilities

export type TextAlign = 'left' | 'center' | 'right';
export type NumberFormat = 'general' | 'number' | 'currency' | 'percentage' | 'date'
  | 'accounting' | 'time' | 'fraction' | 'scientific' | 'text' | 'custom'
  | 'phone' | 'rating' | 'progress' | 'boolean' | 'duration';
export type BorderStyle = 'none' | 'thin' | 'thick';
export type BorderLineStyle = 'solid' | 'dashed' | 'dotted' | 'double';
export type TextOverflow = 'wrap' | 'overflow' | 'clip';

export interface CellBorderSide {
  style?: BorderStyle;
  lineStyle?: BorderLineStyle;
  color?: string;
}

export interface CellBorders {
  top?: BorderStyle | CellBorderSide;
  right?: BorderStyle | CellBorderSide;
  bottom?: BorderStyle | CellBorderSide;
  left?: BorderStyle | CellBorderSide;
  diagonal?: { style: BorderStyle; lineStyle?: BorderLineStyle; color?: string };
}

export interface CellFormat {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  fontFamily?: string;
  fontSize?: number;
  textColor?: string;
  backgroundColor?: string;
  textAlign?: TextAlign;
  numberFormat?: NumberFormat;
  borders?: CellBorders;
  wrap?: boolean;
  // Extended formatting
  currencySymbol?: '$' | '€' | '£' | '¥';
  dateFormat?: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'MMM DD YYYY' | 'relative';
  timeFormat?: 'HH:MM' | 'HH:MM:SS' | '12h' | '24h';
  customFormat?: string;
  textRotation?: number; // degrees: 0, 45, 90, -45, 270 (vertical)
  textOverflow?: TextOverflow;
  indentLevel?: number;
  note?: string;
}

export interface MergeRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export function formatCellValue(value: string, format?: CellFormat): string {
  if (!format || !format.numberFormat || format.numberFormat === 'general') return value;
  if (format.numberFormat === 'text') return value;

  const num = parseFloat(value);

  switch (format.numberFormat) {
    case 'number':
      return isNaN(num) ? value : num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    case 'currency': {
      if (isNaN(num)) return value;
      const sym = format.currencySymbol || '$';
      const currMap: Record<string, { currency: string; locale: string }> = {
        '$': { currency: 'USD', locale: 'en-US' },
        '€': { currency: 'EUR', locale: 'de-DE' },
        '£': { currency: 'GBP', locale: 'en-GB' },
        '¥': { currency: 'JPY', locale: 'ja-JP' },
      };
      const cfg = currMap[sym] || currMap['$'];
      return num.toLocaleString(cfg.locale, { style: 'currency', currency: cfg.currency });
    }
    case 'accounting': {
      if (isNaN(num)) return value;
      const sym = format.currencySymbol || '$';
      const abs = Math.abs(num);
      const formatted = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return num < 0 ? `${sym}(${formatted})` : `${sym} ${formatted} `;
    }
    case 'percentage':
      return isNaN(num) ? value : (num * 100).toFixed(1) + '%';
    case 'date': {
      // Try parsing as number (epoch) or string
      const d = isNaN(num) ? new Date(value) : new Date(num);
      if (isNaN(d.getTime())) return value;
      const df = format.dateFormat || 'MM/DD/YYYY';
      if (df === 'relative') return formatRelativeDate(d);
      return formatDateStr(d, df);
    }
    case 'time': {
      const d = isNaN(num) ? new Date(value) : new Date(num);
      if (isNaN(d.getTime())) return value;
      const tf = format.timeFormat || 'HH:MM';
      return formatTimeStr(d, tf);
    }
    case 'phone':
      return formatPhone(value);
    case 'rating': {
      if (isNaN(num)) return value;
      const stars = Math.max(0, Math.min(5, Math.round(num)));
      return '★'.repeat(stars) + '☆'.repeat(5 - stars);
    }
    case 'progress':
      // Rendered as HTML in CellTypes component; return raw for text contexts
      return isNaN(num) ? value : `${Math.round(Math.max(0, Math.min(100, num)))}%`;
    case 'boolean':
      return (value === 'true' || value === '1') ? '☑' : '☐';
    case 'duration': {
      if (isNaN(num)) return value;
      const totalSec = Math.abs(Math.round(num));
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      const parts: string[] = [];
      if (h > 0) parts.push(`${h}h`);
      if (m > 0) parts.push(`${m}m`);
      if (s > 0 || parts.length === 0) parts.push(`${s}s`);
      return parts.join(' ');
    }
    case 'fraction':
      return isNaN(num) ? value : toFraction(num);
    case 'scientific':
      return isNaN(num) ? value : num.toExponential(2);
    case 'custom':
      return isNaN(num) ? value : applyCustomFormat(num, format.customFormat || '#,##0');
    default:
      return value;
  }
}

function formatRelativeDate(d: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.round(diffMs / 86400000);
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays === -1) return 'tomorrow';
  if (diffDays > 0 && diffDays < 30) return `${diffDays} days ago`;
  if (diffDays < 0 && diffDays > -30) return `in ${-diffDays} days`;
  return d.toLocaleDateString();
}

function formatDateStr(d: Date, fmt: string): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  switch (fmt) {
    case 'MM/DD/YYYY': return `${mm}/${dd}/${yyyy}`;
    case 'DD/MM/YYYY': return `${dd}/${mm}/${yyyy}`;
    case 'YYYY-MM-DD': return `${yyyy}-${mm}-${dd}`;
    case 'MMM DD YYYY': return `${months[d.getMonth()]} ${dd} ${yyyy}`;
    default: return d.toLocaleDateString();
  }
}

function formatTimeStr(d: Date, fmt: string): string {
  const h24 = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  if (fmt === '12h') {
    const ampm = h24 >= 12 ? 'PM' : 'AM';
    const h12 = h24 % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  }
  const hh = String(h24).padStart(2, '0');
  if (fmt === 'HH:MM:SS' || fmt === '24h') return `${hh}:${m}:${s}`;
  return `${hh}:${m}`;
}

function formatPhone(v: string): string {
  const digits = v.replace(/\D/g, '');
  if (digits.length === 10) return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits[0] === '1') return `+1 (${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`;
  return v;
}

function toFraction(n: number): string {
  const whole = Math.floor(n);
  let frac = n - whole;
  if (Math.abs(frac) < 0.0001) return String(whole);
  // Simple fraction approximation
  let bestNum = 1, bestDen = 1, bestErr = Math.abs(frac - 1);
  for (let den = 2; den <= 16; den++) {
    const num = Math.round(frac * den);
    const err = Math.abs(frac - num / den);
    if (err < bestErr) { bestNum = num; bestDen = den; bestErr = err; }
  }
  return whole ? `${whole} ${bestNum}/${bestDen}` : `${bestNum}/${bestDen}`;
}

function applyCustomFormat(num: number, fmt: string): string {
  // Simplified Excel-like custom format
  const isNeg = num < 0;
  const absNum = Math.abs(num);
  let red = false;
  let pattern = fmt;
  if (pattern.startsWith('[Red]')) { red = true; pattern = pattern.slice(5); }
  // Count decimal places
  const decMatch = pattern.match(/\.(0+)/);
  const decimals = decMatch ? decMatch[1].length : 0;
  const useComma = pattern.includes(',');
  const prefix = pattern.match(/^([^#0,.]*)/) ? pattern.match(/^([^#0,.]+)/)?.[1] || '' : '';
  const suffix = pattern.match(/([^#0,.]*)$/) ? pattern.match(/([^#0,.]+)$/)?.[1] || '' : '';
  let result = useComma
    ? absNum.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : absNum.toFixed(decimals);
  result = prefix + result + suffix;
  if (isNeg && red) result = `(${result})`;
  else if (isNeg) result = `-${result}`;
  void red; // red styling handled by component
  return result;
}

export function getBorderCSS(side?: BorderStyle | CellBorderSide): string | undefined {
  if (!side) return undefined;
  if (typeof side === 'string') {
    return side === 'thick' ? '2px solid #333' : side === 'thin' ? '1px solid #333' : undefined;
  }
  if (!side.style || side.style === 'none') return undefined;
  const width = side.style === 'thick' ? '2px' : '1px';
  const ls = side.lineStyle || 'solid';
  const color = side.color || '#333';
  return `${width} ${ls} ${color}`;
}

export function getCellStyle(format?: CellFormat): React.CSSProperties {
  if (!format) return {};
  const s: React.CSSProperties = {};
  if (format.bold) s.fontWeight = 'bold';
  if (format.italic) s.fontStyle = 'italic';
  if (format.underline) s.textDecoration = 'underline';
  if (format.strikethrough) s.textDecoration = (s.textDecoration ? s.textDecoration + ' ' : '') + 'line-through';
  if (format.fontFamily) s.fontFamily = format.fontFamily;
  if (format.fontSize) s.fontSize = format.fontSize + 'px';
  if (format.textColor) s.color = format.textColor;
  if (format.backgroundColor) s.backgroundColor = format.backgroundColor;
  if (format.textAlign) s.textAlign = format.textAlign;
  if (format.wrap) s.whiteSpace = 'normal';
  else if (format.textOverflow === 'clip') { s.whiteSpace = 'nowrap'; s.overflow = 'hidden'; }
  else if (format.textOverflow === 'overflow') { s.whiteSpace = 'nowrap'; s.overflow = 'visible'; }
  if (format.borders) {
    s.borderTop = getBorderCSS(format.borders.top);
    s.borderRight = getBorderCSS(format.borders.right);
    s.borderBottom = getBorderCSS(format.borders.bottom);
    s.borderLeft = getBorderCSS(format.borders.left);
  }
  if (format.textRotation) {
    const deg = format.textRotation === 270 ? 90 : format.textRotation;
    s.transform = `rotate(${deg}deg)`;
    if (format.textRotation === 270) s.writingMode = 'vertical-rl';
  }
  if (format.indentLevel && format.indentLevel > 0) {
    s.paddingLeft = `${format.indentLevel * 12}px`;
  }
  // Accounting format: negative in red
  if (format.numberFormat === 'accounting') {
    // Color handled by CellTypes renderer
  }
  return s;
}

// Needed for React.CSSProperties import in getCellStyle
import type React from 'react';
