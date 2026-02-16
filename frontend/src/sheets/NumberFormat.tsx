// Custom number format dialog (like Excel's Format Cells > Number)
import { useState, useMemo } from 'react';
import type { CellFormat, NumberFormat as NF } from './cellFormat';
import { formatCellValue } from './cellFormat';

interface NumberFormatDialogProps {
  currentFormat: CellFormat;
  sampleValue: string;
  onApply: (updates: Partial<CellFormat>) => void;
  onClose: () => void;
}

type Category = NF;

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'number', label: 'Number' },
  { value: 'currency', label: 'Currency' },
  { value: 'accounting', label: 'Accounting' },
  { value: 'date', label: 'Date' },
  { value: 'time', label: 'Time' },
  { value: 'percentage', label: 'Percentage' },
  { value: 'fraction', label: 'Fraction' },
  { value: 'scientific', label: 'Scientific' },
  { value: 'text', label: 'Text' },
  { value: 'custom', label: 'Custom' },
];

const DATE_FORMATS = ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD', 'MMM DD YYYY', 'relative'] as const;
const TIME_FORMATS = ['HH:MM', 'HH:MM:SS', '12h', '24h'] as const;
const CURRENCY_SYMBOLS = ['$', '€', '£', '¥'] as const;
const CUSTOM_PRESETS = ['#,##0', '#,##0.00', '$#,##0', '$#,##0.00', '0%', '0.00%', '[Red]#,##0', '0.00E+00'];

const RECENT_KEY = 'md-office-recent-formats';

function getRecentFormats(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
}
function addRecentFormat(fmt: string) {
  const list = getRecentFormats().filter(f => f !== fmt);
  list.unshift(fmt);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 10)));
}

