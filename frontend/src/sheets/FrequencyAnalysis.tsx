import { useState } from 'react';

export interface DescriptiveStats {
  count: number;
  mean: number;
  median: number;
  mode: number[];
  min: number;
  max: number;
  range: number;
  sum: number;
  variance: number;
  stdDev: number;
  q1: number;
  q3: number;
  iqr: number;
  skewness: number;
  kurtosis: number;
}

export function computeDescriptiveStats(values: number[]): DescriptiveStats | null {
  if (values.length === 0) return null;
  const n = values.length;
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / n;

  const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];

  const percentile = (p: number): number => {
    const idx = (p / 100) * (n - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  };

  const q1 = percentile(25);
  const q3 = percentile(75);

  // Mode
  const freq = new Map<number, number>();
  for (const v of values) freq.set(v, (freq.get(v) || 0) + 1);
  const maxFreq = Math.max(...freq.values());
  const mode = maxFreq > 1 ? [...freq.entries()].filter(([, f]) => f === maxFreq).map(([v]) => v) : [];

  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n > 1 ? n - 1 : 1);
  const stdDev = Math.sqrt(variance);

  const m3 = values.reduce((s, v) => s + ((v - mean) / (stdDev || 1)) ** 3, 0) / n;
  const m4 = values.reduce((s, v) => s + ((v - mean) / (stdDev || 1)) ** 4, 0) / n;

  return {
    count: n, mean, median, mode,
    min: sorted[0], max: sorted[n - 1], range: sorted[n - 1] - sorted[0],
    sum, variance, stdDev, q1, q3, iqr: q3 - q1,
    skewness: m3, kurtosis: m4 - 3
  };
}

export interface FrequencyBin {
  label: string;
  from: number;
  to: number;
  count: number;
  relativeFreq: number;
  cumulativeFreq: number;
}

export function computeFrequencyDistribution(values: number[], bins = 10): FrequencyBin[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = (max - min) / bins || 1;
  const result: FrequencyBin[] = [];
  let cumulative = 0;

  for (let i = 0; i < bins; i++) {
    const from = min + i * width;
    const to = i === bins - 1 ? max + 0.001 : from + width;
    const count = values.filter(v => v >= from && v < to).length;
    cumulative += count;
    result.push({
      label: `${from.toFixed(2)} - ${(to - (i === bins - 1 ? 0.001 : 0)).toFixed(2)}`,
      from, to, count,
      relativeFreq: count / values.length,
      cumulativeFreq: cumulative / values.length
    });
  }
  return result;
}

interface FrequencyAnalysisProps {
  values: number[];
  selectedRange: string;
  onClose: () => void;
  onInsert?: (data: string[][]) => void;
}

