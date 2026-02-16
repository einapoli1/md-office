import React, { useState } from 'react';
import type { FormFieldType, FormFieldAttrs } from '../extensions/FormField';

interface Props {
  attrs: FormFieldAttrs;
  updateAttributes: (attrs: Partial<FormFieldAttrs>) => void;
  deleteNode: () => void;
}

const FIELD_TYPES: { value: FormFieldType; label: string }[] = [
  { value: 'text-input', label: 'Text Input' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'date-picker', label: 'Date Picker' },
  { value: 'signature', label: 'Signature' },
];

const FormFieldToolbar: React.FC<Props> = ({ attrs, updateAttributes, deleteNode }) => {
  const [editingOptions, setEditingOptions] = useState(false);
  const [optionsText, setOptionsText] = useState((attrs.options || []).join('\n'));

  return (
    <div className="form-field-toolbar" contentEditable={false}>
      <div className="form-field-toolbar-row">
        <select
          value={attrs.fieldType}
          onChange={(e) => updateAttributes({ fieldType: e.target.value as FormFieldType })}
          className="form-field-toolbar-select"
        >
          {FIELD_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        <input
          type="text"
          value={attrs.label}
          onChange={(e) => updateAttributes({ label: e.target.value })}
          placeholder="Label"
          className="form-field-toolbar-input"
        />

        <label className="form-field-toolbar-required">
          <input
            type="checkbox"
            checked={attrs.required}
            onChange={(e) => updateAttributes({ required: e.target.checked })}
          />
          Required
        </label>

        <button onClick={deleteNode} className="form-field-toolbar-delete" title="Delete field">✕</button>
      </div>

      {attrs.fieldType === 'dropdown' && (
        <div className="form-field-toolbar-row">
          {editingOptions ? (
            <>
              <textarea
                value={optionsText}
                onChange={(e) => setOptionsText(e.target.value)}
                placeholder="One option per line"
                rows={4}
                className="form-field-toolbar-textarea"
              />
              <button
                onClick={() => {
                  updateAttributes({ options: optionsText.split('\n').map((s) => s.trim()).filter(Boolean) });
                  setEditingOptions(false);
                }}
                className="form-field-toolbar-btn"
              >
                Save
              </button>
            </>
          ) : (
            <button onClick={() => setEditingOptions(true)} className="form-field-toolbar-btn">
              Edit Options ({(attrs.options || []).length})
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default FormFieldToolbar;
