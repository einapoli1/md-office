// Conditional Formatting Dialog

import { useState } from 'react';
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

export default function ConditionalFormatDialog({ existingRules, selectedRange, onSave, onClose }: ConditionalFormatDialogProps) {
  const [rules, setRules] = useState<ConditionalRule[]>([...existingRules]);
  const [editingRule, setEditingRule] = useState<ConditionalRule | null>(null);

  const createNew = () => {
    setEditingRule({
      id: `cf_${Date.now()}`,
      range: selectedRange,
      type: 'cellValue',
      operator: 'gt',
      values: ['0'],
      style: { backgroundColor: '#ffcdd2' },
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

  return (
    <div className="cf-dialog-overlay" onClick={onClose}>
      <div className="cf-dialog" onClick={e => e.stopPropagation()}>
        <div className="cf-dialog-header">
          <h3>Conditional Formatting</h3>
          <button className="cf-close-btn" onClick={onClose}>✕</button>
        </div>

        {editingRule ? (
          <RuleEditor rule={editingRule} onSave={saveRule} onCancel={() => setEditingRule(null)} />
        ) : (
          <div className="cf-dialog-body">
            <div className="cf-rules-list">
              {rules.length === 0 && <div className="cf-empty">No rules yet. Add one below.</div>}
              {rules.map(rule => (
                <div key={rule.id} className="cf-rule-item">
                  <div className="cf-rule-info">
                    <span className="cf-rule-type">{rule.type}</span>
                    <span className="cf-rule-range">{rule.range}</span>
                    {rule.style && (
                      <span
                        className="cf-rule-preview"
                        style={{
                          backgroundColor: rule.style.backgroundColor,
                          color: rule.style.textColor,
                          fontWeight: rule.style.bold ? 'bold' : 'normal',
                          fontStyle: rule.style.italic ? 'italic' : 'normal',
                          padding: '2px 8px',
                          borderRadius: 3,
                        }}
                      >Preview</span>
                    )}
                  </div>
                  <div className="cf-rule-actions">
                    <button onClick={() => setEditingRule({ ...rule })}>Edit</button>
                    <button onClick={() => deleteRule(rule.id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="cf-dialog-footer">
              <button className="cf-add-btn" onClick={createNew}>+ Add Rule</button>
              <div className="cf-footer-right">
                <button onClick={onClose}>Cancel</button>
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
  const [style, setStyle] = useState<ConditionalStyle>(rule.style || { backgroundColor: '#ffcdd2' });
  const [range, setRange] = useState(rule.range);
  const [colorScaleColors, setColorScaleColors] = useState<string[]>(rule.colorScaleColors || ['#f44336', '#ffeb3b', '#4caf50']);
  const [dataBarColor, setDataBarColor] = useState(rule.dataBarColor || '#4285f4');
  const [iconSetType, setIconSetType] = useState<IconSetType>(rule.iconSetType || 'arrows');
  const [iconThresholds, setIconThresholds] = useState<number[]>(rule.iconThresholds || [33, 67]);

  const handleSave = () => {
    onSave({
      ...rule,
      range,
      type,
      operator: operator as CellValueOperator,
      values,
      style,
      colorScaleColors: type === 'colorScale' ? colorScaleColors : undefined,
      dataBarColor: type === 'dataBars' ? dataBarColor : undefined,
      iconSetType: type === 'iconSet' ? iconSetType : undefined,
      iconThresholds: type === 'iconSet' ? iconThresholds : undefined,
    });
  };

  return (
    <div className="cf-rule-editor">
      <div className="cf-field">
        <label>Apply to range</label>
        <input value={range} onChange={e => setRange(e.target.value)} placeholder="A1:C10" />
      </div>

      <div className="cf-field">
        <label>Rule type</label>
        <select value={type} onChange={e => setType(e.target.value as ConditionalRuleType)}>
          <option value="cellValue">Cell value</option>
          <option value="text">Text</option>
          <option value="colorScale">Color scale</option>
          <option value="dataBars">Data bars</option>
          <option value="iconSet">Icon set</option>
        </select>
      </div>

      {type === 'cellValue' && (
        <>
          <div className="cf-field">
            <label>Condition</label>
            <select value={operator} onChange={e => setOperator(e.target.value)}>
              {CELL_VALUE_OPS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="cf-field">
            <label>Value</label>
            <input value={values[0] || ''} onChange={e => setValues([e.target.value, values[1] || ''])} />
          </div>
          {operator === 'between' && (
            <div className="cf-field">
              <label>And</label>
              <input value={values[1] || ''} onChange={e => setValues([values[0], e.target.value])} />
            </div>
          )}
        </>
      )}

      {type === 'text' && (
        <>
          <div className="cf-field">
            <label>Condition</label>
            <select value={operator} onChange={e => setOperator(e.target.value)}>
              {TEXT_OPS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="cf-field">
            <label>Text</label>
            <input value={values[0] || ''} onChange={e => setValues([e.target.value])} />
          </div>
        </>
      )}

      {type === 'colorScale' && (
        <div className="cf-field">
          <label>Colors (min → mid → max)</label>
          <div className="cf-color-row">
            {colorScaleColors.map((c, i) => (
              <input key={i} type="color" value={c} onChange={e => {
                const nc = [...colorScaleColors];
                nc[i] = e.target.value;
                setColorScaleColors(nc);
              }} />
            ))}
          </div>
        </div>
      )}

      {type === 'dataBars' && (
        <div className="cf-field">
          <label>Bar color</label>
          <input type="color" value={dataBarColor} onChange={e => setDataBarColor(e.target.value)} />
        </div>
      )}

      {type === 'iconSet' && (
        <>
          <div className="cf-field">
            <label>Icon type</label>
            <select value={iconSetType} onChange={e => setIconSetType(e.target.value as IconSetType)}>
              <option value="arrows">Arrows (↑→↓)</option>
              <option value="circles">Circles (🟢🟡🔴)</option>
            </select>
          </div>
          <div className="cf-field">
            <label>Thresholds</label>
            <div className="cf-threshold-row">
              <input type="number" value={iconThresholds[0]} onChange={e => setIconThresholds([+e.target.value, iconThresholds[1]])} />
              <span>to</span>
              <input type="number" value={iconThresholds[1]} onChange={e => setIconThresholds([iconThresholds[0], +e.target.value])} />
            </div>
          </div>
        </>
      )}

      {(type === 'cellValue' || type === 'text') && (
        <div className="cf-format-section">
          <label>Formatting</label>
          <div className="cf-format-row">
            <label className="cf-color-label">
              Text <input type="color" value={style.textColor || '#000000'} onChange={e => setStyle({ ...style, textColor: e.target.value })} />
            </label>
            <label className="cf-color-label">
              Fill <input type="color" value={style.backgroundColor || '#ffffff'} onChange={e => setStyle({ ...style, backgroundColor: e.target.value })} />
            </label>
            <label><input type="checkbox" checked={style.bold || false} onChange={e => setStyle({ ...style, bold: e.target.checked })} /> <b>B</b></label>
            <label><input type="checkbox" checked={style.italic || false} onChange={e => setStyle({ ...style, italic: e.target.checked })} /> <i>I</i></label>
          </div>
          <div className="cf-preview" style={{
            backgroundColor: style.backgroundColor,
            color: style.textColor,
            fontWeight: style.bold ? 'bold' : 'normal',
            fontStyle: style.italic ? 'italic' : 'normal',
          }}>
            Preview text
          </div>
        </div>
      )}

      <div className="cf-editor-footer">
        <button onClick={onCancel}>Cancel</button>
        <button className="cf-save-btn" onClick={handleSave}>Save Rule</button>
      </div>
    </div>
  );
}
