// Conditional Formatting Dialog — Polished UI with drag-to-reorder, preview, custom formula

import { useState, useCallback, useRef } from 'react';
import type { ConditionalRule, ConditionalRuleType, CellValueOperator, TextOperator, IconSetType, ConditionalStyle } from './conditionalEval';

interface ConditionalFormatDialogProps {
  existingRules: ConditionalRule[];
  selectedRange: string;
  onSave: (rules: ConditionalRule[]) => void;
  onClose: () => void;
}

const CELL_VALUE_OPS: { value: CellValueOperator; label: string }[] = [
  { value: 'gt', label: 'Greater than' },
  { value: 'lt', label: 'Less than' },
  { value: 'gte', label: 'Greater than or equal' },
  { value: 'lte', label: 'Less than or equal' },
  { value: 'eq', label: 'Equal to' },
  { value: 'neq', label: 'Not equal to' },
  { value: 'between', label: 'Between' },
];

const TEXT_OPS: { value: TextOperator; label: string }[] = [
  { value: 'contains', label: 'Contains' },
  { value: 'startsWith', label: 'Starts with' },
  { value: 'endsWith', label: 'Ends with' },
  { value: 'isExactly', label: 'Is exactly' },
];

const PRESET_STYLES: { label: string; style: ConditionalStyle }[] = [
  { label: 'Red fill', style: { backgroundColor: '#f4c7c3', textColor: '#a50e0e' } },
  { label: 'Yellow fill', style: { backgroundColor: '#fce8b2', textColor: '#7f6003' } },
  { label: 'Green fill', style: { backgroundColor: '#b7e1cd', textColor: '#0d652d' } },
  { label: 'Blue fill', style: { backgroundColor: '#c6dafc', textColor: '#1a43a8' } },
  { label: 'Bold red text', style: { textColor: '#cc0000', bold: true } },
  { label: 'Bold green text', style: { textColor: '#0b8043', bold: true } },
];

