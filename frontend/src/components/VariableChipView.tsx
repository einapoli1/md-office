import React, { useState, useRef, useEffect } from 'react';
import { NodeViewWrapper } from '@tiptap/react';

const VariableChipView: React.FC<any> = ({ node, updateAttributes, selected }) => {
  const [editingValue, setEditingValue] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { name, value } = node.attrs;

  useEffect(() => {
    if (editingValue) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editingValue]);

  const handleValueSubmit = () => {
    const v = inputRef.current?.value;
    if (v !== undefined && v !== '') {
      const num = parseFloat(v);
      if (!isNaN(num)) {
        updateAttributes({ value: num });
        // Dispatch event so equation blocks re-evaluate
        window.dispatchEvent(new CustomEvent('variable-changed'));
      }
    }
    setEditingValue(false);
  };

  return (
    <NodeViewWrapper as="span" className={`variable-chip ${selected ? 'selected' : ''}`}>
      <span className="variable-chip-inner" onClick={() => setEditingValue(true)}>
        <span className="variable-chip-name">{name}</span>
        <span className="variable-chip-eq">=</span>
        {editingValue ? (
          <input
            ref={inputRef}
            className="variable-chip-input"
            type="number"
            step="any"
            defaultValue={value}
            onBlur={handleValueSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleValueSubmit();
              if (e.key === 'Escape') setEditingValue(false);
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="variable-chip-value">{value}</span>
        )}
      </span>
    </NodeViewWrapper>
  );
};

export default VariableChipView;
