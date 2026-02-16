import { useState } from 'react';

export interface SolverConstraint {
  cell: string;
  operator: '<=' | '>=' | '=';
  value: number;
}

export interface SolverConfig {
  objectiveCell: string;
  goal: 'minimize' | 'maximize' | 'target';
  targetValue?: number;
  variableCells: string[];
  constraints: SolverConstraint[];
}

export interface SolverResult {
  success: boolean;
  objectiveValue: number;
  variables: { cell: string; value: number }[];
  iterations: number;
  message: string;
}

export function solve(
  config: SolverConfig,
  getCellValue: (ref: string) => number,
  setCellValue: (ref: string, val: number) => void,
  recalc: () => void,
  maxIter = 500,
  learningRate = 0.01
): SolverResult {
  const vars = config.variableCells;
  const values = vars.map(c => getCellValue(c) || 1);
  const h = 1e-6;

  const evalObj = (): number => {
    vars.forEach((c, i) => setCellValue(c, values[i]));
    recalc();
    const v = getCellValue(config.objectiveCell);
    return config.goal === 'target' ? Math.pow(v - (config.targetValue || 0), 2)
      : config.goal === 'maximize' ? -v : v;
  };

  const checkConstraints = (): boolean => {
    vars.forEach((c, i) => setCellValue(c, values[i]));
    recalc();
    for (const ct of config.constraints) {
      const cv = getCellValue(ct.cell);
      if (ct.operator === '<=' && cv > ct.value + 1e-9) return false;
      if (ct.operator === '>=' && cv < ct.value - 1e-9) return false;
      if (ct.operator === '=' && Math.abs(cv - ct.value) > 1e-6) return false;
    }
    return true;
  };

  let iter = 0;
  let prevLoss = evalObj();
  let lr = learningRate;

  for (; iter < maxIter; iter++) {
    const grads: number[] = [];
    for (let i = 0; i < vars.length; i++) {
      const orig = values[i];
      values[i] = orig + h;
      const f1 = evalObj();
      values[i] = orig;
      const f0 = evalObj();
      grads.push((f1 - f0) / h);
    }

    for (let i = 0; i < vars.length; i++) {
      values[i] -= lr * grads[i];
    }

    const loss = evalObj();
    if (Math.abs(loss - prevLoss) < 1e-10) break;
    if (loss > prevLoss) lr *= 0.5;
    else lr = Math.min(lr * 1.05, 1);
    prevLoss = loss;
  }

  vars.forEach((c, i) => setCellValue(c, values[i]));
  recalc();
  const finalObj = getCellValue(config.objectiveCell);
  const feasible = checkConstraints();

  return {
    success: feasible,
    objectiveValue: finalObj,
    variables: vars.map((c, i) => ({ cell: c, value: values[i] })),
    iterations: iter,
    message: feasible ? 'Solver found a solution.' : 'Solution found but constraints may not be fully satisfied.'
  };
}

interface SolverProps {
  onClose: () => void;
  onSolve: (config: SolverConfig) => SolverResult | null;
}

