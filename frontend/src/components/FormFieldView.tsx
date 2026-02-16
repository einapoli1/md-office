import React, { useState, useRef, useEffect, useCallback } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import type { FormFieldType } from '../extensions/FormField';
import FormFieldToolbar from './FormFieldToolbar';

interface FormFieldViewProps {
  node: any;
  updateAttributes: (attrs: Record<string, any>) => void;
  deleteNode: () => void;
  selected: boolean;
  editor: any;
}

const FormFieldView: React.FC<FormFieldViewProps> = ({ node, updateAttributes, deleteNode, selected, editor: _editor }) => {
  const [showToolbar, setShowToolbar] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const attrs = node.attrs;
  const fieldType: FormFieldType = attrs.fieldType;
  const isFormFillMode = (window as any).__formFillMode === true;

  useEffect(() => {
    if (!selected) setShowToolbar(false);
    else if (!isFormFillMode) setShowToolbar(true);
  }, [selected, isFormFillMode]);

  useEffect(() => {
    if (!showToolbar) return;
    const handle = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowToolbar(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [showToolbar]);

  const setValue = useCallback((v: string) => updateAttributes({ value: v }), [updateAttributes]);

  const editClass = isFormFillMode ? 'form-field--fill' : 'form-field--edit';

  const renderField = () => {
    switch (fieldType) {
      case 'text-input':
        return (
          <span className="form-field-text-input">
            {!isFormFillMode && attrs.label && <span className="form-field-label">{attrs.label}{attrs.required && ' *'}</span>}
            <input
              type="text"
              value={attrs.value || ''}
              placeholder={attrs.placeholder || ''}
              onChange={(e) => setValue(e.target.value)}
              className="form-field-input"
              readOnly={!isFormFillMode && !selected}
            />
          </span>
        );

      case 'dropdown':
        return (
          <span className="form-field-dropdown">
            {!isFormFillMode && attrs.label && <span className="form-field-label">{attrs.label}{attrs.required && ' *'}</span>}
            <select
              value={attrs.value || ''}
              onChange={(e) => setValue(e.target.value)}
              className="form-field-select"
            >
              <option value="">{attrs.placeholder || 'Select...'}</option>
              {(attrs.options || []).map((opt: string, i: number) => (
                <option key={i} value={opt}>{opt}</option>
              ))}
            </select>
          </span>
        );

      case 'checkbox':
        return (
          <span className="form-field-checkbox">
            <input
              type="checkbox"
              checked={attrs.value === 'true'}
              onChange={(e) => setValue(e.target.checked ? 'true' : 'false')}
              className="form-field-check"
            />
            <span className="form-field-label">{attrs.label || 'Checkbox'}{attrs.required && ' *'}</span>
          </span>
        );

      case 'date-picker':
        return (
          <span className="form-field-date">
            {!isFormFillMode && attrs.label && <span className="form-field-label">{attrs.label}{attrs.required && ' *'}</span>}
            <input
              type="date"
              value={attrs.value || ''}
              onChange={(e) => setValue(e.target.value)}
              className="form-field-date-input"
            />
          </span>
        );

      case 'signature':
        return (
          <span className="form-field-signature">
            <span className="form-field-label">{attrs.label || 'Sign here'}{attrs.required && ' *'}</span>
            <span className="form-field-sig-line">
              {attrs.value ? (
                <span className="form-field-sig-value">{attrs.value}</span>
              ) : (
                <input
                  type="text"
                  placeholder="Type signature..."
                  value=""
                  onChange={(e) => setValue(e.target.value)}
                  className="form-field-sig-input"
                />
              )}
            </span>
          </span>
        );

      default:
        return <span>[Unknown field]</span>;
    }
  };

  return (
    <NodeViewWrapper as="span" className={`form-field-wrapper ${editClass}`} ref={wrapperRef}>
      <span contentEditable={false} className={`form-field ${selected ? 'form-field--selected' : ''}`}>
        {renderField()}
      </span>
      {showToolbar && !isFormFillMode && (
        <FormFieldToolbar
          attrs={attrs}
          updateAttributes={updateAttributes}
          deleteNode={deleteNode}
        />
      )}
    </NodeViewWrapper>
  );
};

export default FormFieldView;
