// FormulaAuditing — Trace precedents/dependents, evaluate stepper, error checking

import { useState, useMemo, useCallback } from 'react';
import { extractRefs, expandRange, parseCellRef, cellId, evaluateFormula, isFormulaError } from './formulaEngine';
import type { CellGetter } from './formulaEngine';
import type { SheetData } from './sheetModel';
import { DependencyGraph } from './formulaEngine';

interface ArrowDef {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  color: string;
}

interface FormulaAuditingProps {
  sheet: SheetData;
  selectedCell: string;
  colWidths: (col: number) => number;
  rowHeights: (row: number) => number;
  scrollLeft: number;
  scrollTop: number;
  frozenCols: number;
  frozenRows: number;
  getCellValue: CellGetter;
  graph: DependencyGraph;
  namedRanges?: Record<string, string>;
}

// Get center pixel position of a cell
function getCellCenter(
  ref: string,
  colWidths: (col: number) => number,
  rowHeights: (row: number) => number,
  scrollLeft: number,
  scrollTop: number,
  frozenCols: number,
  frozenRows: number,
): { x: number; y: number } | null {
  const parsed = parseCellRef(ref);
  if (!parsed) return null;
  let x = 0;
  for (let c = 0; c < parsed.col; c++) x += colWidths(c);
  x += colWidths(parsed.col) / 2;
  let y = 0;
  for (let r = 0; r < parsed.row; r++) y += rowHeights(r);
  y += rowHeights(parsed.row) / 2;
  if (parsed.col >= frozenCols) x -= scrollLeft;
  if (parsed.row >= frozenRows) y -= scrollTop;
  return { x, y };
}

// SVG arrow overlay for tracing
function AuditArrows({ arrows }: { arrows: ArrowDef[] }) {
  if (arrows.length === 0) return null;
  return (
    <svg
      className="formula-audit-arrows"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 20,
      }}
    >
      <defs>
        <marker id="audit-arrow-blue" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6 Z" fill="#1a73e8" />
        </marker>
        <marker id="audit-arrow-red" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6 Z" fill="#e53935" />
        </marker>
      </defs>
      {arrows.map((arrow, i) => (
        <line
          key={i}
          x1={arrow.fromX}
          y1={arrow.fromY}
          x2={arrow.toX}
          y2={arrow.toY}
          stroke={arrow.color}
          strokeWidth={2}
          markerEnd={`url(#audit-arrow-${arrow.color === '#1a73e8' ? 'blue' : 'red'})`}
        />
      ))}
    </svg>
  );
}

export interface FormulaError {
  cell: string;
  error: string;
  formula: string;
  description: string;
}

// Error descriptions
function describeError(error: string): string {
  if (error.includes('#REF!')) return 'Invalid cell reference';
  if (error.includes('#NAME?')) return 'Unrecognized formula name or function';
  if (error.includes('#VALUE!')) return 'Wrong type of argument or operand';
  if (error.includes('#DIV/0!')) return 'Division by zero';
  if (error.includes('#N/A')) return 'Value not available / lookup failed';
  if (error.includes('#NULL!')) return 'Incorrect range intersection';
  if (error.includes('#SPILL!')) return 'Array formula spill blocked by existing data';
  if (error.includes('#CIRCULAR!')) return 'Circular reference detected';
  if (error.includes('#ERROR!')) return 'General formula error';
  return 'Unknown error';
}

// Evaluate formula step by step (simplified)
export function evaluateFormulaSteps(formula: string, get: CellGetter): string[] {
  if (!formula.startsWith('=')) return [formula];
  const steps: string[] = [formula];
  let expr = formula;

  // Step 1: Replace cell refs with their values
  const refPattern = /[A-Z]+\d+/g;
  let replaced = expr;
  const refs = expr.match(refPattern);
  if (refs) {
    for (const ref of refs) {
      const val = get(ref);
      replaced = replaced.replace(ref, val || '0');
    }
    if (replaced !== expr) steps.push(replaced);
  }

  // Step 2: Show the final result
  const result = evaluateFormula(formula, get);
  steps.push(`= ${result}`);

  return steps;
}

