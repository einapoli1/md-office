import { useState, useEffect, useCallback, useRef } from 'react';
import {
  runMacro,
  MacroContext,
  SavedMacro,
  loadSavedMacros,
  saveMacro,
  deleteMacro,
  EXAMPLE_MACROS,
} from '../lib/macroEngine';

interface MacroEditorProps {
  onClose: () => void;
  getDocText: () => string;
  insertText: (text: string, position?: number) => void;
  replaceAll: (search: string, replace: string) => void;
  getSelection: () => string;
  getCell?: (col: number, row: number) => unknown;
  setCell?: (col: number, row: number, value: unknown) => void;
  getRange?: (startCol: number, startRow: number, endCol: number, endRow: number) => unknown[][];
}

export default function MacroEditor({
  onClose,
  getDocText,
  insertText,
  replaceAll,
  getSelection,
  getCell,
  setCell,
  getRange,
}: MacroEditorProps) {
  const [code, setCode] = useState('// Write your macro here\n// Use md.doc, md.sheet, md.ui\n');
  const [output, setOutput] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [macros, setMacros] = useState<SavedMacro[]>([]);
  const [currentName, setCurrentName] = useState('');
  const [showExamples, setShowExamples] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setMacros(loadSavedMacros());
  }, []);

  const buildContext = useCallback((): MacroContext => ({
    getDocText,
    insertText,
    replaceAll,
    getSelection,
    getCell: getCell ?? (() => undefined),
    setCell: setCell ?? (() => {}),
    getRange: getRange ?? (() => []),
    alert: (msg: string) => {
      setOutput(prev => [...prev, `[alert] ${msg}`]);
      window.alert(msg);
    },
    prompt: (msg: string) => {
      return new Promise(resolve => {
        const val = window.prompt(msg);
        resolve(val);
      });
    },
    toast: (msg: string) => {
      setOutput(prev => [...prev, `[toast] ${msg}`]);
      window.dispatchEvent(new CustomEvent('macro-toast', { detail: { message: msg } }));
    },
    log: (msg: string) => {
      setOutput(prev => [...prev, msg]);
    },
  }), [getDocText, insertText, replaceAll, getSelection, getCell, setCell, getRange]);

  const handleRun = useCallback(async () => {
    setRunning(true);
    setOutput([]);
    const result = await runMacro(code, buildContext());
    if (result.error) {
      setOutput(prev => [...prev, `❌ Error: ${result.error}`]);
    } else if (result.returnValue !== undefined) {
      setOutput(prev => [...prev, `→ ${JSON.stringify(result.returnValue)}`]);
    }
    setRunning(false);
  }, [code, buildContext]);

  const handleSave = useCallback(() => {
    const name = currentName.trim() || window.prompt('Macro name:');
    if (!name) return;
    const now = Date.now();
    const existing = macros.find(m => m.name === name);
    saveMacro({
      name,
      code,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
    setCurrentName(name);
    setMacros(loadSavedMacros());
  }, [currentName, code, macros]);

  const handleDelete = useCallback((name: string) => {
    if (!window.confirm(`Delete macro "${name}"?`)) return;
    deleteMacro(name);
    setMacros(loadSavedMacros());
    if (currentName === name) setCurrentName('');
  }, [currentName]);

  const handleLoad = useCallback((macro: SavedMacro) => {
    setCode(macro.code);
    setCurrentName(macro.name);
    setOutput([]);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleRun();
    }
    // Tab support in textarea
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = textareaRef.current;
      if (ta) {
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const val = ta.value;
        setCode(val.substring(0, start) + '  ' + val.substring(end));
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = start + 2;
        });
      }
    }
  }, [handleRun]);

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: 520,
      background: 'var(--bg, #fff)', borderLeft: '1px solid #ddd',
      display: 'flex', flexDirection: 'column', zIndex: 1000,
      boxShadow: '-2px 0 8px rgba(0,0,0,0.1)',
      fontFamily: 'system-ui, sans-serif', fontSize: 13,
    }}>
      {/* Header */}
      <div style={{
        padding: '8px 12px', borderBottom: '1px solid #ddd',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontWeight: 600, flex: 1 }}>
          📜 Macro Editor {currentName && `— ${currentName}`}
        </span>
        <button onClick={handleRun} disabled={running}
          style={{ padding: '4px 10px', background: '#4CAF50', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
          {running ? '⏳' : '▶'} Run
        </button>
        <button onClick={handleSave}
          style={{ padding: '4px 10px', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', background: 'transparent' }}>
          💾 Save
        </button>
        <button onClick={onClose}
          style={{ padding: '4px 8px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 16 }}>
          ✕
        </button>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <div style={{
          width: 160, borderRight: '1px solid #eee', overflow: 'auto',
          padding: 8, flexShrink: 0,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 11, textTransform: 'uppercase', color: '#888' }}>
            Saved Macros
          </div>
          {macros.map(m => (
            <div key={m.name} style={{
              padding: '4px 6px', cursor: 'pointer', borderRadius: 3,
              background: m.name === currentName ? '#e3f2fd' : 'transparent',
              display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2,
            }}>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                onClick={() => handleLoad(m)}>{m.name}</span>
              <span onClick={() => handleDelete(m.name)} style={{ cursor: 'pointer', opacity: 0.5, fontSize: 11 }}>✕</span>
            </div>
          ))}
          {macros.length === 0 && <div style={{ color: '#999', fontSize: 11 }}>No saved macros</div>}

          <div style={{ marginTop: 12 }}>
            <div
              onClick={() => setShowExamples(!showExamples)}
              style={{ fontWeight: 600, marginBottom: 6, fontSize: 11, textTransform: 'uppercase', color: '#888', cursor: 'pointer' }}>
              {showExamples ? '▾' : '▸'} Examples
            </div>
            {showExamples && Object.entries(EXAMPLE_MACROS).map(([name, exCode]) => (
              <div key={name}
                onClick={() => { setCode(exCode); setCurrentName(''); setOutput([]); }}
                style={{ padding: '4px 6px', cursor: 'pointer', borderRadius: 3, marginBottom: 2, color: '#1976d2' }}>
                {name}
              </div>
            ))}
          </div>
        </div>

        {/* Editor + Output */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <textarea
            ref={textareaRef}
            value={code}
            onChange={e => setCode(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            style={{
              flex: 1, padding: 10, border: 'none', resize: 'none',
              fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
              fontSize: 12, lineHeight: 1.5, outline: 'none',
              background: '#fafafa', color: '#333',
            }}
            placeholder="Write your macro here... (Cmd+Enter to run)"
          />
          <div style={{
            height: 140, borderTop: '1px solid #ddd', overflow: 'auto',
            padding: 8, background: '#1e1e1e', color: '#d4d4d4',
            fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', fontSize: 11,
          }}>
            <div style={{ color: '#888', marginBottom: 4 }}>Console Output</div>
            {output.length === 0 && <div style={{ color: '#555' }}>Run a macro to see output...</div>}
            {output.map((line, i) => (
              <div key={i} style={{
                color: line.startsWith('❌') ? '#f44336' : line.startsWith('[toast]') ? '#81c784' : '#d4d4d4',
              }}>{line}</div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: '6px 12px', borderTop: '1px solid #ddd', fontSize: 11, color: '#999' }}>
        ⌘+Enter to run • Use <code>md.doc</code>, <code>md.sheet</code>, <code>md.ui</code>
      </div>
    </div>
  );
}
