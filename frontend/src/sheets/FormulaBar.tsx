import { useState, useEffect, useRef, useMemo } from 'react';
import type { FormulaRef } from './fillLogic';
import { ALL_FUNCTIONS } from './CellAutocomplete';
import type { FunctionInfo } from './CellAutocomplete';

interface FormulaBarProps {
  cellRef: string;
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  formulaRefs?: FormulaRef[];
}

// Parse the formula to find which function and parameter the cursor is inside
function getFunctionAtCursor(formula: string, cursorPos: number): { func: FunctionInfo; paramIndex: number } | null {
  if (!formula.startsWith('=')) return null;

  // Walk backwards from cursor to find the innermost function call
  let depth = 0;
  let commaCount = 0;
  let funcEnd = -1;

  for (let i = cursorPos - 1; i >= 0; i--) {
    const ch = formula[i];
    if (ch === ')') {
      depth++;
    } else if (ch === '(') {
      if (depth > 0) {
        depth--;
      } else {
        funcEnd = i;
        break;
      }
    } else if (ch === ',' && depth === 0) {
      commaCount++;
    }
  }

  if (funcEnd < 0) return null;

  // Extract function name before the opening paren
  let funcStart = funcEnd - 1;
  while (funcStart >= 0 && /[A-Za-z_]/.test(formula[funcStart])) {
    funcStart--;
  }
  funcStart++;

  const funcName = formula.slice(funcStart, funcEnd).toUpperCase();
  const funcInfo = ALL_FUNCTIONS.find(f => f.name === funcName);
  if (!funcInfo) return null;

  return { func: funcInfo, paramIndex: commaCount };
}

export default function FormulaBar({ cellRef, value, onChange, onCommit, onCancel, formulaRefs }: FormulaBarProps) {
  const [showFunctions, setShowFunctions] = useState(false);
  const [cursorPos, setCursorPos] = useState(0);
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

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setCursorPos(e.target.selectionStart ?? 0);
  };

  const handleSelect = () => {
    setCursorPos(inputRef.current?.selectionStart ?? 0);
  };

  const insertFunction = (fname: string) => {
    onChange(`=${fname}(`);
    setShowFunctions(false);
    inputRef.current?.focus();
  };

  // Function signature tooltip
  const signatureInfo = useMemo(() => {
    if (!value.startsWith('=')) return null;
    return getFunctionAtCursor(value, cursorPos);
  }, [value, cursorPos]);

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
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onSelect={handleSelect}
          onClick={handleSelect}
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

        {/* Function signature tooltip */}
        {signatureInfo && (
          <div
            className="formula-signature-tooltip"
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 4,
              background: '#1e1e1e',
              color: '#d4d4d4',
              padding: '6px 10px',
              borderRadius: 4,
              fontSize: 12,
              fontFamily: 'monospace',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              zIndex: 1200,
              whiteSpace: 'nowrap',
              maxWidth: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            <div style={{ marginBottom: 2 }}>
              <span style={{ color: '#569cd6', fontWeight: 600 }}>{signatureInfo.func.name}</span>
              <span style={{ color: '#888' }}>(</span>
              {signatureInfo.func.params?.map((p, i) => (
                <span key={p.name}>
                  {i > 0 && <span style={{ color: '#888' }}>, </span>}
                  <span style={{
                    color: i === signatureInfo.paramIndex ? '#dcdcaa' : '#9cdcfe',
                    fontWeight: i === signatureInfo.paramIndex ? 700 : 400,
                    textDecoration: i === signatureInfo.paramIndex ? 'underline' : 'none',
                  }}>
                    {p.name}
                  </span>
                </span>
              ))}
              <span style={{ color: '#888' }}>)</span>
            </div>
            {signatureInfo.func.params && signatureInfo.func.params[signatureInfo.paramIndex] && (
              <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                <span style={{ color: '#dcdcaa' }}>
                  {signatureInfo.func.params[signatureInfo.paramIndex].name}
                </span>
                {' — '}
                {signatureInfo.func.params[signatureInfo.paramIndex].desc}
              </div>
            )}
            <div style={{ fontSize: 10, color: '#666', marginTop: 2 }}>
              {signatureInfo.func.desc}
            </div>
          </div>
        )}
      </div>
      {showFunctions && (
        <div className="formula-functions-dropdown">
          {ALL_FUNCTIONS.slice(0, 20).map(f => (
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