// Scan sheet for errors
export function findSheetErrors(sheet: SheetData, get: CellGetter, namedRanges?: Record<string, string>): FormulaError[] {
  const errors: FormulaError[] = [];
  for (const [id, cell] of Object.entries(sheet.cells)) {
    if (cell.formula) {
      const computed = cell.computed ?? evaluateFormula(cell.formula, get, namedRanges);
      if (isFormulaError(computed)) {
        errors.push({
          cell: id,
          error: computed,
          formula: cell.formula,
          description: describeError(computed),
        });
      }
    }
  }
  return errors;
}

export type AuditMode = 'none' | 'precedents' | 'dependents';

export default function FormulaAuditing({
  sheet,
  selectedCell,
  colWidths,
  rowHeights,
  scrollLeft,
  scrollTop,
  frozenCols,
  frozenRows,
  getCellValue,
  graph,
}: FormulaAuditingProps) {
  const [mode, setMode] = useState<AuditMode>('none');
  const [showErrors, setShowErrors] = useState(false);
  const [showEvaluate, setShowEvaluate] = useState(false);

  const arrows = useMemo(() => {
    if (mode === 'none') return [];
    const result: ArrowDef[] = [];
    const fromPos = getCellCenter(selectedCell, colWidths, rowHeights, scrollLeft, scrollTop, frozenCols, frozenRows);
    if (!fromPos) return [];

    if (mode === 'precedents') {
      // Trace cells this formula references
      const cell = sheet.cells[selectedCell];
      if (!cell?.formula) return [];
      const refs = extractRefs(cell.formula);
      const uniqueRefs = [...new Set(refs)];
      for (const ref of uniqueRefs) {
        const toPos = getCellCenter(ref, colWidths, rowHeights, scrollLeft, scrollTop, frozenCols, frozenRows);
        if (toPos) {
          result.push({ fromX: toPos.x, fromY: toPos.y, toX: fromPos.x, toY: fromPos.y, color: '#1a73e8' });
        }
      }
    } else if (mode === 'dependents') {
      // Trace cells that reference this cell
      const deps = graph.getDependents(selectedCell);
      for (const dep of deps) {
        if (dep === '#CIRCULAR!') continue;
        const toPos = getCellCenter(dep, colWidths, rowHeights, scrollLeft, scrollTop, frozenCols, frozenRows);
        if (toPos) {
          result.push({ fromX: fromPos.x, fromY: fromPos.y, toX: toPos.x, toY: toPos.y, color: '#e53935' });
        }
      }
    }
    return result;
  }, [mode, selectedCell, sheet, graph, colWidths, rowHeights, scrollLeft, scrollTop, frozenCols, frozenRows]);

  const errors = useMemo(() => {
    if (!showErrors) return [];
    return findSheetErrors(sheet, getCellValue);
  }, [showErrors, sheet, getCellValue]);

  const evalSteps = useMemo(() => {
    if (!showEvaluate) return [];
    const cell = sheet.cells[selectedCell];
    if (!cell?.formula) return ['(no formula in selected cell)'];
    return evaluateFormulaSteps(cell.formula, getCellValue);
  }, [showEvaluate, selectedCell, sheet, getCellValue]);

  const handleTracePrecedents = useCallback(() => {
    setMode(m => m === 'precedents' ? 'none' : 'precedents');
    setShowErrors(false);
    setShowEvaluate(false);
  }, []);

  const handleTraceDependents = useCallback(() => {
    setMode(m => m === 'dependents' ? 'none' : 'dependents');
    setShowErrors(false);
    setShowEvaluate(false);
  }, []);

  const handleErrorCheck = useCallback(() => {
    setShowErrors(s => !s);
    setMode('none');
    setShowEvaluate(false);
  }, []);

  const handleEvaluate = useCallback(() => {
    setShowEvaluate(s => !s);
    setMode('none');
    setShowErrors(false);
  }, []);

  // Resolve unused var lint by referencing expandRange in module scope
  void expandRange;
  void cellId;

  return (
    <>
      {/* Toolbar section */}
      <div className="formula-auditing-toolbar" style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '2px 8px', borderBottom: '1px solid #e0e0e0', fontSize: 12 }}>
        <span style={{ fontWeight: 600, marginRight: 4, color: '#555' }}>Formulas:</span>
        <button
          className={`audit-btn ${mode === 'precedents' ? 'active' : ''}`}
          onClick={handleTracePrecedents}
          title="Trace Precedents — show cells referenced by the selected formula"
          style={{ padding: '2px 8px', fontSize: 11, background: mode === 'precedents' ? '#e3f2fd' : '#f5f5f5', border: '1px solid #ccc', borderRadius: 3, cursor: 'pointer' }}
        >
          ← Precedents
        </button>
        <button
          className={`audit-btn ${mode === 'dependents' ? 'active' : ''}`}
          onClick={handleTraceDependents}
          title="Trace Dependents — show cells that reference the selected cell"
          style={{ padding: '2px 8px', fontSize: 11, background: mode === 'dependents' ? '#fce4ec' : '#f5f5f5', border: '1px solid #ccc', borderRadius: 3, cursor: 'pointer' }}
        >
          Dependents →
        </button>
        <button
          className={`audit-btn ${showEvaluate ? 'active' : ''}`}
          onClick={handleEvaluate}
          title="Evaluate Formula — step through formula evaluation"
          style={{ padding: '2px 8px', fontSize: 11, background: showEvaluate ? '#fff3e0' : '#f5f5f5', border: '1px solid #ccc', borderRadius: 3, cursor: 'pointer' }}
        >
          Evaluate
        </button>
        <button
          className={`audit-btn ${showErrors ? 'active' : ''}`}
          onClick={handleErrorCheck}
          title="Error Checking — scan sheet for formula errors"
          style={{ padding: '2px 8px', fontSize: 11, background: showErrors ? '#ffebee' : '#f5f5f5', border: '1px solid #ccc', borderRadius: 3, cursor: 'pointer' }}
        >
          ⚠ Errors
        </button>
      </div>

      {/* Arrow overlay */}
      <AuditArrows arrows={arrows} />

      {/* Evaluate Formula panel */}
      {showEvaluate && evalSteps.length > 0 && (
        <div
          className="formula-evaluate-panel"
          style={{
            position: 'absolute',
            bottom: 40,
            right: 16,
            background: '#fff',
            border: '1px solid #ccc',
            borderRadius: 6,
            padding: 12,
            zIndex: 50,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            maxWidth: 400,
            fontSize: 12,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Evaluate Formula — {selectedCell}</div>
          {evalSteps.map((step, i) => (
            <div key={i} style={{ fontFamily: 'monospace', padding: '2px 0', color: i === evalSteps.length - 1 ? '#1a73e8' : '#333' }}>
              {i > 0 && <span style={{ color: '#999', marginRight: 4 }}>→</span>}
              {step}
            </div>
          ))}
        </div>
      )}

      {/* Error checking panel */}
      {showErrors && (
        <div
          className="formula-errors-panel"
          style={{
            position: 'absolute',
            bottom: 40,
            right: 16,
            background: '#fff',
            border: '1px solid #ccc',
            borderRadius: 6,
            padding: 12,
            zIndex: 50,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            maxWidth: 450,
            maxHeight: 300,
            overflowY: 'auto',
            fontSize: 12,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Error Checking</div>
          {errors.length === 0 ? (
            <div style={{ color: '#4caf50' }}>✓ No errors found</div>
          ) : (
            errors.map((err, i) => (
              <div key={i} style={{ padding: '4px 0', borderBottom: '1px solid #f0f0f0' }}>
                <span style={{ fontWeight: 600, color: '#e53935' }}>{err.cell}</span>
                <span style={{ marginLeft: 8, color: '#d32f2f', fontFamily: 'monospace' }}>{err.error}</span>
                <div style={{ color: '#666', fontSize: 11 }}>{err.description}</div>
                <div style={{ color: '#999', fontSize: 10, fontFamily: 'monospace' }}>{err.formula}</div>
              </div>
            ))
          )}
        </div>
      )}
    </>
  );
}