export default function ConditionalFormatDialog({ existingRules, selectedRange, onSave, onClose }: ConditionalFormatDialogProps) {
  const [rules, setRules] = useState<ConditionalRule[]>([...existingRules]);
  const [editingRule, setEditingRule] = useState<ConditionalRule | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const createNew = () => {
    setEditingRule({
      id: `cf_${Date.now()}`,
      range: selectedRange,
      type: 'cellValue',
      operator: 'gt',
      values: ['0'],
      style: { backgroundColor: '#f4c7c3', textColor: '#a50e0e' },
    });
  };

  const saveRule = (rule: ConditionalRule) => {
    const idx = rules.findIndex(r => r.id === rule.id);
    const newRules = [...rules];
    if (idx >= 0) newRules[idx] = rule;
    else newRules.push(rule);
    setRules(newRules);
    setEditingRule(null);
  };

  const deleteRule = (id: string) => {
    setRules(rules.filter(r => r.id !== id));
  };

  const handleDragStart = useCallback((idx: number) => {
    setDragIdx(idx);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  }, []);

  const handleDrop = useCallback((targetIdx: number) => {
    if (dragIdx === null || dragIdx === targetIdx) { setDragIdx(null); setDragOverIdx(null); return; }
    const newRules = [...rules];
    const [moved] = newRules.splice(dragIdx, 1);
    newRules.splice(targetIdx, 0, moved);
    setRules(newRules);
    setDragIdx(null);
    setDragOverIdx(null);
  }, [dragIdx, rules]);

  const handleDragEnd = useCallback(() => {
    setDragIdx(null);
    setDragOverIdx(null);
  }, []);

  const duplicateRule = (rule: ConditionalRule) => {
    const dup = { ...rule, id: `cf_${Date.now()}`, style: rule.style ? { ...rule.style } : undefined };
    setRules([...rules, dup]);
  };

  const getRuleDescription = (rule: ConditionalRule): string => {
    switch (rule.type) {
      case 'cellValue': {
        const op = CELL_VALUE_OPS.find(o => o.value === rule.operator);
        if (rule.operator === 'between') return `Value between ${rule.values?.[0] ?? ''} and ${rule.values?.[1] ?? ''}`;
        return `Value ${op?.label.toLowerCase() ?? rule.operator} ${rule.values?.[0] ?? ''}`;
      }
      case 'text': {
        const op = TEXT_OPS.find(o => o.value === rule.operator);
        return `Text ${op?.label.toLowerCase() ?? rule.operator} "${rule.values?.[0] ?? ''}"`;
      }
      case 'customFormula': return `Formula: ${rule.customFormula ?? ''}`;
      case 'colorScale': return `Color scale (${rule.colorScaleColors?.length ?? 3} colors)`;
      case 'dataBars': return `Data bars`;
      case 'iconSet': return `Icon set (${rule.iconSetType ?? 'arrows'})`;
      default: return rule.type;
    }
  };

  return (
    <div className="cf-dialog-overlay" onClick={onClose}>
      <div className="cf-dialog cf-dialog-polished" onClick={e => e.stopPropagation()}>
        <div className="cf-dialog-header">
          <h3>Conditional Formatting Rules</h3>
          <button className="cf-close-btn" onClick={onClose}>✕</button>
        </div>

        {editingRule ? (
          <RuleEditor rule={editingRule} onSave={saveRule} onCancel={() => setEditingRule(null)} />
        ) : (
          <div className="cf-dialog-body">
            <p className="cf-hint">Rules are applied in order from top to bottom. Drag to reorder priority.</p>
            <div className="cf-rules-list">
              {rules.length === 0 && <div className="cf-empty">No rules yet. Click "Add Rule" below.</div>}
              {rules.map((rule, idx) => (
                <div
                  key={rule.id}
                  className={`cf-rule-item ${dragOverIdx === idx ? 'cf-rule-drag-over' : ''} ${dragIdx === idx ? 'cf-rule-dragging' : ''}`}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={() => handleDrop(idx)}
                  onDragEnd={handleDragEnd}
                >
                  <span className="cf-rule-grip">⠿</span>
                  <div className="cf-rule-info">
                    <div className="cf-rule-desc">{getRuleDescription(rule)}</div>
                    <div className="cf-rule-meta">
                      <span className="cf-rule-range-badge">{rule.range}</span>
                      {rule.style && (
                        <span
                          className="cf-rule-preview-pill"
                          style={{
                            backgroundColor: rule.style.backgroundColor || '#fff',
                            color: rule.style.textColor || '#000',
                            fontWeight: rule.style.bold ? 'bold' : 'normal',
                            fontStyle: rule.style.italic ? 'italic' : 'normal',
                          }}
                        >Abc</span>
                      )}
                      {rule.type === 'colorScale' && rule.colorScaleColors && (
                        <span className="cf-color-scale-preview">
                          {rule.colorScaleColors.map((c, i) => (
                            <span key={i} style={{ backgroundColor: c }} className="cf-cs-dot" />
                          ))}
                        </span>
                      )}
                      {rule.type === 'dataBars' && (
                        <span className="cf-databar-preview" style={{ backgroundColor: rule.dataBarColor || '#4285f4' }} />
                      )}
                      {rule.type === 'iconSet' && (
                        <span className="cf-icon-preview">{rule.iconSetType === 'circles' ? '🟢🟡🔴' : '↑→↓'}</span>
                      )}
                    </div>
                  </div>
                  <div className="cf-rule-actions">
                    <button className="cf-action-btn" onClick={() => setEditingRule({ ...rule })} title="Edit">✏️</button>
                    <button className="cf-action-btn" onClick={() => duplicateRule(rule)} title="Duplicate">📋</button>
                    <button className="cf-action-btn cf-action-delete" onClick={() => deleteRule(rule.id)} title="Delete">🗑</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="cf-dialog-footer">
              <button className="cf-add-btn" onClick={createNew}>+ Add Rule</button>
              <div className="cf-footer-right">
                <button className="cf-btn-cancel" onClick={onClose}>Cancel</button>
                <button className="cf-save-btn" onClick={() => onSave(rules)}>Done</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RuleEditor({ rule, onSave, onCancel }: { rule: ConditionalRule; onSave: (r: ConditionalRule) => void; onCancel: () => void }) {
  const [type, setType] = useState<ConditionalRuleType>(rule.type);
  const [operator, setOperator] = useState(rule.operator || 'gt');
  const [values, setValues] = useState<string[]>(rule.values || ['0']);
  const [style, setStyle] = useState<ConditionalStyle>(rule.style || { backgroundColor: '#f4c7c3' });
  const [range, setRange] = useState(rule.range);
  const [customFormula, setCustomFormula] = useState(rule.customFormula || '');
  const [colorScaleColors, setColorScaleColors] = useState<string[]>(rule.colorScaleColors || ['#f44336', '#ffeb3b', '#4caf50']);
  const [colorScaleCount, setColorScaleCount] = useState(rule.colorScaleColors?.length === 2 ? 2 : 3);
  const [dataBarColor, setDataBarColor] = useState(rule.dataBarColor || '#4285f4');
  const [iconSetType, setIconSetType] = useState<IconSetType>(rule.iconSetType || 'arrows');
  const [iconThresholds, setIconThresholds] = useState<number[]>(rule.iconThresholds || [33, 67]);
  const [showPresets, setShowPresets] = useState(false);
  const presetRef = useRef<HTMLDivElement>(null);

  const handleSave = () => {
    const finalColors = colorScaleCount === 2 ? colorScaleColors.slice(0, 2) : colorScaleColors.slice(0, 3);
    onSave({
      ...rule,
      range,
      type,
      operator: operator as CellValueOperator,
      values,
      style: (type === 'cellValue' || type === 'text' || type === 'customFormula') ? style : undefined,
      customFormula: type === 'customFormula' ? customFormula : undefined,
      colorScaleColors: type === 'colorScale' ? finalColors : undefined,
      dataBarColor: type === 'dataBars' ? dataBarColor : undefined,
      iconSetType: type === 'iconSet' ? iconSetType : undefined,
      iconThresholds: type === 'iconSet' ? iconThresholds : undefined,
    });
  };

  const applyPreset = (preset: ConditionalStyle) => {
    setStyle({ ...style, ...preset });
    setShowPresets(false);
  };

  return (
    <div className="cf-rule-editor">
      <div className="cf-editor-section">
        <div className="cf-field">
          <label>Apply to range</label>
          <input className="cf-input" value={range} onChange={e => setRange(e.target.value)} placeholder="A1:C10" />
        </div>

        <div className="cf-field">
          <label>Rule type</label>
          <select className="cf-select" value={type} onChange={e => setType(e.target.value as ConditionalRuleType)}>
            <option value="cellValue">Cell value</option>
            <option value="text">Text</option>
            <option value="customFormula">Custom formula</option>
            <option value="colorScale">Color scale</option>
            <option value="dataBars">Data bars</option>
            <option value="iconSet">Icon set</option>
          </select>
        </div>
      </div>

      <div className="cf-editor-section">
        {type === 'cellValue' && (
          <>
            <div className="cf-field">
              <label>Condition</label>
              <select className="cf-select" value={operator} onChange={e => setOperator(e.target.value as typeof operator)}>
                {CELL_VALUE_OPS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="cf-field-row">
              <div className="cf-field">
                <label>Value</label>
                <input className="cf-input" value={values[0] || ''} onChange={e => setValues([e.target.value, values[1] || ''])} />
              </div>
              {operator === 'between' && (
                <div className="cf-field">
                  <label>And</label>
                  <input className="cf-input" value={values[1] || ''} onChange={e => setValues([values[0], e.target.value])} />
                </div>
              )}
            </div>
          </>
        )}

        {type === 'text' && (
          <>
            <div className="cf-field">
              <label>Condition</label>
              <select className="cf-select" value={operator} onChange={e => setOperator(e.target.value as typeof operator)}>
                {TEXT_OPS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="cf-field">
              <label>Text</label>
              <input className="cf-input" value={values[0] || ''} onChange={e => setValues([e.target.value])} />
            </div>
          </>
        )}

        {type === 'customFormula' && (
          <div className="cf-field">
            <label>Formula (must evaluate to true)</label>
            <input className="cf-input cf-formula-input" value={customFormula} onChange={e => setCustomFormula(e.target.value)} placeholder="=A1 > 100" />
            <span className="cf-field-hint">Use cell references relative to the first cell in range</span>
          </div>
        )}

        {type === 'colorScale' && (
          <div className="cf-field">
            <label>Color scale</label>
            <div className="cf-color-scale-toggle">
              <button className={`cf-cs-btn ${colorScaleCount === 2 ? 'active' : ''}`} onClick={() => setColorScaleCount(2)}>2-Color</button>
              <button className={`cf-cs-btn ${colorScaleCount === 3 ? 'active' : ''}`} onClick={() => setColorScaleCount(3)}>3-Color</button>
            </div>
            <div className="cf-color-row">
              <div className="cf-color-pick">
                <span>Min</span>
                <input type="color" value={colorScaleColors[0]} onChange={e => { const nc = [...colorScaleColors]; nc[0] = e.target.value; setColorScaleColors(nc); }} />
              </div>
              {colorScaleCount === 3 && (
                <div className="cf-color-pick">
                  <span>Mid</span>
                  <input type="color" value={colorScaleColors[1]} onChange={e => { const nc = [...colorScaleColors]; nc[1] = e.target.value; setColorScaleColors(nc); }} />
                </div>
              )}
              <div className="cf-color-pick">
                <span>Max</span>
                <input type="color" value={colorScaleColors[colorScaleCount === 2 ? 1 : 2]} onChange={e => {
                  const nc = [...colorScaleColors]; nc[colorScaleCount === 2 ? 1 : 2] = e.target.value; setColorScaleColors(nc);
                }} />
              </div>
            </div>
            <div className="cf-color-scale-bar">
              {Array.from({ length: 20 }).map((_, i) => {
                const pct = i / 19;
                const colors = colorScaleCount === 2 ? [colorScaleColors[0], colorScaleColors[1]] : colorScaleColors;
                return <span key={i} className="cf-cs-segment" style={{ backgroundColor: interpolatePreview(colors, pct) }} />;
              })}
            </div>
          </div>
        )}

        {type === 'dataBars' && (
          <div className="cf-field">
            <label>Bar color</label>
            <input type="color" value={dataBarColor} onChange={e => setDataBarColor(e.target.value)} />
            <div className="cf-databar-demo">
              {[20, 50, 80, 100].map(pct => (
                <div key={pct} className="cf-databar-sample">
                  <div className="cf-databar-fill" style={{ width: `${pct}%`, backgroundColor: dataBarColor }} />
                  <span>{pct}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {type === 'iconSet' && (
          <>
            <div className="cf-field">
              <label>Icon type</label>
              <div className="cf-icon-type-row">
                {(['arrows', 'circles'] as IconSetType[]).map(t => (
                  <button key={t} className={`cf-icon-btn ${iconSetType === t ? 'active' : ''}`} onClick={() => setIconSetType(t)}>
                    {t === 'circles' ? '🟢 🟡 🔴' : '↑ → ↓'}
                  </button>
                ))}
              </div>
            </div>
            <div className="cf-field">
              <label>Thresholds</label>
              <div className="cf-threshold-row">
                <div className="cf-threshold-item">
                  <span>{iconSetType === 'circles' ? '🔴' : '↓'} Below</span>
                  <input className="cf-input cf-input-sm" type="number" value={iconThresholds[0]} onChange={e => setIconThresholds([+e.target.value, iconThresholds[1]])} />
                </div>
                <div className="cf-threshold-item">
                  <span>{iconSetType === 'circles' ? '🟡' : '→'} {iconThresholds[0]}–{iconThresholds[1]}</span>
                </div>
                <div className="cf-threshold-item">
                  <span>{iconSetType === 'circles' ? '🟢' : '↑'} Above</span>
                  <input className="cf-input cf-input-sm" type="number" value={iconThresholds[1]} onChange={e => setIconThresholds([iconThresholds[0], +e.target.value])} />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {(type === 'cellValue' || type === 'text' || type === 'customFormula') && (
        <div className="cf-editor-section">
          <div className="cf-format-header">
            <label>Formatting</label>
            <div style={{ position: 'relative' }} ref={presetRef}>
              <button className="cf-preset-btn" onClick={() => setShowPresets(!showPresets)}>Presets ▾</button>
              {showPresets && (
                <div className="cf-preset-dropdown">
                  {PRESET_STYLES.map((p, i) => (
                    <div key={i} className="cf-preset-option" onClick={() => applyPreset(p.style)}>
                      <span className="cf-preset-swatch" style={{
                        backgroundColor: p.style.backgroundColor || '#fff',
                        color: p.style.textColor || '#000',
                        fontWeight: p.style.bold ? 'bold' : 'normal',
                      }}>Abc</span>
                      <span>{p.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="cf-format-row">
            <label className="cf-color-label">
              <span>Text</span>
              <input type="color" value={style.textColor || '#000000'} onChange={e => setStyle({ ...style, textColor: e.target.value })} />
            </label>
            <label className="cf-color-label">
              <span>Fill</span>
              <input type="color" value={style.backgroundColor || '#ffffff'} onChange={e => setStyle({ ...style, backgroundColor: e.target.value })} />
            </label>
            <label className="cf-check-label">
              <input type="checkbox" checked={style.bold || false} onChange={e => setStyle({ ...style, bold: e.target.checked })} />
              <b>B</b>
            </label>
            <label className="cf-check-label">
              <input type="checkbox" checked={style.italic || false} onChange={e => setStyle({ ...style, italic: e.target.checked })} />
              <i>I</i>
            </label>
          </div>
          <div className="cf-preview-box" style={{
            backgroundColor: style.backgroundColor || '#fff',
            color: style.textColor || '#000',
            fontWeight: style.bold ? 'bold' : 'normal',
            fontStyle: style.italic ? 'italic' : 'normal',
          }}>
            Preview: Sample cell text
          </div>
        </div>
      )}

      <div className="cf-editor-footer">
        <button className="cf-btn-cancel" onClick={onCancel}>Cancel</button>
        <button className="cf-save-btn" onClick={handleSave}>Save Rule</button>
      </div>
    </div>
  );
}

function interpolatePreview(colors: string[], pct: number): string {
  const p = Math.max(0, Math.min(1, pct));
  if (colors.length === 2) return lerpHex(colors[0], colors[1], p);
  if (colors.length >= 3) {
    if (p <= 0.5) return lerpHex(colors[0], colors[1], p * 2);
    return lerpHex(colors[1], colors[2], (p - 0.5) * 2);
  }
  return colors[0];
}

function lerpHex(a: string, b: string, t: number): string {
  const pa = hexRgb(a), pb = hexRgb(b);
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.substring(0, 2), 16) || 0, parseInt(h.substring(2, 4), 16) || 0, parseInt(h.substring(4, 6), 16) || 0];
}
