// Data Validation Dialog — Polished with in-cell dropdown, validation manager

import { useState } from 'react';
import type { ValidationRule, ValidationRuleType } from './conditionalEval';

interface DataValidationDialogProps {
  existingRules: ValidationRule[];
  selectedRange: string;
  onSave: (rules: ValidationRule[]) => void;
  onClose: () => void;
}

export default function DataValidationDialog({ existingRules, selectedRange, onSave, onClose }: DataValidationDialogProps) {
  const [rules, setRules] = useState<ValidationRule[]>([...existingRules]);
  const [editingRule, setEditingRule] = useState<ValidationRule | null>(null);
  const [view, setView] = useState<'list' | 'edit'>('list');

  const createNew = () => {
    const newRule: ValidationRule = {
      id: `dv_${Date.now()}`,
      range: selectedRange,
      rule: {
        type: 'list',
        operator: 'between',
        values: [''],
        listItems: ['Option 1', 'Option 2', 'Option 3'],
        onInvalid: 'reject',
        errorMessage: '',
      },
    };
    setEditingRule(newRule);
    setView('edit');
  };

  const saveRule = (rule: ValidationRule) => {
    const idx = rules.findIndex(r => r.id === rule.id);
    const newRules = [...rules];
    if (idx >= 0) newRules[idx] = rule;
    else newRules.push(rule);
    setRules(newRules);
    setEditingRule(null);
    setView('list');
  };

  const deleteRule = (id: string) => setRules(rules.filter(r => r.id !== id));

  const getRuleDescription = (rule: ValidationRule): string => {
    const r = rule.rule;
    switch (r.type) {
      case 'list': return `Dropdown: ${r.listItems?.slice(0, 3).join(', ') ?? ''}${(r.listItems?.length ?? 0) > 3 ? '...' : ''}`;
      case 'number': {
        if (r.operator === 'between') return `Number between ${r.values?.[0] ?? ''} and ${r.values?.[1] ?? ''}`;
        return `Number ${r.operator} ${r.values?.[0] ?? ''}`;
      }
      case 'date': {
        if (r.operator === 'between') return `Date between ${r.values?.[0] ?? ''} and ${r.values?.[1] ?? ''}`;
        return `Date ${r.operator} ${r.values?.[0] ?? ''}`;
      }
      case 'text': return `Text: ${r.operator === 'maxLength' ? `max ${r.values?.[0]} chars` : r.operator}`;
      case 'custom': return `Formula: ${r.customFormula ?? ''}`;
      default: return r.type;
    }
  };

  return (
    <div className="cf-dialog-overlay" onClick={onClose}>
      <div className="cf-dialog cf-dialog-polished" onClick={e => e.stopPropagation()}>
        <div className="cf-dialog-header">
          <h3>Data Validation</h3>
          <button className="cf-close-btn" onClick={onClose}>✕</button>
        </div>

        {view === 'edit' && editingRule ? (
          <ValidationRuleEditor rule={editingRule} onSave={saveRule} onCancel={() => { setEditingRule(null); setView('list'); }} />
        ) : (
          <div className="cf-dialog-body">
            <p className="cf-hint">Validated cells show a small triangle indicator. List validation adds an in-cell dropdown.</p>
            <div className="cf-rules-list">
              {rules.length === 0 && <div className="cf-empty">No validation rules. Click "Add Rule" below.</div>}
              {rules.map(rule => (
                <div key={rule.id} className="cf-rule-item">
                  <div className="cf-rule-info">
                    <div className="cf-rule-desc">{getRuleDescription(rule)}</div>
                    <div className="cf-rule-meta">
                      <span className="cf-rule-range-badge">{rule.range}</span>
                      <span className={`dv-badge dv-badge-${rule.rule.onInvalid}`}>{rule.rule.onInvalid}</span>
                      {rule.rule.type === 'list' && <span className="dv-badge" style={{ background: '#e6f4ea', color: '#137333' }}>dropdown</span>}
                    </div>
                  </div>
                  <div className="cf-rule-actions">
                    <button className="cf-action-btn" onClick={() => { setEditingRule({ ...rule, rule: { ...rule.rule } }); setView('edit'); }} title="Edit">✏️</button>
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

function ValidationRuleEditor({ rule, onSave, onCancel }: { rule: ValidationRule; onSave: (r: ValidationRule) => void; onCancel: () => void }) {
  const [range, setRange] = useState(rule.range);
  const [type, setType] = useState<ValidationRuleType['type']>(rule.rule.type);
  const [operator, setOperator] = useState(rule.rule.operator || 'between');
  const [values, setValues] = useState<string[]>(rule.rule.values || ['', '']);
  const [listItems, setListItems] = useState(rule.rule.listItems?.join(', ') || '');
  const [customFormula, setCustomFormula] = useState(rule.rule.customFormula || '');
  const [onInvalid, setOnInvalid] = useState(rule.rule.onInvalid);
  const [errorMessage, setErrorMessage] = useState(rule.rule.errorMessage || '');
  const [showInputHelp, setShowInputHelp] = useState(false);

  const handleSave = () => {
    onSave({
      ...rule,
      range,
      rule: {
        type,
        operator,
        values,
        listItems: type === 'list' ? listItems.split(',').map(s => s.trim()).filter(Boolean) : undefined,
        customFormula: type === 'custom' ? customFormula : undefined,
        onInvalid,
        errorMessage: errorMessage || undefined,
      },
    });
  };

  return (
    <div className="cf-rule-editor">
      <div className="cf-editor-section">
        <div className="cf-field">
          <label>Apply to range</label>
          <input className="cf-input" value={range} onChange={e => setRange(e.target.value)} placeholder="A1:C10" />
        </div>

        <div className="cf-field">
          <label>Validation type</label>
          <select className="cf-select" value={type} onChange={e => setType(e.target.value as ValidationRuleType['type'])}>
            <option value="list">List of items (dropdown)</option>
            <option value="number">Number range</option>
            <option value="date">Date range</option>
            <option value="text">Text length / format</option>
            <option value="custom">Custom formula</option>
          </select>
        </div>
      </div>

      <div className="cf-editor-section">
        {type === 'list' && (
          <div className="cf-field">
            <label>Options (comma-separated)</label>
            <textarea
              className="cf-input dv-list-textarea"
              value={listItems}
              onChange={e => setListItems(e.target.value)}
              placeholder="Option 1, Option 2, Option 3"
              rows={3}
            />
            <span className="cf-field-hint">
              {listItems.split(',').filter(s => s.trim()).length} items — cells will show an in-cell dropdown
            </span>
          </div>
        )}

        {type === 'number' && (
          <>
            <div className="cf-field">
              <label>Condition</label>
              <select className="cf-select" value={operator} onChange={e => setOperator(e.target.value)}>
                <option value="between">Between</option>
                <option value="notBetween">Not between</option>
                <option value="gt">Greater than</option>
                <option value="lt">Less than</option>
                <option value="gte">Greater than or equal</option>
                <option value="lte">Less than or equal</option>
                <option value="eq">Equal to</option>
              </select>
            </div>
            <div className="cf-field-row">
              <div className="cf-field">
                <label>{operator === 'between' || operator === 'notBetween' ? 'Min' : 'Value'}</label>
                <input className="cf-input" type="number" value={values[0]} onChange={e => setValues([e.target.value, values[1]])} />
              </div>
              {(operator === 'between' || operator === 'notBetween') && (
                <div className="cf-field">
                  <label>Max</label>
                  <input className="cf-input" type="number" value={values[1]} onChange={e => setValues([values[0], e.target.value])} />
                </div>
              )}
            </div>
          </>
        )}

        {type === 'text' && (
          <>
            <div className="cf-field">
              <label>Condition</label>
              <select className="cf-select" value={operator} onChange={e => setOperator(e.target.value)}>
                <option value="maxLength">Maximum length</option>
                <option value="minLength">Minimum length</option>
                <option value="email">Email format</option>
                <option value="url">URL format</option>
              </select>
            </div>
            {(operator === 'maxLength' || operator === 'minLength') && (
              <div className="cf-field">
                <label>Characters</label>
                <input className="cf-input" type="number" value={values[0]} onChange={e => setValues([e.target.value])} placeholder="Max characters" />
              </div>
            )}
          </>
        )}

        {type === 'date' && (
          <>
            <div className="cf-field">
              <label>Condition</label>
              <select className="cf-select" value={operator} onChange={e => setOperator(e.target.value)}>
                <option value="between">Between</option>
                <option value="before">Before</option>
                <option value="after">After</option>
              </select>
            </div>
            <div className="cf-field-row">
              <div className="cf-field">
                <label>{operator === 'between' ? 'Start date' : 'Date'}</label>
                <input className="cf-input" type="date" value={values[0]} onChange={e => setValues([e.target.value, values[1]])} />
              </div>
              {operator === 'between' && (
                <div className="cf-field">
                  <label>End date</label>
                  <input className="cf-input" type="date" value={values[1]} onChange={e => setValues([values[0], e.target.value])} />
                </div>
              )}
            </div>
          </>
        )}

        {type === 'custom' && (
          <div className="cf-field">
            <label>Formula (must evaluate to true for valid input)</label>
            <input className="cf-input cf-formula-input" value={customFormula} onChange={e => setCustomFormula(e.target.value)} placeholder="=VALUE > 0" />
            <span className="cf-field-hint">Use VALUE to reference the cell's value</span>
          </div>
        )}
      </div>

      <div className="cf-editor-section">
        <div className="cf-field">
          <label>On invalid input</label>
          <div className="dv-severity-row">
            {(['reject', 'warning', 'info'] as const).map(sev => (
              <button
                key={sev}
                className={`dv-severity-btn dv-severity-${sev} ${onInvalid === sev ? 'active' : ''}`}
                onClick={() => setOnInvalid(sev)}
              >
                {sev === 'reject' ? '🚫 Reject' : sev === 'warning' ? '⚠️ Warning' : 'ℹ️ Info'}
              </button>
            ))}
          </div>
        </div>

        <div className="cf-field">
          <label>
            Error message (optional)
            <button className="dv-help-toggle" onClick={() => setShowInputHelp(!showInputHelp)}>?</button>
          </label>
          <input className="cf-input" value={errorMessage} onChange={e => setErrorMessage(e.target.value)} placeholder="Custom error message shown to user" />
          {showInputHelp && (
            <div className="dv-help-text">
              When "Reject" is selected, the cell value will be reverted. "Warning" shows a yellow notice but allows the value. "Info" is a subtle notice.
            </div>
          )}
        </div>
      </div>

      <div className="cf-editor-footer">
        <button className="cf-btn-cancel" onClick={onCancel}>Cancel</button>
        <button className="cf-save-btn" onClick={handleSave}>Save Rule</button>
      </div>
    </div>
  );
}