export default function FrequencyAnalysisDialog({ values, selectedRange, onClose, onInsert }: FrequencyAnalysisProps) {
  const [tab, setTab] = useState<'stats' | 'frequency'>('stats');
  const [numBins, setNumBins] = useState(10);

  const stats = computeDescriptiveStats(values);
  const freq = computeFrequencyDistribution(values, numBins);

  const formatNum = (n: number) => {
    if (Number.isInteger(n) && Math.abs(n) < 1e10) return n.toString();
    return n.toPrecision(6);
  };

  const handleInsertStats = () => {
    if (!stats || !onInsert) return;
    const data: string[][] = [
      ['Statistic', 'Value'],
      ['Count', String(stats.count)],
      ['Sum', formatNum(stats.sum)],
      ['Mean', formatNum(stats.mean)],
      ['Median', formatNum(stats.median)],
      ['Mode', stats.mode.length > 0 ? stats.mode.map(formatNum).join(', ') : 'N/A'],
      ['Min', formatNum(stats.min)],
      ['Max', formatNum(stats.max)],
      ['Range', formatNum(stats.range)],
      ['Variance', formatNum(stats.variance)],
      ['Std Dev', formatNum(stats.stdDev)],
      ['Q1', formatNum(stats.q1)],
      ['Q3', formatNum(stats.q3)],
      ['IQR', formatNum(stats.iqr)],
      ['Skewness', formatNum(stats.skewness)],
      ['Kurtosis', formatNum(stats.kurtosis)],
    ];
    onInsert(data);
  };

  const tabStyle = (active: boolean) => ({
    padding: '8px 16px', cursor: 'pointer', border: 'none',
    borderBottom: active ? '2px solid #1a73e8' : '2px solid transparent',
    background: 'none', fontWeight: active ? 600 : 400 as number | undefined,
    color: active ? '#1a73e8' : '#333'
  });

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 8, padding: 24, minWidth: 450, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 4px' }}>Descriptive Statistics</h3>
        <div style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>Range: {selectedRange} ({values.length} values)</div>
        <div style={{ display: 'flex', borderBottom: '1px solid #e0e0e0', marginBottom: 12 }}>
          <button style={tabStyle(tab === 'stats')} onClick={() => setTab('stats')}>Statistics</button>
          <button style={tabStyle(tab === 'frequency')} onClick={() => setTab('frequency')}>Frequency</button>
        </div>

        {tab === 'stats' && stats && (
          <div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <tbody>
                {([
                  ['Count', stats.count], ['Sum', stats.sum], ['Mean', stats.mean], ['Median', stats.median],
                  ['Mode', stats.mode.length > 0 ? stats.mode.map(formatNum).join(', ') : 'N/A'],
                  ['Min', stats.min], ['Max', stats.max], ['Range', stats.range],
                  ['Variance', stats.variance], ['Std Dev', stats.stdDev],
                  ['Q1 (25%)', stats.q1], ['Q3 (75%)', stats.q3], ['IQR', stats.iqr],
                  ['Skewness', stats.skewness], ['Kurtosis', stats.kurtosis],
                ] as [string, number | string][]).map(([label, val]) => (
                  <tr key={label} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '6px 8px', fontWeight: 500 }}>{label}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{typeof val === 'number' ? formatNum(val) : val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'frequency' && (
          <div>
            <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <label>Bins:</label>
              <input type="number" value={numBins} min={2} max={50} onChange={e => setNumBins(Math.max(2, parseInt(e.target.value) || 10))} style={{ width: 60, padding: '4px 6px', border: '1px solid #ccc', borderRadius: 4 }} />
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f5f5f5' }}>
                  <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Bin</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #ddd' }}>Count</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #ddd' }}>Rel. Freq</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #ddd' }}>Cum. Freq</th>
                  <th style={{ padding: '6px 8px', borderBottom: '1px solid #ddd', width: 100 }}>Bar</th>
                </tr>
              </thead>
              <tbody>
                {freq.map((bin, i) => {
                  const maxCount = Math.max(...freq.map(b => b.count), 1);
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>{bin.label}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right' }}>{bin.count}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right' }}>{(bin.relativeFreq * 100).toFixed(1)}%</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right' }}>{(bin.cumulativeFreq * 100).toFixed(1)}%</td>
                      <td style={{ padding: '4px 8px' }}>
                        <div style={{ background: '#4285f4', height: 14, width: `${(bin.count / maxCount) * 100}%`, borderRadius: 2 }} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!stats && <div style={{ padding: 20, textAlign: 'center', color: '#999' }}>No numeric values in selected range.</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          {onInsert && stats && <button onClick={handleInsertStats} style={{ padding: '6px 16px', border: '1px solid #ccc', borderRadius: 4, background: '#fff', cursor: 'pointer' }}>Insert to Sheet</button>}
          <button onClick={onClose} style={{ padding: '6px 16px', border: '1px solid #ccc', borderRadius: 4, background: '#fff', cursor: 'pointer' }}>Close</button>
        </div>
      </div>
    </div>
  );
}
