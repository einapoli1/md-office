import { useState } from 'react';
import type { ProtectedRange } from './sheetModel';

interface ProtectedRangesProps {
  ranges: ProtectedRange[];
  onSave: (ranges: ProtectedRange[]) => void;
  onClose: () => void;
  selectedRange?: string;
}

export default function ProtectedRanges({ ranges, onSave, onClose, selectedRange }: ProtectedRangesProps) {
  const [items, setItems] = useState<ProtectedRange[]>(() =>
    ranges.map(r => ({ ...r }))
  );
  const [newRange, setNewRange] = useState(selectedRange || '');
  const [newDesc, setNewDesc] = useState('');

  const addRange = () => {
    if (!newRange.trim()) return;
    setItems([...items, { id: `pr_${Date.now()}`, range: newRange.trim().toUpperCase(), description: newDesc.trim(), locked: true }]);
    setNewRange('');
    setNewDesc('');
  };

  const removeRange = (id: string) => {
    setItems(items.filter(r => r.id !== id));
  };

  const toggleLock = (id: string) => {
    setItems(items.map(r => r.id === id ? { ...r, locked: !r.locked } : r));
  };

  return (
    <div className="sheet-dialog-overlay" onClick={onClose}>
      <div className="sheet-dialog" style={{ width: 440 }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 12px' }}>Protected Ranges</h3>

        <div style={{ maxHeight: 220, overflowY: 'auto', marginBottom: 12 }}>
          {items.length === 0 && <p style={{ color: '#888', fontSize: 12 }}>No protected ranges defined.</p>}
          {items.map(r => (
            <div key={r.id} className="sheet-protected-range-item">
              <span className="sheet-protected-range-cell">{r.range}</span>
              <span className="sheet-protected-range-desc">{r.description || '—'}</span>
              <button
                className={`sheet-tb-btn ${r.locked ? 'active' : ''}`}
                title={r.locked ? 'Locked' : 'Unlocked'}
                onClick={() => toggleLock(r.id)}
              >{r.locked ? '🔒' : '🔓'}</button>
              <button className="sheet-tb-btn" onClick={() => removeRange(r.id)} title="Remove">✕</button>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          <input
            value={newRange}
            onChange={e => setNewRange(e.target.value)}
            placeholder="Range (e.g. A1:C5)"
            style={{ width: 120, fontSize: 12, padding: '4px 6px' }}
          />
          <input
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            placeholder="Description"
            style={{ flex: 1, fontSize: 12, padding: '4px 6px' }}
          />
          <button
            onClick={addRange}
            disabled={!newRange.trim()}
            style={{ fontSize: 12, padding: '4px 10px', background: '#4285F4', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer' }}
          >Add</button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ fontSize: 12, padding: '6px 14px' }}>Cancel</button>
          <button
            onClick={() => { onSave(items); onClose(); }}
            style={{ fontSize: 12, padding: '6px 14px', background: '#4285F4', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer' }}
          >Save</button>
        </div>
      </div>
    </div>
  );
}
