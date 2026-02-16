import { useState, useEffect, useRef, useMemo } from 'react';
import { parseFormulaRefs, FormulaRef } from './fillLogic';

interface FormulaBarProps {
  cellRef: string;
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  formulaRefs?: FormulaRef[];
}

const AVAILABLE_FUNCTIONS = [
  { name: 'SUM', desc: 'Sum of values', syntax: 'SUM(range)' },
  { name: 'AVERAGE', desc: 'Average of values', syntax: 'AVERAGE(range)' },
  { name: 'COUNT', desc: 'Count of numbers', syntax: 'COUNT(range)' },
  { name: 'MIN', desc: 'Minimum value', syntax: 'MIN(range)' },
  { name: 'MAX', desc: 'Maximum value', syntax: 'MAX(range)' },
  { name: 'IF', desc: 'Conditional', syntax: 'IF(condition, true_val, false_val)' },
  { name: 'CONCATENATE', desc: 'Join text', syntax: 'CONCATENATE(text1, text2, ...)' },
  { name: 'ABS', desc: 'Absolute value', syntax: 'ABS(number)' },
  { name: 'ROUND', desc: 'Round number', syntax: 'ROUND(number, digits)' },
  { name: 'NOW', desc: 'Current date/time', syntax: 'NOW()' },
  { name: 'TODAY', desc: 'Current date', syntax: 'TODAY()' },
];

export default function FormulaBar({ cellRef, value, onChange, onCommit, onCancel, formulaRefs }: FormulaBarProps) {
  const [showFunctions, setShowFunctions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setShowFunctions(false);
  }, [cellRef]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onCommit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  const insertFunction = (fname: string) => {
    onChange(`=${fname}(`);
    setShowFunctions(false);
    inputRef.current?.focus();
  };

  // Build colored formula display
  const coloredFormula = useMemo(() => {
    if (!formulaRefs || formulaRefs.length === 0 || !value.startsWith('=')) return null;
    const parts: React.ReactNode[] = [];
    let lastIdx = 0;
    // Sort refs by startIdx
    const sorted = [...formulaRefs].sort((a, b) => a.startIdx - b.startIdx);
    for (const ref of sorted) {
      if (ref.startIdx > lastIdx) {
        parts.push(<span key={`t${lastIdx}`}>{value.slice(lastIdx, ref.startIdx)}</span>);
      }
      parts.push(
        <span
          key={`r${ref.startIdx}`}
          className="formula-ref-colored"
          style={{ color: ref.color, backgroundColor: ref.color + '18' }}
        >
          {value.slice(ref.startIdx, ref.endIdx)}
        </span>
      );
      lastIdx = ref.endIdx;
    }
    if (lastIdx < value.length) {
      parts.push(<span key={`t${lastIdx}`}>{value.slice(lastIdx)}</span>);
    }
    return parts;
  }, [value, formulaRefs]);

  return (
    <div className="sheet-formula-bar">
      <div className="formula-cell-ref">{cellRef}</div>
      <button
        className="formula-fx-btn"
        onClick={() => setShowFunctions(!showFunctions)}
        title="Functions"
      >
        <em>f</em>x
      </button>
      <div className="formula-input-wrapper" style={{ position: 'relative', flex: 1 }}>
        <input
          ref={inputRef}
          className="formula-input"
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          style={coloredFormula ? { color: 'transparent', caretColor: '#333' } : undefined}
        />
        {coloredFormula && (
          <div
            className="formula-input-overlay"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              padding: '0 6px',
              fontSize: 'inherit',
              fontFamily: 'inherit',
              whiteSpace: 'pre',
              overflow: 'hidden',
            }}
          >
            {coloredFormula}
          </div>
        )}
      </div>
      {showFunctions && (
        <div className="formula-functions-dropdown">
          {AVAILABLE_FUNCTIONS.map(f => (
            <div
              key={f.name}
              className="formula-function-item"
              onClick={() => insertFunction(f.name)}
            >
              <strong>{f.name}</strong>
              <span className="formula-function-syntax">{f.syntax}</span>
              <span className="formula-function-desc">{f.desc}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
