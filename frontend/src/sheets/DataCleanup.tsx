// DataCleanup — Data cleanup dialog with multiple operations

import { useState, useMemo, useCallback } from 'react';
import { cellId, indexToCol } from './formulaEngine';
import type { SheetData, CellData } from './sheetModel';

type CleanupOperation =
  | 'removeDuplicates'
  | 'trimWhitespace'
  | 'findReplace'
  | 'splitText'
  | 'changeCase'
  | 'removeEmpty'
  | 'standardizeDates';

interface DataCleanupDialogProps {
  sheet: SheetData;
  selectedRange: string;
  onApply: (newCells: Record<string, CellData | null>, deletedRows?: number[], deletedCols?: number[], insertedCols?: { afterCol: number; count: number }) => void;
  onClose: () => void;
}

function getRangeInfo(range: string): { minCol: number; maxCol: number; minRow: number; maxRow: number } | null {
  const m = range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
  if (!m) return null;
  const toIdx = (c: string) => {
    let idx = 0;
    for (let i = 0; i < c.length; i++) idx = idx * 26 + (c.toUpperCase().charCodeAt(i) - 64);
    return idx - 1;
  };
  return { minCol: toIdx(m[1]), maxCol: toIdx(m[3]), minRow: parseInt(m[2]) - 1, maxRow: parseInt(m[4]) - 1 };
}

