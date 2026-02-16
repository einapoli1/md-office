import { useState } from 'react';
import Sparkline, { SparklineData } from './Sparkline';

interface SparklineDialogProps {
  onInsert: (formula: string) => void;
  onClose: () => void;
}

const CHART_TYPES = ['line', 'bar', 'column', 'pie', 'winloss'] as const;

export default function SparklineDialog({ onInsert, onClose }: SparklineDialogProps) {
  const [range, setRange] = useState('');
  const [chartType, setChartType] = useState<string>('line');
  const [color, setColor] = useState('#4285f4');

  const previewData: SparklineData = {
    type: 'sparkline',
    data: [3, 7, 2, 8, 5, 9, 1, 6, 4, 8],
    chartType,
    color,
  };

  const handleInsert = () => {
    if (!range.trim()) return;
    const formula = `=SPARKLINE(${range.trim()}, "${chartType}", "${color}")`;
    onInsert(formula);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.3)', zIndex: 10000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: '#fff', borderRadius: 8, padding: 20, minWidth: 340,
        boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
      }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 16px' }}>Insert Sparkline</h3>

        <label style={{ display: 'block', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Data Range</span>
          <input
            type="text"
            value={range}
            onChange={e => setRange(e.target.value)}
            placeholder="e.g. A1:A10"
            style={{ display: 'block', width: '100%', padding: '6px 8px', marginTop: 4, border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box' }}
          />
        </label>

        <label style={{ display: 'block', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Chart Type</span>
          <select
            value={chartType}
            onChange={e => setChartType(e.target.value)}
            style={{ display: 'block', width: '100%', padding: '6px 8px', marginTop: 4, border: '1px solid #ccc', borderRadius: 4 }}
          >
            {CHART_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Color</span>
          <input type="color" value={color} onChange={e => setColor(e.target.value)} />
        </label>

        <div style={{ border: '1px solid #eee', borderRadius: 4, padding: 8, marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
          <Sparkline data={previewData} width={200} height={80} showLabels />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '6px 16px', border: '1px solid #ccc', borderRadius: 4, background: '#fff', cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleInsert} disabled={!range.trim()} style={{ padding: '6px 16px', border: 'none', borderRadius: 4, background: '#4285f4', color: '#fff', cursor: 'pointer', opacity: range.trim() ? 1 : 0.5 }}>Insert</button>
        </div>
      </div>
    </div>
  );
}
