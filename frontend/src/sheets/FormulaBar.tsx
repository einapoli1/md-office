import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { FormulaRef } from './fillLogic';
import { ALL_FUNCTIONS } from './CellAutocomplete';
import type { FunctionInfo } from './CellAutocomplete';
import { isArrayFormula } from './formulaEngine';
import { aiFormulaSuggestion, isAIConfigured } from '../lib/aiProvider';

interface FormulaBarProps {
  cellRef: string;
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  formulaRefs?: FormulaRef[];
  sheetNames?: string[];       // available sheet names for cross-sheet autocomplete
  isArrayFormulaSrc?: boolean;  // whether this cell is an array formula source
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

export default function FormulaBar({ cellRef, value, onChange, onCommit, onCancel, formulaRefs, sheetNames, isArrayFormulaSrc }: FormulaBarProps) {
  const [showFunctions, setShowFunctions] = useState(false);
  const [cursorPos, setCursorPos] = useState(0);
  const [sheetSuggestions, setSheetSuggestions] = useState<string[]>([]);
  const [showAIPrompt, setShowAIPrompt] = useState(false);
  const [aiPromptText, setAIPromptText] = useState('');
  const [aiLoading, setAILoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Whether the current value is an array formula
  const isArray = isArrayFormulaSrc || isArrayFormula(value);

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

  // Check for cross-sheet reference autocomplete
  const checkSheetAutocomplete = useCallback((val: string, pos: number) => {
    if (!sheetNames || sheetNames.length === 0) { setSheetSuggestions([]); return; }
    // Look backwards from cursor for a partial sheet name (after = or operator)
    const before = val.slice(0, pos);
    // Match partial word that could be a sheet name (after =, +, -, *, /, (, ,)
    const match = before.match(/(?:^=|[+\-*/,(])([A-Za-z0-9_ ]{1,50})$/);
    if (match) {
      const partial = match[1].toLowerCase();
      const matches = sheetNames.filter(s => s.toLowerCase().startsWith(partial) && s.toLowerCase() !== partial);
      setSheetSuggestions(matches.slice(0, 5));
    } else {
      setSheetSuggestions([]);
    }
  }, [sheetNames]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    const pos = e.target.selectionStart ?? 0;
    setCursorPos(pos);
    checkSheetAutocomplete(e.target.value, pos);
  };

  const handleSelect = () => {
    setCursorPos(inputRef.current?.selectionStart ?? 0);
  };

  const insertFunction = (fname: string) => {
    onChange(`=${fname}(`);
    setShowFunctions(false);
    setSheetSuggestions([]);
    inputRef.current?.focus();
  };

  const insertSheetRef = (sheetName: string) => {
    const before = value.slice(0, cursorPos);
    const match = before.match(/(?:^=|[+\-*/,(])([A-Za-z0-9_ ]{1,50})$/);
    if (match) {
      const start = cursorPos - match[1].length;
      const prefix = sheetName.includes(' ') ? `'${sheetName}'!` : `${sheetName}!`;
      const newVal = value.slice(0, start) + prefix + value.slice(cursorPos);
      onChange(newVal);
    }
    setSheetSuggestions([]);
    inputRef.current?.focus();
  };

  // Display value — show {} braces for array formulas
  const displayValue = isArray && value.startsWith('=') && !value.startsWith('{=')
    ? `{${value}}`
    : value;

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
      <button
        className="formula-fx-btn"
        onClick={() => setShowAIPrompt(!showAIPrompt)}
        title="AI Formula Suggestion"
        style={{ fontSize: 11 }}
      >
        ✨AI
      </button>
      {isArray && (
        <span
          className="formula-array-badge"
          title="Array formula — results spill across multiple cells"
          style={{
            padding: '1px 5px',
            fontSize: 10,
            fontWeight: 700,
            color: '#1a73e8',
            background: '#e3f2fd',
            borderRadius: 3,
            marginRight: 4,
            userSelect: 'none',
          }}
        >
          {'{…}'}
        </span>
      )}
      <div className="formula-input-wrapper" style={{ position: 'relative', flex: 1 }}>
        <input
          ref={inputRef}
          className="formula-input"
          value={displayValue}
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

        {/* Cross-sheet reference autocomplete */}
        {sheetSuggestions.length > 0 && (
          <div
            className="sheet-ref-suggestions"
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 2,
              background: '#fff',
              border: '1px solid #ccc',
              borderRadius: 4,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              zIndex: 1300,
              minWidth: 150,
              maxHeight: 150,
              overflowY: 'auto',
            }}
          >
            {sheetSuggestions.map(name => (
              <div
                key={name}
                className="sheet-ref-item"
                onClick={() => insertSheetRef(name)}
                style={{
                  padding: '4px 10px',
                  cursor: 'pointer',
                  fontSize: 12,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#e3f2fd')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                📄 {name}!
              </div>
            ))}
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
      {showAIPrompt && (
        <div className="formula-ai-dropdown" style={{
          position: 'absolute', top: '100%', left: 60, zIndex: 1200,
          background: '#1e1e1e', border: '1px solid #444', borderRadius: 6,
          padding: 10, width: 340, boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        }}>
          <div style={{ fontSize: 12, color: '#ccc', marginBottom: 6 }}>
            Describe what you want in English:
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <input
              style={{ flex: 1, background: '#2d2d2d', border: '1px solid #555', color: '#eee', borderRadius: 4, padding: '4px 8px', fontSize: 12 }}
              placeholder="e.g. sum of column B where column A is 'Sales'"
              value={aiPromptText}
              onChange={e => setAIPromptText(e.target.value)}
              onKeyDown={async e => {
                if (e.key === 'Enter' && aiPromptText.trim() && !aiLoading) {
                  setAILoading(true);
                  try {
                    const formula = await aiFormulaSuggestion(aiPromptText);
                    onChange(formula.trim());
                    setShowAIPrompt(false);
                    setAIPromptText('');
                  } catch { /* ignore */ }
                  setAILoading(false);
                }
                if (e.key === 'Escape') setShowAIPrompt(false);
              }}
              autoFocus
              disabled={aiLoading}
            />
            <button
              style={{ background: '#0078d4', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}
              disabled={!aiPromptText.trim() || aiLoading || !isAIConfigured()}
              onClick={async () => {
                if (!aiPromptText.trim() || aiLoading) return;
                setAILoading(true);
                try {
                  const formula = await aiFormulaSuggestion(aiPromptText);
                  onChange(formula.trim());
                  setShowAIPrompt(false);
                  setAIPromptText('');
                } catch { /* ignore */ }
                setAILoading(false);
              }}
            >
              {aiLoading ? '...' : 'Go'}
            </button>
          </div>
          {!isAIConfigured() && (
            <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>
              Configure AI key in Docs → AI Assistant → Settings
            </div>
          )}
        </div>
      )}
    </div>
  );
}
