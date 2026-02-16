import { useState } from 'react';

interface DataTableProps {
  onClose: () => void;
  onApply: (config: DataTableConfig) => void;
}

export interface DataTableConfig {
  mode: 'one-variable' | 'two-variable';
  formulaCell: string;
  rowInputCell: string;
  colInputCell?: string;
  rowValues: number[];
  colValues?: number[];
}

export interface DataTableResult {
  headers: string[];
  colHeaders?: string[];
  rows: { input: number; values: (number | string)[] }[];
}

export function computeDataTable(
  config: DataTableConfig,
  getCellValue: (ref: string) => number,
  setCellValue: (ref: string, val: number) => void,
  recalc: () => void,
  formulaCell: string
): DataTableResult {
  const origRow = getCellValue(config.rowInputCell);
  const origCol = config.colInputCell ? getCellValue(config.colInputCell) : 0;

  if (config.mode === 'one-variable') {
    const results: DataTableResult = { headers: ['Input', 'Result'], rows: [] };
    for (const v of config.rowValues) {
      setCellValue(config.rowInputCell, v);
      recalc();
      const r = getCellValue(formulaCell);
      results.rows.push({ input: v, values: [r] });
    }
    setCellValue(config.rowInputCell, origRow);
    recalc();
    return results;
  } else {
    const colVals = config.colValues || [];
    const results: DataTableResult = {
      headers: ['Input \\ Col', ...colVals.map(String)],
      colHeaders: colVals.map(String),
      rows: []
    };
    for (const rv of config.rowValues) {
      const vals: (number | string)[] = [];
      for (const cv of colVals) {
        setCellValue(config.rowInputCell, rv);
        if (config.colInputCell) setCellValue(config.colInputCell, cv);
        recalc();
        vals.push(getCellValue(formulaCell));
      }
      results.rows.push({ input: rv, values: vals });
    }
    setCellValue(config.rowInputCell, origRow);
    if (config.colInputCell) setCellValue(config.colInputCell, origCol);
    recalc();
    return results;
  }
}

export default function DataTableDialog({ onClose, onApply }: DataTableProps) {
  const [mode, setMode] = useState<'one-variable' | 'two-variable'>('one-variable');
  const [formulaCell, setFormulaCell] = useState('');
  const [rowInputCell, setRowInputCell] = useState('');
  const [colInputCell, setColInputCell] = useState('');
  const [rowValues, setRowValues] = useState('');
  const [colValues, setColValues] = useState('');
  const [error, setError] = useState('');

  const parseValues = (s: string): number[] | null => {
    const parts = s.split(',').map(v => v.trim()).filter(Boolean);
    const nums = parts.map(Number);
    if (nums.some(isNaN)) return null;
    return nums;
  };

  const handleApply = () => {
    setError('');
    const fc = formulaCell.trim().toUpperCase();
    const rc = rowInputCell.trim().toUpperCase();
    if (!fc.match(/^[A-Z]+\d+$/)) { setError('Invalid formula cell'); return; }
    if (!rc.match(/^[A-Z]+\d+$/)) { setError('Invalid row input cell'); return; }
    const rv = parseValues(rowValues);
    if (!rv || rv.length === 0) { setError('Invalid row values (comma-separated numbers)'); return; }

    const config: DataTableConfig = { mode, formulaCell: fc, rowInputCell: rc, rowValues: rv };
    if (mode === 'two-variable') {
      const cc = colInputCell.trim().toUpperCase();
      if (!cc.match(/^[A-Z]+\d+$/)) { setError('Invalid column input cell'); return; }
      const cv = parseValues(colValues);
      if (!cv || cv.length === 0) { setError('Invalid column values'); return; }
      config.colInputCell = cc;
      config.colValues = cv;
    }
    onApply(config);
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 8, padding: 24, minWidth: 400, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 16px' }}>What-If Data Table</h3>
        <div style={{ marginBottom: 12 }}>
          <label style={{ marginRight: 12, fontSize: 13 }}>
            <input type="radio" checked={mode === 'one-variable'} onChange={() => setMode('one-variable')} /> One-variable
          </label>
          <label style={{ fontSize: 13 }}>
            <input type="radio" checked={mode === 'two-variable'} onChange={() => setMode('two-variable')} /> Two-variable
          </label>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>Formula cell:</label>
          <input value={formulaCell} onChange={e => setFormulaCell(e.target.value)} placeholder="e.g. C1" style={{ width: '100%', padding: '6px 8px', border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>Row input cell:</label>
          <input value={rowInputCell} onChange={e => setRowInputCell(e.target.value)} placeholder="e.g. A1" style={{ width: '100%', padding: '6px 8px', border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>Row values (comma-separated):</label>
          <input value={rowValues} onChange={e => setRowValues(e.target.value)} placeholder="e.g. 1,2,3,4,5" style={{ width: '100%', padding: '6px 8px', border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box' }} />
        </div>
        {mode === 'two-variable' && (
          <>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>Column input cell:</label>
              <input value={colInputCell} onChange={e => setColInputCell(e.target.value)} placeholder="e.g. B1" style={{ width: '100%', padding: '6px 8px', border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>Column values (comma-separated):</label>
              <input value={colValues} onChange={e => setColValues(e.target.value)} placeholder="e.g. 10,20,30" style={{ width: '100%', padding: '6px 8px', border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box' }} />
            </div>
          </>
        )}
        {error && <div style={{ color: 'red', fontSize: 13, marginBottom: 8 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '6px 16px', border: '1px solid #ccc', borderRadius: 4, background: '#fff', cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleApply} style={{ padding: '6px 16px', border: 'none', borderRadius: 4, background: '#1a73e8', color: '#fff', cursor: 'pointer' }}>Create Table</button>
        </div>
      </div>
    </div>
  );
}
