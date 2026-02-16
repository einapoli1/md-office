import React, { useState, useEffect, useRef } from 'react';
import katex from 'katex';
import { solveEquation, extractVariables, formatResult } from '../utils/mathSolver';

interface EquationDialogProps {
  open: boolean;
  onClose: () => void;
  onInsert: (latex: string, displayMode: boolean) => void;
  initialLatex?: string;
  /** Current document variables from VariableChip nodes */
  variables?: Record<string, number>;
  /** Callback to insert a new variable chip */
  onInsertVariable?: (name: string, value: number) => void;
}

const TEMPLATES = [
  { label: 'Fraction', latex: '\\frac{a}{b}' },
  { label: 'Square root', latex: '\\sqrt{x}' },
  { label: 'Integral', latex: '\\int_{a}^{b} f(x)\\,dx' },
  { label: 'Sum', latex: '\\sum_{i=1}^{n} x_i' },
  { label: 'Product', latex: '\\prod_{i=1}^{n} x_i' },
  { label: 'Limit', latex: '\\lim_{x \\to \\infty} f(x)' },
  { label: 'Matrix', latex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}' },
  { label: 'Greek (α,β,γ)', latex: '\\alpha, \\beta, \\gamma' },
  { label: 'Subscript/Super', latex: 'x_{i}^{2}' },
  { label: 'Binomial', latex: '\\binom{n}{k}' },
];

const EquationDialog: React.FC<EquationDialogProps> = ({
  open, onClose, onInsert, initialLatex = '',
  variables = {}, onInsertVariable,
}) => {
  const [latex, setLatex] = useState(initialLatex);
  const [displayMode, setDisplayMode] = useState(true);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [newVarName, setNewVarName] = useState('');
  const [newVarValue, setNewVarValue] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setLatex(initialLatex);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, initialLatex]);

  useEffect(() => {
    if (!latex.trim()) { setPreview(''); setError(''); return; }
    try {
      const html = katex.renderToString(latex, { throwOnError: true, displayMode });
      setPreview(html);
      setError('');
    } catch (e: any) {
      setError(e.message);
      setPreview('');
    }
  }, [latex, displayMode]);

  if (!open) return null;

  const handleInsert = () => {
    if (latex.trim() && !error) {
      onInsert(latex.trim(), displayMode);
      onClose();
    }
  };

  // Evaluate the equation with current variables
  const evalResult = latex.trim() ? solveEquation(latex, variables) : null;
  const neededVars = latex.trim() ? extractVariables(latex) : [];

  const handleAddVariable = () => {
    const name = newVarName.trim();
    const val = parseFloat(newVarValue);
    if (name && !isNaN(val) && onInsertVariable) {
      onInsertVariable(name, val);
      setNewVarName('');
      setNewVarValue('');
    }
  };

  return (
    <div className="equation-dialog-overlay" onClick={onClose}>
      <div className="equation-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="equation-dialog-header">
          <h3>Insert Equation</h3>
          <button className="equation-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="equation-dialog-body">
          <div className="equation-input-section">
            <label>LaTeX</label>
            <textarea
              ref={inputRef}
              className="equation-latex-input"
              value={latex}
              onChange={(e) => setLatex(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleInsert(); }}
              placeholder="e.g. E = mc^2"
              rows={4}
              spellCheck={false}
            />
            <div className="equation-mode-toggle">
              <label>
                <input type="radio" checked={!displayMode} onChange={() => setDisplayMode(false)} /> Inline
              </label>
              <label>
                <input type="radio" checked={displayMode} onChange={() => setDisplayMode(true)} /> Block
              </label>
            </div>
          </div>

          <div className="equation-preview-section">
            <label>Preview</label>
            <div className="equation-preview-box">
              {preview ? (
                <div>
                  <div dangerouslySetInnerHTML={{ __html: preview }} />
                  {evalResult && evalResult.result !== null && (
                    <div className="equation-eval-result">
                      <span className="equation-result-indicator solved">✓</span>
                      {' = '}{formatResult(evalResult.result)}
                    </div>
                  )}
                  {evalResult && evalResult.missing.length > 0 && (
                    <div className="equation-eval-missing">
                      Missing: {evalResult.missing.join(', ')}
                    </div>
                  )}
                </div>
              ) : error ? (
                <div className="equation-error">{error}</div>
              ) : (
                <div className="equation-placeholder">Type LaTeX to see preview</div>
              )}
            </div>
          </div>
        </div>

        {/* Variables section */}
        <div className="equation-variables-section">
          <label>Variables</label>
          {Object.keys(variables).length > 0 ? (
            <div className="equation-variables-list">
              {Object.entries(variables).map(([k, v]) => (
                <span key={k} className={`equation-var-pill ${neededVars.includes(k) ? 'used' : ''}`}>
                  {k} = {v}
                </span>
              ))}
            </div>
          ) : (
            <div className="equation-variables-empty">No variables defined in document</div>
          )}
          {onInsertVariable && (
            <div className="equation-add-variable">
              <input
                placeholder="name"
                value={newVarName}
                onChange={(e) => setNewVarName(e.target.value)}
                className="equation-var-name-input"
              />
              <span>=</span>
              <input
                placeholder="value"
                type="number"
                step="any"
                value={newVarValue}
                onChange={(e) => setNewVarValue(e.target.value)}
                className="equation-var-value-input"
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddVariable(); }}
              />
              <button className="equation-add-var-btn" onClick={handleAddVariable}>+ Add</button>
            </div>
          )}
        </div>

        <div className="equation-templates">
          <label>Templates</label>
          <div className="equation-template-grid">
            {TEMPLATES.map((t) => (
              <button
                key={t.label}
                className="equation-template-btn"
                title={t.label}
                onClick={() => setLatex(t.latex)}
              >
                <span dangerouslySetInnerHTML={{
                  __html: (() => { try { return katex.renderToString(t.latex, { throwOnError: false }); } catch { return t.label; } })()
                }} />
              </button>
            ))}
          </div>
        </div>

        <div className="equation-dialog-footer">
          <button className="equation-cancel-btn" onClick={onClose}>Cancel</button>
          <button className="equation-insert-btn" onClick={handleInsert} disabled={!latex.trim() || !!error}>
            Insert
          </button>
        </div>
      </div>
    </div>
  );
};

export default EquationDialog;
