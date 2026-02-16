import React, { useState } from 'react';
import { X } from 'lucide-react';

type Position = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
type Format = '1' | 'i' | 'a' | 'A' | 'xofy';

interface PageNumberDialogProps {
  onClose: () => void;
  onApply: (settings: PageNumberSettings) => void;
}

export interface PageNumberSettings {
  position: Position;
  format: Format;
  startFrom: number;
  differentFirstPage: boolean;
  restartEachSection: boolean;
}

const formatLabel: Record<Format, string> = {
  '1': '1, 2, 3, …',
  'i': 'i, ii, iii, …',
  'a': 'a, b, c, …',
  'A': 'A, B, C, …',
  'xofy': 'Page X of Y',
};

function formatPageNum(n: number, fmt: Format, total: number = 10): string {
  switch (fmt) {
    case 'i': {
      const vals = ['', 'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x'];
      return vals[n] || n.toString();
    }
    case 'a': return String.fromCharCode(96 + n);
    case 'A': return String.fromCharCode(64 + n);
    case 'xofy': return `Page ${n} of ${total}`;
    default: return n.toString();
  }
}

const POSITIONS: { value: Position; label: string }[] = [
  { value: 'top-left', label: 'Top Left' },
  { value: 'top-center', label: 'Top Center' },
  { value: 'top-right', label: 'Top Right' },
  { value: 'bottom-left', label: 'Bottom Left' },
  { value: 'bottom-center', label: 'Bottom Center' },
  { value: 'bottom-right', label: 'Bottom Right' },
];

const PageNumberDialog: React.FC<PageNumberDialogProps> = ({ onClose, onApply }) => {
  const [position, setPosition] = useState<Position>('bottom-center');
  const [format, setFormat] = useState<Format>('1');
  const [startFrom, setStartFrom] = useState(1);
  const [differentFirstPage, setDifferentFirstPage] = useState(false);
  const [restartEachSection, setRestartEachSection] = useState(false);

  const handleApply = () => {
    onApply({ position, format, startFrom, differentFirstPage, restartEachSection });
    onClose();
  };

  const posStyle = (pos: Position): React.CSSProperties => {
    const base: React.CSSProperties = { position: 'absolute', fontSize: 9, color: '#1a73e8', fontWeight: 600 };
    if (pos.startsWith('top')) base.top = 6;
    else base.bottom = 6;
    if (pos.endsWith('left')) base.left = 8;
    else if (pos.endsWith('center')) { base.left = '50%'; base.transform = 'translateX(-50%)'; }
    else base.right = 8;
    return base;
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{ background: 'var(--bg, #fff)', borderRadius: 8, width: 480, padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Page Numbers</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontWeight: 600, fontSize: 13 }}>Position</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 4 }}>
            {POSITIONS.map(p => (
              <button key={p.value} onClick={() => setPosition(p.value)}
                style={{ padding: '6px 8px', borderRadius: 4, fontSize: 12, cursor: 'pointer',
                  border: position === p.value ? '2px solid #1a73e8' : '1px solid #ccc',
                  background: position === p.value ? '#e8f0fe' : 'transparent' }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontWeight: 600, fontSize: 13 }}>Format</label>
          <select value={format} onChange={e => setFormat(e.target.value as Format)} style={{ width: '100%', padding: 6, marginTop: 4 }}>
            {(Object.keys(formatLabel) as Format[]).map(f => <option key={f} value={f}>{formatLabel[f]}</option>)}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ fontWeight: 600, fontSize: 13 }}>Start from</label>
            <input type="number" value={startFrom} onChange={e => setStartFrom(+e.target.value)} min={0} style={{ width: '100%', padding: 6, marginTop: 4 }} />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <input type="checkbox" checked={differentFirstPage} onChange={e => setDifferentFirstPage(e.target.checked)} />
            Different first page (no number on page 1)
          </label>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <input type="checkbox" checked={restartEachSection} onChange={e => setRestartEachSection(e.target.checked)} />
            Restart numbering at each section break
          </label>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontWeight: 600, fontSize: 13 }}>Preview</label>
          <div style={{ marginTop: 8, border: '1px solid #ccc', background: '#fff', color: '#000', width: 180, height: 240, position: 'relative', margin: '0 auto' }}>
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} style={{ position: 'absolute', left: 12, right: 12, top: 30 + i * 16, height: 2, background: '#e0e0e0', borderRadius: 1 }} />
            ))}
            <div style={posStyle(position)}>
              {formatPageNum(startFrom, format, 5)}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 4, border: '1px solid #ccc', background: 'transparent', cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleApply} style={{ padding: '8px 16px', borderRadius: 4, border: 'none', background: '#1a73e8', color: '#fff', cursor: 'pointer' }}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};

export default PageNumberDialog;
