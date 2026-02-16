// Rich cell type rendering components
import { useState } from 'react';
import type { CellFormat, NumberFormat } from './cellFormat';

interface CellTypeRendererProps {
  value: string;
  format?: CellFormat;
  onChange?: (value: string) => void;
}

/** Renders progress bar for progress-type cells */
function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const color = pct < 33 ? '#e74c3c' : pct < 66 ? '#f39c12' : '#27ae60';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%' }}>
      <div style={{ flex: 1, height: 14, background: '#eee', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.2s' }} />
      </div>
      <span style={{ fontSize: 11, color: '#666', minWidth: 30, textAlign: 'right' }}>{pct}%</span>
    </div>
  );
}

/** Renders boolean checkbox */
function BooleanCell({ value, onChange }: { value: boolean; onChange?: (v: string) => void }) {
  return (
    <input
      type="checkbox"
      checked={value}
      onChange={e => onChange?.(e.target.checked ? 'true' : 'false')}
      style={{ cursor: 'pointer', width: 16, height: 16 }}
    />
  );
}

/** Renders accounting format with red parentheses for negatives */
function AccountingCell({ value, format }: { value: number; format?: CellFormat }) {
  const sym = format?.currencySymbol || '$';
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const isNeg = value < 0;
  return (
    <span style={{
      color: isNeg ? '#cc0000' : undefined,
      fontFamily: 'monospace',
      display: 'inline-flex',
      width: '100%',
      justifyContent: 'flex-end',
    }}>
      {isNeg ? `${sym}(${formatted})` : `${sym} ${formatted} `}
    </span>
  );
}

/**
 * Rich cell type renderer. Returns JSX for special types (progress, boolean, accounting),
 * or null to fall back to default text rendering.
 */
export function CellTypeRenderer({ value, format, onChange }: CellTypeRendererProps): JSX.Element | null {
  if (!format?.numberFormat) return null;
  const num = parseFloat(value);

  switch (format.numberFormat) {
    case 'progress':
      return isNaN(num) ? null : <ProgressBar value={num} />;
    case 'boolean':
      return <BooleanCell value={value === 'true' || value === '1'} onChange={onChange} />;
    case 'accounting':
      return isNaN(num) ? null : <AccountingCell value={num} format={format} />;
    default:
      return null;
  }
}

/** Note indicator triangle (top-right corner) */
export function NoteIndicator({ note, onHover }: { note: string; onHover?: boolean }) {
  void onHover;
  return (
    <div
      title={note}
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: 0,
        height: 0,
        borderLeft: '6px solid transparent',
        borderTop: '6px solid #ff9800',
        cursor: 'help',
        zIndex: 1,
      }}
    />
  );
}

/** Number format dropdown with all format types and previews */
export interface NumberFormatDropdownProps {
  currentFormat: NumberFormat;
  sampleValue: string;
  onSelect: (format: NumberFormat, extra?: Partial<CellFormat>) => void;
  onCustomFormat?: () => void;
}

const FORMAT_OPTIONS: { value: NumberFormat; label: string; example: (v: number) => string }[] = [
  { value: 'general', label: 'General', example: v => String(v) },
  { value: 'number', label: 'Number', example: v => v.toLocaleString('en-US', { minimumFractionDigits: 2 }) },
  { value: 'currency', label: 'Currency ($)', example: v => v.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) },
  { value: 'accounting', label: 'Accounting', example: v => v < 0 ? `$(${Math.abs(v).toFixed(2)})` : `$ ${v.toFixed(2)}` },
  { value: 'percentage', label: 'Percentage', example: v => (v * 100).toFixed(1) + '%' },
  { value: 'scientific', label: 'Scientific', example: v => v.toExponential(2) },
  { value: 'fraction', label: 'Fraction', example: () => '1/4' },
  { value: 'date', label: 'Date', example: () => '02/16/2026' },
  { value: 'time', label: 'Time', example: () => '14:30' },
  { value: 'duration', label: 'Duration', example: () => '2h 30m' },
  { value: 'phone', label: 'Phone', example: () => '(555) 123-4567' },
  { value: 'rating', label: 'Rating', example: () => '★★★☆☆' },
  { value: 'progress', label: 'Progress', example: () => '75%' },
  { value: 'boolean', label: 'Checkbox', example: () => '☑' },
  { value: 'text', label: 'Text', example: v => String(v) },
];

export function NumberFormatDropdown({ currentFormat, sampleValue, onSelect, onCustomFormat }: NumberFormatDropdownProps) {
  const [open, setOpen] = useState(false);
  const num = parseFloat(sampleValue) || 1234.5;

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        className="sheet-tb-btn"
        onClick={() => setOpen(!open)}
        style={{ minWidth: 80, textAlign: 'left', fontSize: 11 }}
        title="Number format"
      >
        {FORMAT_OPTIONS.find(f => f.value === currentFormat)?.label || 'General'} ▾
      </button>
      {open && (
        <div
          style={{
            position: 'absolute', top: '100%', left: 0, background: '#fff',
            border: '1px solid #ccc', borderRadius: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            zIndex: 1000, padding: '4px 0', minWidth: 240, maxHeight: 400, overflowY: 'auto',
          }}
        >
          {FORMAT_OPTIONS.map(opt => (
            <div
              key={opt.value}
              onClick={() => { onSelect(opt.value); setOpen(false); }}
              style={{
                padding: '6px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between',
                background: opt.value === currentFormat ? '#e8f0fe' : undefined,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f0f0f0')}
              onMouseLeave={e => (e.currentTarget.style.background = opt.value === currentFormat ? '#e8f0fe' : '')}
            >
              <span>{opt.label}</span>
              <span style={{ color: '#888', fontSize: 11 }}>{opt.example(num)}</span>
            </div>
          ))}
          {onCustomFormat && (
            <>
              <div style={{ borderTop: '1px solid #eee', margin: '4px 0' }} />
              <div
                onClick={() => { onCustomFormat(); setOpen(false); }}
                style={{ padding: '6px 16px', cursor: 'pointer', fontStyle: 'italic' }}
              >
                Custom Format...
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