export default function DataCleanupDialog({ sheet, selectedRange, onApply, onClose }: DataCleanupDialogProps) {
  const [operation, setOperation] = useState<CleanupOperation>('trimWhitespace');

  // Remove duplicates state
  const [dupColumns, setDupColumns] = useState<Set<number>>(new Set());

  // Find/replace state
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [useRegex, setUseRegex] = useState(false);

  // Split text state
  const [delimiter, setDelimiter] = useState<'comma' | 'semicolon' | 'space' | 'tab' | 'custom'>('comma');
  const [customDelimiter, setCustomDelimiter] = useState('');

  // Change case state
  const [caseType, setCaseType] = useState<'upper' | 'lower' | 'title' | 'sentence'>('upper');

  // Date format state
  const [dateFormat, setDateFormat] = useState<'YYYY-MM-DD' | 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'MMMM D, YYYY'>('YYYY-MM-DD');

  const rangeInfo = useMemo(() => getRangeInfo(selectedRange), [selectedRange]);

  // Initialize dup columns
  useMemo(() => {
    if (rangeInfo) {
      const cols = new Set<number>();
      for (let c = rangeInfo.minCol; c <= rangeInfo.maxCol; c++) cols.add(c);
      setDupColumns(cols);
    }
  }, [rangeInfo]);

  // Compute preview
  const preview = useMemo(() => {
    if (!rangeInfo) return { affected: 0, description: 'Invalid range' };

    const { minCol, maxCol, minRow, maxRow } = rangeInfo;

    switch (operation) {
      case 'trimWhitespace': {
        let count = 0;
        for (let r = minRow; r <= maxRow; r++) {
          for (let c = minCol; c <= maxCol; c++) {
            const id = cellId(c, r);
            const cell = sheet.cells[id];
            if (cell && cell.value) {
              const trimmed = cell.value.replace(/^\s+|\s+$/g, '').replace(/\s{2,}/g, ' ');
              if (trimmed !== cell.value) count++;
            }
          }
        }
        return { affected: count, description: `${count} cell${count !== 1 ? 's' : ''} will be trimmed` };
      }

      case 'removeDuplicates': {
        const seen = new Set<string>();
        let dupCount = 0;
        for (let r = minRow; r <= maxRow; r++) {
          const key = Array.from(dupColumns).sort().map(c => {
            const id = cellId(c, r);
            return sheet.cells[id]?.value || '';
          }).join('\x00');
          if (seen.has(key)) dupCount++;
          else seen.add(key);
        }
        return { affected: dupCount, description: `${dupCount} duplicate row${dupCount !== 1 ? 's' : ''} found` };
      }

      case 'findReplace': {
        if (!findText) return { affected: 0, description: 'Enter search text' };
        let count = 0;
        try {
          const regex = useRegex ? new RegExp(findText, 'g') : null;
          for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
              const id = cellId(c, r);
              const cell = sheet.cells[id];
              if (cell && cell.value) {
                if (regex) {
                  regex.lastIndex = 0;
                  if (regex.test(cell.value)) count++;
                } else {
                  if (cell.value.includes(findText)) count++;
                }
              }
            }
          }
        } catch {
          return { affected: 0, description: 'Invalid regex' };
        }
        return { affected: count, description: `${count} cell${count !== 1 ? 's' : ''} match` };
      }

      case 'splitText': {
        let count = 0;
        for (let r = minRow; r <= maxRow; r++) {
          const id = cellId(minCol, r);
          const cell = sheet.cells[id];
          if (cell && cell.value) {
            const d = getDelimiterChar();
            if (cell.value.includes(d)) count++;
          }
        }
        return { affected: count, description: `${count} cell${count !== 1 ? 's' : ''} will be split` };
      }

      case 'changeCase': {
        let count = 0;
        for (let r = minRow; r <= maxRow; r++) {
          for (let c = minCol; c <= maxCol; c++) {
            const id = cellId(c, r);
            const cell = sheet.cells[id];
            if (cell && cell.value && /[a-zA-Z]/.test(cell.value)) count++;
          }
        }
        return { affected: count, description: `${count} cell${count !== 1 ? 's' : ''} will be affected` };
      }

      case 'removeEmpty': {
        let emptyRows = 0;
        let emptyCols = 0;
        for (let r = minRow; r <= maxRow; r++) {
          let empty = true;
          for (let c = minCol; c <= maxCol; c++) {
            if (sheet.cells[cellId(c, r)]?.value) { empty = false; break; }
          }
          if (empty) emptyRows++;
        }
        for (let c = minCol; c <= maxCol; c++) {
          let empty = true;
          for (let r = minRow; r <= maxRow; r++) {
            if (sheet.cells[cellId(c, r)]?.value) { empty = false; break; }
          }
          if (empty) emptyCols++;
        }
        return { affected: emptyRows + emptyCols, description: `${emptyRows} empty row${emptyRows !== 1 ? 's' : ''}, ${emptyCols} empty column${emptyCols !== 1 ? 's' : ''}` };
      }

      case 'standardizeDates': {
        let count = 0;
        for (let r = minRow; r <= maxRow; r++) {
          for (let c = minCol; c <= maxCol; c++) {
            const id = cellId(c, r);
            const cell = sheet.cells[id];
            if (cell && cell.value && parseDate(cell.value)) count++;
          }
        }
        return { affected: count, description: `${count} date${count !== 1 ? 's' : ''} will be reformatted` };
      }
    }
  }, [operation, rangeInfo, sheet.cells, dupColumns, findText, useRegex, delimiter, customDelimiter, caseType, dateFormat]);

  const getDelimiterChar = useCallback((): string => {
    switch (delimiter) {
      case 'comma': return ',';
      case 'semicolon': return ';';
      case 'space': return ' ';
      case 'tab': return '\t';
      case 'custom': return customDelimiter || ',';
    }
  }, [delimiter, customDelimiter]);

  const handleApply = useCallback(() => {
    if (!rangeInfo) return;
    const { minCol, maxCol, minRow, maxRow } = rangeInfo;
    const changes: Record<string, CellData | null> = {};

    switch (operation) {
      case 'trimWhitespace': {
        for (let r = minRow; r <= maxRow; r++) {
          for (let c = minCol; c <= maxCol; c++) {
            const id = cellId(c, r);
            const cell = sheet.cells[id];
            if (cell && cell.value) {
              const trimmed = cell.value.replace(/^\s+|\s+$/g, '').replace(/\s{2,}/g, ' ');
              if (trimmed !== cell.value) {
                changes[id] = { ...cell, value: trimmed };
              }
            }
          }
        }
        break;
      }

      case 'removeDuplicates': {
        const seen = new Set<string>();
        const rowsToDelete: number[] = [];
        for (let r = minRow; r <= maxRow; r++) {
          const key = Array.from(dupColumns).sort().map(c => {
            const id = cellId(c, r);
            return sheet.cells[id]?.value || '';
          }).join('\x00');
          if (seen.has(key)) {
            rowsToDelete.push(r);
            for (let c = minCol; c <= maxCol; c++) {
              changes[cellId(c, r)] = null;
            }
          } else {
            seen.add(key);
          }
        }
        // Shift remaining rows up
        const kept: number[] = [];
        for (let r = minRow; r <= maxRow; r++) {
          if (!rowsToDelete.includes(r)) kept.push(r);
        }
        for (let i = 0; i < kept.length; i++) {
          const destRow = minRow + i;
          const srcRow = kept[i];
          if (destRow !== srcRow) {
            for (let c = minCol; c <= maxCol; c++) {
              const srcId = cellId(c, srcRow);
              const destId = cellId(c, destRow);
              changes[destId] = sheet.cells[srcId] ? { ...sheet.cells[srcId] } : null;
            }
          }
        }
        // Clear remaining rows
        for (let r = minRow + kept.length; r <= maxRow; r++) {
          for (let c = minCol; c <= maxCol; c++) {
            changes[cellId(c, r)] = null;
          }
        }
        break;
      }

      case 'findReplace': {
        if (!findText) break;
        try {
          const regex = useRegex ? new RegExp(findText, 'g') : null;
          for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
              const id = cellId(c, r);
              const cell = sheet.cells[id];
              if (cell && cell.value && !cell.formula) {
                let newVal: string;
                if (regex) {
                  newVal = cell.value.replace(regex, replaceText);
                } else {
                  newVal = cell.value.split(findText).join(replaceText);
                }
                if (newVal !== cell.value) {
                  changes[id] = { ...cell, value: newVal };
                }
              }
            }
          }
        } catch { /* invalid regex */ }
        break;
      }

      case 'splitText': {
        const d = getDelimiterChar();
        let maxParts = 1;
        // First pass: find max parts
        for (let r = minRow; r <= maxRow; r++) {
          const id = cellId(minCol, r);
          const cell = sheet.cells[id];
          if (cell?.value) {
            maxParts = Math.max(maxParts, cell.value.split(d).length);
          }
        }
        // Second pass: split and write
        for (let r = minRow; r <= maxRow; r++) {
          const id = cellId(minCol, r);
          const cell = sheet.cells[id];
          if (cell?.value) {
            const parts = cell.value.split(d).map(s => s.trim());
            changes[id] = { ...cell, value: parts[0] };
            for (let p = 1; p < parts.length; p++) {
              const newId = cellId(minCol + p, r);
              changes[newId] = { value: parts[p] };
            }
          }
        }
        break;
      }

      case 'changeCase': {
        for (let r = minRow; r <= maxRow; r++) {
          for (let c = minCol; c <= maxCol; c++) {
            const id = cellId(c, r);
            const cell = sheet.cells[id];
            if (cell && cell.value && !cell.formula) {
              let newVal: string;
              switch (caseType) {
                case 'upper': newVal = cell.value.toUpperCase(); break;
                case 'lower': newVal = cell.value.toLowerCase(); break;
                case 'title': newVal = cell.value.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()); break;
                case 'sentence': newVal = cell.value.charAt(0).toUpperCase() + cell.value.slice(1).toLowerCase(); break;
              }
              if (newVal !== cell.value) {
                changes[id] = { ...cell, value: newVal };
              }
            }
          }
        }
        break;
      }

      case 'removeEmpty': {
        // Remove empty rows by shifting up
        const nonEmptyRows: number[] = [];
        for (let r = minRow; r <= maxRow; r++) {
          let empty = true;
          for (let c = minCol; c <= maxCol; c++) {
            if (sheet.cells[cellId(c, r)]?.value) { empty = false; break; }
          }
          if (!empty) nonEmptyRows.push(r);
        }
        for (let i = 0; i < nonEmptyRows.length; i++) {
          const destRow = minRow + i;
          const srcRow = nonEmptyRows[i];
          if (destRow !== srcRow) {
            for (let c = minCol; c <= maxCol; c++) {
              const srcId = cellId(c, srcRow);
              const destId = cellId(c, destRow);
              changes[destId] = sheet.cells[srcId] ? { ...sheet.cells[srcId] } : null;
            }
          }
        }
        for (let r = minRow + nonEmptyRows.length; r <= maxRow; r++) {
          for (let c = minCol; c <= maxCol; c++) {
            changes[cellId(c, r)] = null;
          }
        }
        break;
      }

      case 'standardizeDates': {
        for (let r = minRow; r <= maxRow; r++) {
          for (let c = minCol; c <= maxCol; c++) {
            const id = cellId(c, r);
            const cell = sheet.cells[id];
            if (cell && cell.value && !cell.formula) {
              const d = parseDate(cell.value);
              if (d) {
                const formatted = formatDateAs(d, dateFormat);
                if (formatted !== cell.value) {
                  changes[id] = { ...cell, value: formatted };
                }
              }
            }
          }
        }
        break;
      }
    }

    onApply(changes);
    onClose();
  }, [operation, rangeInfo, sheet, dupColumns, findText, replaceText, useRegex, caseType, dateFormat, getDelimiterChar, onApply, onClose]);

  return (
    <div className="cf-dialog-overlay" onClick={onClose}>
      <div className="cf-dialog" style={{ minWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="cf-dialog-header">
          <h3>Data Cleanup</h3>
          <button className="cf-close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="cf-dialog-body">
          <div className="cf-field">
            <label>Range</label>
            <input value={selectedRange} readOnly style={{ background: '#f5f5f5' }} />
          </div>
          <div className="cf-field">
            <label>Operation</label>
            <select value={operation} onChange={e => setOperation(e.target.value as CleanupOperation)}>
              <option value="trimWhitespace">Trim whitespace</option>
              <option value="removeDuplicates">Remove duplicates</option>
              <option value="findReplace">Find and replace</option>
              <option value="splitText">Split text to columns</option>
              <option value="changeCase">Change case</option>
              <option value="removeEmpty">Remove empty rows/columns</option>
              <option value="standardizeDates">Standardize date formats</option>
            </select>
          </div>

          {operation === 'removeDuplicates' && rangeInfo && (
            <div className="cf-field">
              <label>Check columns for duplicates:</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                {Array.from({ length: rangeInfo.maxCol - rangeInfo.minCol + 1 }, (_, i) => {
                  const c = rangeInfo.minCol + i;
                  return (
                    <label key={c} style={{ fontSize: 12 }}>
                      <input
                        type="checkbox"
                        checked={dupColumns.has(c)}
                        onChange={e => {
                          const next = new Set(dupColumns);
                          e.target.checked ? next.add(c) : next.delete(c);
                          setDupColumns(next);
                        }}
                      /> {indexToCol(c)}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {operation === 'findReplace' && (
            <>
              <div className="cf-field">
                <label>Find</label>
                <input value={findText} onChange={e => setFindText(e.target.value)} placeholder="Search text..." />
              </div>
              <div className="cf-field">
                <label>Replace with</label>
                <input value={replaceText} onChange={e => setReplaceText(e.target.value)} placeholder="Replacement..." />
              </div>
              <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                <input type="checkbox" checked={useRegex} onChange={e => setUseRegex(e.target.checked)} />
                Use regular expressions
              </label>
            </>
          )}

          {operation === 'splitText' && (
            <div className="cf-field">
              <label>Delimiter</label>
              <select value={delimiter} onChange={e => setDelimiter(e.target.value as typeof delimiter)}>
                <option value="comma">Comma (,)</option>
                <option value="semicolon">Semicolon (;)</option>
                <option value="space">Space</option>
                <option value="tab">Tab</option>
                <option value="custom">Custom</option>
              </select>
              {delimiter === 'custom' && (
                <input
                  value={customDelimiter}
                  onChange={e => setCustomDelimiter(e.target.value)}
                  placeholder="Enter delimiter..."
                  style={{ marginTop: 4 }}
                />
              )}
            </div>
          )}

          {operation === 'changeCase' && (
            <div className="cf-field">
              <label>Case type</label>
              <select value={caseType} onChange={e => setCaseType(e.target.value as typeof caseType)}>
                <option value="upper">UPPERCASE</option>
                <option value="lower">lowercase</option>
                <option value="title">Title Case</option>
                <option value="sentence">Sentence case</option>
              </select>
            </div>
          )}

          {operation === 'standardizeDates' && (
            <div className="cf-field">
              <label>Target format</label>
              <select value={dateFormat} onChange={e => setDateFormat(e.target.value as typeof dateFormat)}>
                <option value="YYYY-MM-DD">2024-01-15</option>
                <option value="MM/DD/YYYY">01/15/2024</option>
                <option value="DD/MM/YYYY">15/01/2024</option>
                <option value="MMMM D, YYYY">January 15, 2024</option>
              </select>
            </div>
          )}

          {/* Preview */}
          <div style={{
            marginTop: 12,
            padding: '8px 12px',
            background: preview.affected > 0 ? '#e8f5e9' : '#f5f5f5',
            borderRadius: 4,
            fontSize: 13,
          }}>
            📊 {preview.description}
          </div>
        </div>

        <div className="cf-dialog-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 16px' }}>
          <button onClick={onClose}>Cancel</button>
          <button
            className="cf-save-btn"
            onClick={handleApply}
            disabled={preview.affected === 0}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

// Date parsing helper
function parseDate(s: string): Date | null {
  // Try ISO format YYYY-MM-DD
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));

  // Try MM/DD/YYYY
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(parseInt(m[3]), parseInt(m[1]) - 1, parseInt(m[2]));

  // Try DD/MM/YYYY (only if day > 12 or unambiguous)
  // For now, try native Date parsing as fallback
  const d = new Date(s);
  if (!isNaN(d.getTime()) && d.getFullYear() > 1900 && d.getFullYear() < 2200) return d;

  return null;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function formatDateAs(d: Date, format: string): string {
  const y = d.getFullYear();
  const mo = d.getMonth() + 1;
  const day = d.getDate();

  switch (format) {
    case 'YYYY-MM-DD': return `${y}-${String(mo).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    case 'MM/DD/YYYY': return `${String(mo).padStart(2, '0')}/${String(day).padStart(2, '0')}/${y}`;
    case 'DD/MM/YYYY': return `${String(day).padStart(2, '0')}/${String(mo).padStart(2, '0')}/${y}`;
    case 'MMMM D, YYYY': return `${MONTHS[d.getMonth()]} ${day}, ${y}`;
    default: return `${y}-${String(mo).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
}
