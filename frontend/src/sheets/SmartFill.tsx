// SmartFill — Flash Fill (Excel 2013+ style pattern detection and auto-fill)

import { useState, useEffect, useMemo, useCallback } from 'react';
import { cellId } from './formulaEngine';
import type { SheetData } from './sheetModel';

// Pattern types that SmartFill can detect
type PatternType = 'extractSubstring' | 'combineStrings' | 'formatNumber' | 'extractDomain' | 'changeCase' | 'custom';

interface DetectedPattern {
  type: PatternType;
  description: string;
  apply: (sourceValues: string[]) => string;
}

// Try to detect a pattern from source column values and example outputs
function detectSmartPattern(
  sourceRows: string[][],  // source column values for each example row (can be multi-col)
  examples: string[],      // the user-typed examples
): DetectedPattern | null {
  if (examples.length < 1 || sourceRows.length < 1) return null;

  // Try extract first word
  const firstWords = sourceRows.map(r => r[0]?.split(/\s+/)[0] || '');
  if (firstWords.length >= examples.length && examples.every((ex, i) => ex === firstWords[i])) {
    return {
      type: 'extractSubstring',
      description: 'Extract first word',
      apply: (vals) => vals[0]?.split(/\s+/)[0] || '',
    };
  }

  // Try extract last word
  const lastWords = sourceRows.map(r => {
    const parts = r[0]?.split(/\s+/) || [];
    return parts[parts.length - 1] || '';
  });
  if (lastWords.length >= examples.length && examples.every((ex, i) => ex === lastWords[i])) {
    return {
      type: 'extractSubstring',
      description: 'Extract last word',
      apply: (vals) => {
        const parts = vals[0]?.split(/\s+/) || [];
        return parts[parts.length - 1] || '';
      },
    };
  }

  // Try extract email domain
  const domains = sourceRows.map(r => {
    const m = r[0]?.match(/@(.+)$/);
    return m ? m[1] : '';
  });
  if (domains.some(d => d) && examples.every((ex, i) => ex === domains[i])) {
    return {
      type: 'extractDomain',
      description: 'Extract email domain',
      apply: (vals) => {
        const m = vals[0]?.match(/@(.+)$/);
        return m ? m[1] : '';
      },
    };
  }

  // Try extract email username
  const usernames = sourceRows.map(r => {
    const m = r[0]?.match(/^([^@]+)@/);
    return m ? m[1] : '';
  });
  if (usernames.some(u => u) && examples.every((ex, i) => ex === usernames[i])) {
    return {
      type: 'extractSubstring',
      description: 'Extract email username',
      apply: (vals) => {
        const m = vals[0]?.match(/^([^@]+)@/);
        return m ? m[1] : '';
      },
    };
  }

  // Try uppercase/lowercase/proper case
  const uppers = sourceRows.map(r => r[0]?.toUpperCase() || '');
  if (examples.every((ex, i) => ex === uppers[i])) {
    return { type: 'changeCase', description: 'UPPERCASE', apply: (vals) => vals[0]?.toUpperCase() || '' };
  }
  const lowers = sourceRows.map(r => r[0]?.toLowerCase() || '');
  if (examples.every((ex, i) => ex === lowers[i])) {
    return { type: 'changeCase', description: 'lowercase', apply: (vals) => vals[0]?.toLowerCase() || '' };
  }
  const propers = sourceRows.map(r => toProperCase(r[0] || ''));
  if (examples.every((ex, i) => ex === propers[i])) {
    return { type: 'changeCase', description: 'Title Case', apply: (vals) => toProperCase(vals[0] || '') };
  }

  // Try combining two columns (e.g., first + " " + last)
  if (sourceRows[0] && sourceRows[0].length >= 2) {
    // Try "col0 col1"
    const combined = sourceRows.map(r => `${r[0]} ${r[1]}`);
    if (examples.every((ex, i) => ex === combined[i])) {
      return { type: 'combineStrings', description: 'Combine with space', apply: (vals) => `${vals[0]} ${vals[1]}` };
    }
    // Try "col1, col0"
    const reversed = sourceRows.map(r => `${r[1]}, ${r[0]}`);
    if (examples.every((ex, i) => ex === reversed[i])) {
      return { type: 'combineStrings', description: 'Reverse with comma', apply: (vals) => `${vals[1]}, ${vals[0]}` };
    }
  }

  // Try fixed-position substring extraction
  if (examples.length >= 2) {
    const src0 = sourceRows[0]?.[0] || '';
    const ex0 = examples[0];
    const startIdx = src0.indexOf(ex0);
    if (startIdx >= 0) {
      const endIdx = startIdx + ex0.length;
      const allMatch = examples.every((ex, i) => {
        const s = sourceRows[i]?.[0] || '';
        return s.substring(startIdx, endIdx) === ex;
      });
      if (allMatch) {
        return {
          type: 'extractSubstring',
          description: `Extract chars ${startIdx + 1}-${endIdx}`,
          apply: (vals) => vals[0]?.substring(startIdx, endIdx) || '',
        };
      }
    }
  }

  return null;
}

