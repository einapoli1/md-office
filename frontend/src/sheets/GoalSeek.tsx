import { useState } from 'react';

interface GoalSeekProps {
  onClose: () => void;
  onRun: (targetCell: string, targetValue: number, changingCell: string) => GoalSeekResult | null;
}

export interface GoalSeekResult {
  found: boolean;
  value: number;
  iterations: number;
  delta: number;
}

export function goalSeek(
  getCellValue: (ref: string) => number,
  setCellValue: (ref: string, val: number) => void,
  recalc: () => void,
  targetCell: string,
  targetValue: number,
  changingCell: string,
  maxIter = 100,
  tolerance = 1e-6
): GoalSeekResult {
  // Bisection + Newton's method hybrid
  const evaluate = (x: number): number => {
    setCellValue(changingCell, x);
    recalc();
    return getCellValue(targetCell) - targetValue;
  };

  let x = getCellValue(changingCell) || 1;
  if (x === 0) x = 1;
  const h = 1e-6;
  let iter = 0;

  // Newton's method
  for (; iter < maxIter; iter++) {
    const fx = evaluate(x);
    if (Math.abs(fx) < tolerance) {
      return { found: true, value: x, iterations: iter, delta: fx };
    }
    const fxh = evaluate(x + h);
    const deriv = (fxh - fx) / h;
    if (Math.abs(deriv) < 1e-15) break;
    x = x - fx / deriv;
  }

  // Fallback: bisection
  let lo = -1e6, hi = 1e6;
  const fLo = evaluate(lo);
  const fHi = evaluate(hi);
  if (fLo * fHi > 0) {
    return { found: false, value: x, iterations: iter, delta: evaluate(x) };
  }

  for (let i = 0; i < maxIter; i++) {
    iter++;
    const mid = (lo + hi) / 2;
    const fMid = evaluate(mid);
    if (Math.abs(fMid) < tolerance) {
      return { found: true, value: mid, iterations: iter, delta: fMid };
    }
    if (fMid * evaluate(lo) < 0) hi = mid;
    else lo = mid;
  }

  const finalX = (lo + hi) / 2;
  return { found: false, value: finalX, iterations: iter, delta: evaluate(finalX) };
}

export default function GoalSeekDialog({ onClose, onRun }: GoalSeekProps) {
  const [targetCell, setTargetCell] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [changingCell, setChangingCell] = useState('');
  const [result, setResult] = useState<GoalSeekResult | null>(null);
  const [error, setError] = useState('');

  const handleRun = () => {
    setError('');
    setResult(null);
    const tc = targetCell.trim().toUpperCase();
    const cc = changingCell.trim().toUpperCase();
    const tv = parseFloat(targetValue);
    if (!tc.match(/^[A-Z]+\d+$/)) { setError('Invalid target cell'); return; }
    if (!cc.match(/^[A-Z]+\d+$/)) { setError('Invalid changing cell'); return; }
    if (isNaN(tv)) { setError('Invalid target value'); return; }
    const r = onRun(tc, tv, cc);
    if (r) setResult(r);
    else setError('Goal Seek failed');
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 8, padding: 24, minWidth: 350, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 16px' }}>Goal Seek</h3>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>Set cell:</label>
          <input value={targetCell} onChange={e => setTargetCell(e.target.value)} placeholder="e.g. B5" style={{ width: '100%', padding: '6px 8px', border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>To value:</label>
          <input value={targetValue} onChange={e => setTargetValue(e.target.value)} placeholder="e.g. 100" style={{ width: '100%', padding: '6px 8px', border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>By changing cell:</label>
          <input value={changingCell} onChange={e => setChangingCell(e.target.value)} placeholder="e.g. A1" style={{ width: '100%', padding: '6px 8px', border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box' }} />
        </div>
        {error && <div style={{ color: 'red', fontSize: 13, marginBottom: 8 }}>{error}</div>}
        {result && (
          <div style={{ background: result.found ? '#e8f5e9' : '#fff3e0', padding: 12, borderRadius: 4, marginBottom: 12, fontSize: 13 }}>
            <div><strong>{result.found ? 'Solution found!' : 'Approximate solution'}</strong></div>
            <div>Value: {result.value.toPrecision(8)}</div>
            <div>Iterations: {result.iterations}</div>
            <div>Delta: {result.delta.toExponential(4)}</div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '6px 16px', border: '1px solid #ccc', borderRadius: 4, background: '#fff', cursor: 'pointer' }}>Close</button>
          <button onClick={handleRun} style={{ padding: '6px 16px', border: 'none', borderRadius: 4, background: '#1a73e8', color: '#fff', cursor: 'pointer' }}>Seek</button>
        </div>
      </div>
    </div>
  );
}
