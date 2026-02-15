import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';

interface InputField {
  key: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  type?: string;
}

interface InputDialogProps {
  title: string;
  fields: InputField[];
  onSubmit: (values: Record<string, string>) => void;
  onClose: () => void;
  submitLabel?: string;
}

const InputDialog: React.FC<InputDialogProps> = ({ title, fields, onSubmit, onClose, submitLabel = 'OK' }) => {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    fields.forEach(f => { initial[f.key] = f.defaultValue || ''; });
    return initial;
  });
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => firstInputRef.current?.focus(), 50);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(values);
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="input-dialog" onClick={e => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>{title}</h3>
          <button className="dialog-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="input-dialog-body">
            {fields.map((field, i) => (
              <div key={field.key} className="input-dialog-field">
                <label>{field.label}</label>
                <input
                  ref={i === 0 ? firstInputRef : undefined}
                  type={field.type || 'text'}
                  placeholder={field.placeholder}
                  value={values[field.key]}
                  onChange={e => setValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <div className="dialog-footer">
            <button type="button" className="dialog-cancel-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="dialog-ok-btn">{submitLabel}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InputDialog;