export default function NumberFormatDialog({ currentFormat, sampleValue, onApply, onClose }: NumberFormatDialogProps) {
  const [category, setCategory] = useState<Category>(currentFormat.numberFormat || 'general');
  const [dateFormat, setDateFormat] = useState(currentFormat.dateFormat || 'MM/DD/YYYY');
  const [timeFormat, setTimeFormat] = useState(currentFormat.timeFormat || 'HH:MM');
  const [currencySymbol, setCurrencySymbol] = useState(currentFormat.currencySymbol || '$');
  const [customFormat, setCustomFormat] = useState(currentFormat.customFormat || '#,##0.00');
  const recentFormats = useMemo(() => getRecentFormats(), []);

  const preview = useMemo(() => {
    const fmt: CellFormat = {
      numberFormat: category,
      dateFormat, timeFormat,
      currencySymbol: currencySymbol as CellFormat['currencySymbol'],
      customFormat,
    };
    return formatCellValue(sampleValue || '1234.5', fmt);
  }, [category, dateFormat, timeFormat, currencySymbol, customFormat, sampleValue]);

  const handleApply = () => {
    const updates: Partial<CellFormat> = { numberFormat: category };
    if (category === 'date') updates.dateFormat = dateFormat;
    if (category === 'time') updates.timeFormat = timeFormat;
    if (category === 'currency' || category === 'accounting') {
      updates.currencySymbol = currencySymbol as CellFormat['currencySymbol'];
    }
    if (category === 'custom') {
      updates.customFormat = customFormat;
      addRecentFormat(customFormat);
    }
    onApply(updates);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
      background: '#fff', border: '1px solid #ccc', borderRadius: 8,
      boxShadow: '0 4px 20px rgba(0,0,0,0.2)', zIndex: 2000, width: 500, maxHeight: '80vh',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 20px 8px', borderBottom: '1px solid #eee' }}>
        <h3 style={{ margin: 0 }}>Format Cells — Number</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>✕</button>
      </div>

      {/* Preview */}
      <div style={{ padding: '8px 20px', background: '#f9f9f9', borderBottom: '1px solid #eee' }}>
        <div style={{ fontSize: 11, color: '#888' }}>Preview</div>
        <div style={{ fontSize: 16, fontFamily: 'monospace', padding: '4px 0' }}>{preview}</div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Category list */}
        <div style={{ width: 130, borderRight: '1px solid #eee', overflowY: 'auto', padding: '8px 0' }}>
          {CATEGORIES.map(cat => (
            <div
              key={cat.value}
              onClick={() => setCategory(cat.value)}
              style={{
                padding: '6px 16px', cursor: 'pointer', fontSize: 12,
                background: category === cat.value ? '#e8f0fe' : undefined,
                fontWeight: category === cat.value ? 600 : undefined,
              }}
            >
              {cat.label}
            </div>
          ))}
        </div>

        {/* Options */}
        <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
          {category === 'general' && <p style={{ fontSize: 12, color: '#666' }}>General format cells have no specific number format.</p>}

          {category === 'number' && (
            <p style={{ fontSize: 12, color: '#666' }}>Numbers formatted with two decimal places and thousand separators.</p>
          )}

          {(category === 'currency' || category === 'accounting') && (
            <div>
              <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Symbol:</label>
              <div style={{ display: 'flex', gap: 4 }}>
                {CURRENCY_SYMBOLS.map(s => (
                  <button
                    key={s}
                    className={`sheet-tb-btn ${currencySymbol === s ? 'active' : ''}`}
                    onClick={() => setCurrencySymbol(s)}
                    style={{ fontSize: 14, width: 36 }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {category === 'date' && (
            <div>
              <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Date format:</label>
              {DATE_FORMATS.map(df => {
                const p = formatCellValue(sampleValue || String(Date.now()), { numberFormat: 'date', dateFormat: df });
                return (
                  <div
                    key={df}
                    onClick={() => setDateFormat(df)}
                    style={{
                      padding: '6px 8px', cursor: 'pointer', fontSize: 12, borderRadius: 3,
                      background: dateFormat === df ? '#e8f0fe' : undefined,
                      display: 'flex', justifyContent: 'space-between',
                    }}
                  >
                    <span>{df}</span>
                    <span style={{ color: '#888' }}>{p}</span>
                  </div>
                );
              })}
            </div>
          )}

          {category === 'time' && (
            <div>
              <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Time format:</label>
              {TIME_FORMATS.map(tf => (
                <div
                  key={tf}
                  onClick={() => setTimeFormat(tf)}
                  style={{
                    padding: '6px 8px', cursor: 'pointer', fontSize: 12, borderRadius: 3,
                    background: timeFormat === tf ? '#e8f0fe' : undefined,
                  }}
                >
                  {tf}
                </div>
              ))}
            </div>
          )}

          {category === 'percentage' && <p style={{ fontSize: 12, color: '#666' }}>Multiplies the cell value by 100 and displays with a percent sign.</p>}
          {category === 'fraction' && <p style={{ fontSize: 12, color: '#666' }}>Displays as a fraction (e.g., 1/4).</p>}
          {category === 'scientific' && <p style={{ fontSize: 12, color: '#666' }}>Scientific notation (e.g., 1.23E+03).</p>}
          {category === 'text' && <p style={{ fontSize: 12, color: '#666' }}>Treats the cell value as text, even if it looks like a number.</p>}

          {category === 'custom' && (
            <div>
              <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Custom format:</label>
              <input
                type="text"
                value={customFormat}
                onChange={e => setCustomFormat(e.target.value)}
                style={{ width: '100%', padding: '6px 8px', fontSize: 12, border: '1px solid #ccc', borderRadius: 3, fontFamily: 'monospace' }}
                placeholder="#,##0.00"
              />
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Presets:</div>
                {CUSTOM_PRESETS.map(p => (
                  <div
                    key={p}
                    onClick={() => setCustomFormat(p)}
                    style={{ padding: '4px 8px', cursor: 'pointer', fontSize: 11, fontFamily: 'monospace', borderRadius: 3 }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f0f0f0')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    {p}
                  </div>
                ))}
              </div>
              {recentFormats.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Recent:</div>
                  {recentFormats.map(r => (
                    <div
                      key={r}
                      onClick={() => setCustomFormat(r)}
                      style={{ padding: '4px 8px', cursor: 'pointer', fontSize: 11, fontFamily: 'monospace', borderRadius: 3 }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f0f0f0')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}
                    >
                      {r}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button onClick={onClose} style={{ padding: '6px 16px', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
        <button onClick={handleApply} style={{ padding: '6px 16px', fontSize: 12, cursor: 'pointer', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 4 }}>Apply</button>
      </div>
    </div>
  );
}