export default function SolverDialog({ onClose, onSolve }: SolverProps) {
  const [objectiveCell, setObjectiveCell] = useState('');
  const [goal, setGoal] = useState<'minimize' | 'maximize' | 'target'>('minimize');
  const [targetValue, setTargetValue] = useState('');
  const [variableCells, setVariableCells] = useState('');
  const [constraints, setConstraints] = useState<{ cell: string; operator: '<=' | '>=' | '='; value: string }[]>([]);
  const [result, setResult] = useState<SolverResult | null>(null);
  const [error, setError] = useState('');

  const addConstraint = () => setConstraints([...constraints, { cell: '', operator: '<=', value: '' }]);
  const removeConstraint = (i: number) => setConstraints(constraints.filter((_, idx) => idx !== i));

  const handleSolve = () => {
    setError('');
    setResult(null);
    const oc = objectiveCell.trim().toUpperCase();
    if (!oc.match(/^[A-Z]+\d+$/)) { setError('Invalid objective cell'); return; }
    const vc = variableCells.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    if (vc.length === 0 || vc.some(c => !c.match(/^[A-Z]+\d+$/))) { setError('Invalid variable cells'); return; }

    const parsedConstraints: SolverConstraint[] = [];
    for (const ct of constraints) {
      const cc = ct.cell.trim().toUpperCase();
      const v = parseFloat(ct.value);
      if (!cc.match(/^[A-Z]+\d+$/) || isNaN(v)) { setError('Invalid constraint'); return; }
      parsedConstraints.push({ cell: cc, operator: ct.operator, value: v });
    }

    const config: SolverConfig = {
      objectiveCell: oc, goal, variableCells: vc, constraints: parsedConstraints,
      ...(goal === 'target' ? { targetValue: parseFloat(targetValue) } : {})
    };
    if (goal === 'target' && isNaN(config.targetValue!)) { setError('Invalid target value'); return; }
    const r = onSolve(config);
    if (r) setResult(r);
    else setError('Solver failed');
  };

  const inputStyle = { width: '100%', padding: '6px 8px', border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box' as const };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 8, padding: 24, minWidth: 420, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 16px' }}>Solver</h3>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>Objective cell:</label>
          <input value={objectiveCell} onChange={e => setObjectiveCell(e.target.value)} placeholder="e.g. D1" style={inputStyle} />
        </div>
        <div style={{ marginBottom: 12, display: 'flex', gap: 12, fontSize: 13 }}>
          <label><input type="radio" checked={goal === 'minimize'} onChange={() => setGoal('minimize')} /> Min</label>
          <label><input type="radio" checked={goal === 'maximize'} onChange={() => setGoal('maximize')} /> Max</label>
          <label><input type="radio" checked={goal === 'target'} onChange={() => setGoal('target')} /> Target</label>
          {goal === 'target' && <input value={targetValue} onChange={e => setTargetValue(e.target.value)} placeholder="Value" style={{ width: 80, padding: '4px 6px', border: '1px solid #ccc', borderRadius: 4 }} />}
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>Variable cells (comma-separated):</label>
          <input value={variableCells} onChange={e => setVariableCells(e.target.value)} placeholder="e.g. A1,A2,A3" style={inputStyle} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>Constraints:</label>
          {constraints.map((ct, i) => (
            <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center' }}>
              <input value={ct.cell} onChange={e => { const c = [...constraints]; c[i] = { ...c[i], cell: e.target.value }; setConstraints(c); }} placeholder="Cell" style={{ width: 70, padding: '4px 6px', border: '1px solid #ccc', borderRadius: 4 }} />
              <select value={ct.operator} onChange={e => { const c = [...constraints]; c[i] = { ...c[i], operator: e.target.value as '<=' | '>=' | '=' }; setConstraints(c); }} style={{ padding: '4px', border: '1px solid #ccc', borderRadius: 4 }}>
                <option value="<=">≤</option>
                <option value=">=">≥</option>
                <option value="=">=</option>
              </select>
              <input value={ct.value} onChange={e => { const c = [...constraints]; c[i] = { ...c[i], value: e.target.value }; setConstraints(c); }} placeholder="Value" style={{ width: 80, padding: '4px 6px', border: '1px solid #ccc', borderRadius: 4 }} />
              <button onClick={() => removeConstraint(i)} style={{ padding: '2px 8px', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', background: '#fff' }}>✕</button>
            </div>
          ))}
          <button onClick={addConstraint} style={{ fontSize: 12, padding: '4px 12px', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', background: '#fff', marginTop: 4 }}>+ Add constraint</button>
        </div>
        {error && <div style={{ color: 'red', fontSize: 13, marginBottom: 8 }}>{error}</div>}
        {result && (
          <div style={{ background: result.success ? '#e8f5e9' : '#fff3e0', padding: 12, borderRadius: 4, marginBottom: 12, fontSize: 13 }}>
            <div><strong>{result.message}</strong></div>
            <div>Objective value: {result.objectiveValue.toPrecision(8)}</div>
            <div>Iterations: {result.iterations}</div>
            <div style={{ marginTop: 4 }}>
              {result.variables.map(v => <div key={v.cell}>{v.cell} = {v.value.toPrecision(8)}</div>)}
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '6px 16px', border: '1px solid #ccc', borderRadius: 4, background: '#fff', cursor: 'pointer' }}>Close</button>
          <button onClick={handleSolve} style={{ padding: '6px 16px', border: 'none', borderRadius: 4, background: '#1a73e8', color: '#fff', cursor: 'pointer' }}>Solve</button>
        </div>
      </div>
    </div>
  );
}
