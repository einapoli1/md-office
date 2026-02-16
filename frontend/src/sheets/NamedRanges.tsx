import { useState } from 'react';

interface NamedRangesDialogProps {
  namedRanges: Record<string, string>;
  onSave: (ranges: Record<string, string>) => void;
  onClose: () => void;
}

export default function NamedRangesDialog({ namedRanges, onSave, onClose }: NamedRangesDialogProps) {
  const [ranges, setRanges] = useState<Record<string, string>>({ ...namedRanges });
  const [newName, setNewName] = useState('');
  const [newRange, setNewRange] = useState('');
  const [error, setError] = useState('');

  const entries = Object.entries(ranges);

  const addRange = () => {
    const name = newName.trim();
    const range = newRange.trim().toUpperCase();
    if (!name) { setError('Name is required'); return; }
    if (!range) { setError('Range is required'); return; }
    if (!/^[A-Za-z_]\w*$/.test(name)) { setError('Invalid name (use letters, numbers, underscores)'); return; }
    if (ranges[name]) { setError(`"${name}" already exists`); return; }
    setRanges({ ...ranges, [name]: range });
    setNewName('');
    setNewRange('');
    setError('');
  };

  const updateRange = (name: string, range: string) => {
    setRanges({ ...ranges, [name]: range.toUpperCase() });
  };

  const deleteRange = (name: string) => {
    const next = { ...ranges };
    delete next[name];
    setRanges(next);
  };

  return (
    <div style={overlayStyle}>
      <div style={dialogStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>Named Ranges</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>

        <p style={{ fontSize: 12, color: '#666', margin: '0 0 12px' }}>
          Define named ranges to use in formulas. Example: <code>=SUM(Revenue)</code> instead of <code>=SUM(A1:A50)</code>
        </p>

        {/* Existing ranges */}
        {entries.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12, fontSize: 12 }}>
            <thead>
              <tr>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Range</th>
                <th style={{ ...thStyle, width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {entries.map(([name, range]) => (
                <tr key={name}>
                  <td style={tdStyle}>{name}</td>
                  <td style={tdStyle}>
                    <input
                      value={range}
                      onChange={e => updateRange(name, e.target.value)}
                      style={{ width: '100%', border: '1px solid #ddd', padding: '2px 6px', fontSize: 12, boxSizing: 'border-box' }}
                    />
                  </td>
                  <td style={tdStyle}>
                    <button onClick={() => deleteRange(name)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d93025' }}>🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {entries.length === 0 && (
          <div style={{ padding: 16, textAlign: 'center', color: '#999', fontSize: 12, border: '1px dashed #ddd', borderRadius: 4, marginBottom: 12 }}>
            No named ranges defined yet
          </div>
        )}

        {/* Add new */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 8 }}>
          <label style={{ flex: 1 }}>
            <span style={{ fontSize: 11, color: '#555' }}>Name</span>
            <input
              value={newName}
              onChange={e => { setNewName(e.target.value); setError(''); }}
              placeholder="e.g. Revenue"
              style={{ width: '100%', padding: '4px 8px', fontSize: 12, border: '1px solid #ccc', borderRadius: 3, boxSizing: 'border-box' }}
            />
          </label>
          <label style={{ flex: 1 }}>
            <span style={{ fontSize: 11, color: '#555' }}>Range</span>
            <input
              value={newRange}
              onChange={e => { setNewRange(e.target.value); setError(''); }}
              placeholder="e.g. Sheet1!A1:A50 or A1:C10"
              style={{ width: '100%', padding: '4px 8px', fontSize: 12, border: '1px solid #ccc', borderRadius: 3, boxSizing: 'border-box' }}
              onKeyDown={e => { if (e.key === 'Enter') addRange(); }}
            />
          </label>
          <button onClick={addRange} style={{ padding: '5px 12px', fontSize: 12, background: '#4285F4', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            + Add
          </button>
        </div>
        {error && <div style={{ color: '#d93025', fontSize: 11, marginBottom: 8 }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={{ padding: '6px 16px', fontSize: 13 }}>Cancel</button>
          <button
            onClick={() => onSave(ranges)}
            style={{ padding: '6px 16px', fontSize: 13, background: '#4285F4', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000,
};
const dialogStyle: React.CSSProperties = {
  background: '#fff', borderRadius: 8, padding: 24, minWidth: 500, maxWidth: 650, maxHeight: '80vh', overflow: 'auto',
  boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
};
const thStyle: React.CSSProperties = { textAlign: 'left', padding: '6px 8px', borderBottom: '2px solid #ddd', fontSize: 11, color: '#555' };
const tdStyle: React.CSSProperties = { padding: '4px 8px', borderBottom: '1px solid #eee' };
