// Data Validation Dialog

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

  const createNew = () => {
    setEditingRule({
      id: `dv_${Date.now()}`,
      range: selectedRange,
      rule: {
        type: 'number',
        operator: 'between',
        values: ['0', '100'],
        onInvalid: 'reject',
        errorMessage: '',
      },
    });
  };

  const saveRule = (rule: ValidationRule) => {
    const idx = rules.findIndex(r => r.id === rule.id);
    const newRules = [...rules];
    if (idx >= 0) newRules[idx] = rule;
    else newRules.push(rule);
    setRules(newRules);
    setEditingRule(null);
  };

  const deleteRule = (id: string) => setRules(rules.filter(r => r.id !== id));

  return (
    <div className="cf-dialog-overlay" onClick={onClose}>
      <div className="cf-dialog" onClick={e => e.stopPropagation()}>
        <div className="cf-dialog-header">
          <h3>Data Validation</h3>
          <button className="cf-close-btn" onClick={onClose}>✕</button>
        </div>

        {editingRule ? (
          <ValidationRuleEditor rule={editingRule} onSave={saveRule} onCancel={() => setEditingRule(null)} />
        ) : (
          <div className="cf-dialog-body">
            <div className="cf-rules-list">
              {rules.length === 0 && <div className="cf-empty">No validation rules. Add one below.</div>}
              {rules.map(rule => (
                <div key={rule.id} className="cf-rule-item">
                  <div className="cf-rule-info">
                    <span className="cf-rule-type">{rule.rule.type}</span>
                    <span className="cf-rule-range">{rule.range}</span>
                    <span className={`dv-badge dv-badge-${rule.rule.onInvalid}`}>{rule.rule.onInvalid}</span>
                  </div>
                  <div className="cf-rule-actions">
                    <button onClick={() => setEditingRule({ ...rule, rule: { ...rule.rule } })}>Edit</button>
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

function ValidationRuleEditor({ rule, onSave, onCancel }: { rule: ValidationRule; onSave: (r: ValidationRule) => void; onCancel: () => void }) {
  const [range, setRange] = useState(rule.range);
  const [type, setType] = useState<ValidationRuleType['type']>(rule.rule.type);
  const [operator, setOperator] = useState(rule.rule.operator || 'between');
  const [values, setValues] = useState<string[]>(rule.rule.values || ['', '']);
  const [listItems, setListItems] = useState(rule.rule.listItems?.join(', ') || '');
  const [customFormula, setCustomFormula] = useState(rule.rule.customFormula || '');
  const [onInvalid, setOnInvalid] = useState(rule.rule.onInvalid);
  const [errorMessage, setErrorMessage] = useState(rule.rule.errorMessage || '');

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
      <div className="cf-field">
        <label>Apply to range</label>
        <input value={range} onChange={e => setRange(e.target.value)} />
      </div>

      <div className="cf-field">
        <label>Validation type</label>
        <select value={type} onChange={e => setType(e.target.value as ValidationRuleType['type'])}>
          <option value="number">Number</option>
          <option value="text">Text</option>
          <option value="list">List</option>
          <option value="date">Date</option>
          <option value="custom">Custom formula</option>
        </select>
      </div>

      {type === 'number' && (
        <>
          <div className="cf-field">
            <label>Condition</label>
            <select value={operator} onChange={e => setOperator(e.target.value)}>
              <option value="between">Between</option>
              <option value="notBetween">Not between</option>
              <option value="gt">Greater than</option>
              <option value="lt">Less than</option>
              <option value="eq">Equal to</option>
            </select>
          </div>
          <div className="cf-field">
            <label>Value</label>
            <input value={values[0]} onChange={e => setValues([e.target.value, values[1]])} />
          </div>
          {(operator === 'between' || operator === 'notBetween') && (
            <div className="cf-field">
              <label>And</label>
              <input value={values[1]} onChange={e => setValues([values[0], e.target.value])} />
            </div>
          )}
        </>
      )}

      {type === 'text' && (
        <div className="cf-field">
          <label>Condition</label>
          <select value={operator} onChange={e => setOperator(e.target.value)}>
            <option value="maxLength">Max length</option>
            <option value="email">Email format</option>
            <option value="url">URL format</option>
          </select>
          {operator === 'maxLength' && (
            <input type="number" value={values[0]} onChange={e => setValues([e.target.value])} placeholder="Max chars" style={{ marginTop: 4 }} />
          )}
        </div>
      )}

      {type === 'list' && (
        <div className="cf-field">
          <label>Options (comma-separated)</label>
          <input value={listItems} onChange={e => setListItems(e.target.value)} placeholder="Option1, Option2, Option3" />
        </div>
      )}

      {type === 'date' && (
        <>
          <div className="cf-field">
            <label>Condition</label>
            <select value={operator} onChange={e => setOperator(e.target.value)}>
              <option value="before">Before</option>
              <option value="after">After</option>
              <option value="between">Between</option>
            </select>
          </div>
          <div className="cf-field">
            <label>Date</label>
            <input type="date" value={values[0]} onChange={e => setValues([e.target.value, values[1]])} />
          </div>
          {operator === 'between' && (
            <div className="cf-field">
              <label>And</label>
              <input type="date" value={values[1]} onChange={e => setValues([values[0], e.target.value])} />
            </div>
          )}
        </>
      )}

      {type === 'custom' && (
        <div className="cf-field">
          <label>Formula (must evaluate to true)</label>
          <input value={customFormula} onChange={e => setCustomFormula(e.target.value)} placeholder="=VALUE > 0" />
        </div>
      )}

      <div className="cf-field">
        <label>On invalid input</label>
        <select value={onInvalid} onChange={e => setOnInvalid(e.target.value as 'warning' | 'reject' | 'info')}>
          <option value="reject">Reject (red)</option>
          <option value="warning">Warning (yellow)</option>
          <option value="info">Info</option>
        </select>
      </div>

      <div className="cf-field">
        <label>Error message</label>
        <input value={errorMessage} onChange={e => setErrorMessage(e.target.value)} placeholder="Custom error message" />
      </div>

      <div className="cf-editor-footer">
        <button onClick={onCancel}>Cancel</button>
        <button className="cf-save-btn" onClick={handleSave}>Save Rule</button>
      </div>
    </div>
  );
}
