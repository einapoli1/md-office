// Cell formatting types and utilities

export type TextAlign = 'left' | 'center' | 'right';
export type NumberFormat = 'general' | 'number' | 'currency' | 'percentage' | 'date';
export type BorderStyle = 'none' | 'thin' | 'thick';

export interface CellBorders {
  top?: BorderStyle;
  right?: BorderStyle;
  bottom?: BorderStyle;
  left?: BorderStyle;
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
}

export interface MergeRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export function formatCellValue(value: string, format?: CellFormat): string {
  if (!format || !format.numberFormat || format.numberFormat === 'general') return value;
  const num = parseFloat(value);
  if (isNaN(num)) return value;

  switch (format.numberFormat) {
    case 'number':
      return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    case 'currency':
      return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    case 'percentage':
      return (num * 100).toFixed(2) + '%';
    case 'date': {
      const d = new Date(num);
      return isNaN(d.getTime()) ? value : d.toLocaleDateString();
    }
    default:
      return value;
  }
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
  if (format.borders) {
    const bw = (bs?: BorderStyle) => bs === 'thick' ? '2px solid #333' : bs === 'thin' ? '1px solid #333' : undefined;
    if (format.borders.top) s.borderTop = bw(format.borders.top);
    if (format.borders.right) s.borderRight = bw(format.borders.right);
    if (format.borders.bottom) s.borderBottom = bw(format.borders.bottom);
    if (format.borders.left) s.borderLeft = bw(format.borders.left);
  }
  return s;
}

// Needed for React.CSSProperties import in getCellStyle
import type React from 'react';