function toProperCase(s: string): string {
  return s.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

interface SmartFillSuggestion {
  row: number;
  col: number;
  value: string;
}

export function useSmartFill(sheet: SheetData, activeCol: number, activeRow: number): {
  suggestions: SmartFillSuggestion[];
  pattern: DetectedPattern | null;
  apply: () => void;
  dismiss: () => void;
} {
  const [dismissed, setDismissed] = useState(false);
  const [lastCol, setLastCol] = useState(activeCol);

  // Reset dismissed state when column changes
  useEffect(() => {
    if (activeCol !== lastCol) {
      setDismissed(false);
      setLastCol(activeCol);
    }
  }, [activeCol, lastCol]);

  const result = useMemo(() => {
    if (dismissed) return { suggestions: [], pattern: null };

    // Gather examples in current column (cells that have values typed by user)
    const examples: { row: number; value: string }[] = [];
    for (let r = 0; r < 100; r++) {
      const id = cellId(activeCol, r);
      const cell = sheet.cells[id];
      if (cell && cell.value && !cell.formula) {
        examples.push({ row: r, value: cell.value });
      }
    }

    if (examples.length < 2) return { suggestions: [], pattern: null };

    // Look at adjacent columns as source data
    // Try columns to the left first
    const sourceCols: number[] = [];
    for (let c = 0; c < activeCol; c++) {
      // Check if column has data
      let hasData = false;
      for (const ex of examples) {
        const id = cellId(c, ex.row);
        if (sheet.cells[id]?.value) { hasData = true; break; }
      }
      if (hasData) sourceCols.push(c);
    }

    if (sourceCols.length === 0) return { suggestions: [], pattern: null };

    // Build source rows for examples
    const sourceRows = examples.map(ex =>
      sourceCols.map(c => {
        const id = cellId(c, ex.row);
        const cell = sheet.cells[id];
        return cell ? (cell.computed ?? cell.value) : '';
      })
    );
    const exampleValues = examples.map(ex => ex.value);

    const pattern = detectSmartPattern(sourceRows, exampleValues);
    if (!pattern) return { suggestions: [], pattern: null };

    // Generate suggestions for empty rows in this column that have source data
    const suggestions: SmartFillSuggestion[] = [];
    const exampleRowSet = new Set(examples.map(e => e.row));

    for (let r = 0; r < 100; r++) {
      if (exampleRowSet.has(r)) continue;
      const id = cellId(activeCol, r);
      if (sheet.cells[id]?.value) continue; // skip if already has value

      const sourceVals = sourceCols.map(c => {
        const srcId = cellId(c, r);
        const cell = sheet.cells[srcId];
        return cell ? (cell.computed ?? cell.value) : '';
      });

      if (sourceVals.every(v => !v)) continue; // no source data

      const predicted = pattern.apply(sourceVals);
      if (predicted) {
        suggestions.push({ row: r, col: activeCol, value: predicted });
      }
    }

    return { suggestions, pattern };
  }, [sheet.cells, activeCol, activeRow, dismissed]);

  const apply = useCallback(() => {
    // Apply is handled by parent — this just signals
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  return { ...result, apply, dismiss };
}

// Ghost preview component that renders smart fill suggestions
interface SmartFillPreviewProps {
  suggestions: SmartFillSuggestion[];
  colLefts: number[];
  colWidths: (col: number) => number;
  visibleRows: { startRow: number; endRow: number };
  onAccept: () => void;
  onDismiss: () => void;
}

export default function SmartFillPreview({ suggestions, colLefts, colWidths, visibleRows, onAccept, onDismiss }: SmartFillPreviewProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        onAccept();
      } else if (e.key === 'Escape') {
        onDismiss();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onAccept, onDismiss]);

  if (suggestions.length === 0) return null;

  const visible = suggestions.filter(s => s.row >= visibleRows.startRow && s.row < visibleRows.endRow);

  return (
    <>
      {visible.map(s => (
        <div
          key={`sf-${s.row}-${s.col}`}
          className="smart-fill-ghost"
          style={{
            position: 'absolute',
            top: s.row * 28,
            left: colLefts[s.col] ?? 0,
            width: colWidths(s.col),
            height: 28,
            display: 'flex',
            alignItems: 'center',
            padding: '0 4px',
            color: '#999',
            fontSize: 13,
            pointerEvents: 'none',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            fontStyle: 'italic',
          }}
        >
          {s.value}
        </div>
      ))}
      {visible.length > 0 && (
        <div
          className="smart-fill-hint"
          style={{
            position: 'absolute',
            top: (suggestions[0].row) * 28 - 24,
            left: (colLefts[suggestions[0].col] ?? 0) + colWidths(suggestions[0].col) + 4,
            background: '#1a73e8',
            color: '#fff',
            padding: '2px 8px',
            borderRadius: 3,
            fontSize: 11,
            zIndex: 50,
            whiteSpace: 'nowrap',
            pointerEvents: 'auto',
            cursor: 'pointer',
          }}
          onClick={onAccept}
          title="Press Ctrl+Enter to accept"
        >
          ⚡ Smart Fill ({suggestions.length} cells) — Ctrl+Enter
        </div>
      )}
    </>
  );
}

// Standalone export for pattern detection (used by Data menu)
export { detectSmartPattern, type DetectedPattern, type SmartFillSuggestion };
