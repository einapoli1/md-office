import { useState, useRef, useEffect } from 'react';
import { Column, CellValue, SelectOption, genId, SELECT_COLORS } from './databaseModel';

interface Props {
  column: Column;
  value: CellValue;
  onChange: (value: CellValue) => void;
  inline?: boolean;
}

export default function CellEditor({ column, value, onChange, inline }: Props) {
  switch (column.type) {
    case 'text':
    case 'email':
    case 'url':
    case 'person':
      return <TextCell value={value as string} onChange={onChange} type={column.type} inline={inline} />;
    case 'number':
      return <NumberCell value={value as number} onChange={onChange} inline={inline} />;
    case 'date':
      return <DateCell value={value as string} onChange={onChange} />;
    case 'checkbox':
      return <CheckboxCell value={value as boolean} onChange={onChange} />;
    case 'select':
      return <SelectCell value={value as string} options={column.options ?? []} onChange={onChange} onUpdateOptions={(opts) => void opts} multi={false} />;
    case 'multi-select':
      return <SelectCell value={value as string[]} options={column.options ?? []} onChange={onChange} onUpdateOptions={(opts) => void opts} multi={true} />;
    case 'formula':
      return <span className="db-cell-formula">{String(value ?? '')}</span>;
    case 'relation':
    case 'rollup':
      return <span className="db-cell-readonly">{String(value ?? '')}</span>;
    default:
      return <TextCell value={String(value ?? '')} onChange={onChange} type="text" inline={inline} />;
  }
}

function TextCell({ value, onChange, type, inline }: { value: string; onChange: (v: string) => void; type: string; inline?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(value ?? ''); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  if (!editing && inline) {
    return (
      <div className="db-cell-text" onDoubleClick={() => setEditing(true)}>
        {type === 'url' && value ? <a href={value} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>{value}</a> : (value || '\u00A0')}
      </div>
    );
  }

  return (
    <input
      ref={inputRef}
      className="db-cell-input"
      type={type === 'email' ? 'email' : type === 'url' ? 'url' : 'text'}
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => { onChange(draft); setEditing(false); }}
      onKeyDown={e => { if (e.key === 'Enter') { onChange(draft); setEditing(false); } if (e.key === 'Escape') setEditing(false); }}
    />
  );
}

function NumberCell({ value, onChange, inline }: { value: number; onChange: (v: number) => void; inline?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? 0));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(String(value ?? 0)); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  if (!editing && inline) {
    return <div className="db-cell-text" onDoubleClick={() => setEditing(true)}>{value ?? 0}</div>;
  }

  return (
    <input
      ref={inputRef}
      className="db-cell-input"
      type="number"
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => { onChange(Number(draft) || 0); setEditing(false); }}
      onKeyDown={e => { if (e.key === 'Enter') { onChange(Number(draft) || 0); setEditing(false); } }}
    />
  );
}

function DateCell({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      className="db-cell-input"
      type="date"
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
    />
  );
}

function CheckboxCell({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <input
      type="checkbox"
      checked={!!value}
      onChange={e => onChange(e.target.checked)}
      className="db-cell-checkbox"
    />
  );
}

function SelectCell({ value, options, onChange, onUpdateOptions: _onUpdateOptions, multi }: {
  value: CellValue;
  options: SelectOption[];
  onChange: (v: CellValue) => void;
  onUpdateOptions: (opts: SelectOption[]) => void;
  multi: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedValues = multi ? (Array.isArray(value) ? value : []) : [String(value ?? '')];
  const filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()));

  const toggle = (optLabel: string) => {
    if (multi) {
      const arr = Array.isArray(value) ? [...(value as string[])] : [];
      const idx = arr.indexOf(optLabel);
      if (idx >= 0) arr.splice(idx, 1); else arr.push(optLabel);
      onChange(arr);
    } else {
      onChange(optLabel);
      setOpen(false);
    }
  };

  const createOption = () => {
    if (!search.trim()) return;
    const newOpt: SelectOption = { id: genId(), label: search.trim(), color: SELECT_COLORS[options.length % SELECT_COLORS.length] };
    options.push(newOpt); // mutate for simplicity; parent should persist
    toggle(newOpt.label);
    setSearch('');
  };

  return (
    <div ref={ref} className="db-cell-select-wrapper">
      <div className="db-cell-select-display" onClick={() => setOpen(!open)}>
        {selectedValues.filter(Boolean).map(v => {
          const opt = options.find(o => o.label === v);
          return <span key={v} className="db-tag" style={{ backgroundColor: opt?.color ?? '#eee' }}>{v}</span>;
        })}
        {selectedValues.filter(Boolean).length === 0 && <span className="db-placeholder">Select...</span>}
      </div>
      {open && (
        <div className="db-dropdown db-select-dropdown">
          <input className="db-select-search" placeholder="Search or create..." value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && filtered.length === 0) createOption(); }} />
          {filtered.map(o => (
            <button key={o.id} className={`db-dropdown-item ${selectedValues.includes(o.label) ? 'selected' : ''}`} onClick={() => toggle(o.label)}>
              <span className="db-tag" style={{ backgroundColor: o.color }}>{o.label}</span>
            </button>
          ))}
          {search && filtered.length === 0 && (
            <button className="db-dropdown-item" onClick={createOption}>+ Create "{search}"</button>
          )}
        </div>
      )}
    </div>
  );
}
