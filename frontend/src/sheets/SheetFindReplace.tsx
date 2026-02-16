import { useState, useCallback, useEffect, useRef } from 'react';
import type { WorkbookData } from './sheetModel';
import { cellId } from './formulaEngine';

const NUM_COLS = 26;
const NUM_ROWS = 100;

export interface FindMatch {
  sheetIndex: number;
  row: number;
  col: number;
  cellId: string;
}

interface SheetFindReplaceProps {
  workbook: WorkbookData;
  activeSheet: number;
  onNavigate: (sheetIndex: number, row: number, col: number) => void;
  onReplace: (sheetIndex: number, cellId: string, oldVal: string, newVal: string) => void;
  onClose: () => void;
  /** Start in replace mode */
  replaceMode?: boolean;
}

export default function SheetFindReplace({
  workbook,
  activeSheet,
  onNavigate,
  onReplace,
  onClose,
  replaceMode = false,
}: SheetFindReplaceProps) {
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [showReplace, setShowReplace] = useState(replaceMode);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [matchEntireCell, setMatchEntireCell] = useState(false);
  const [searchAllSheets, setSearchAllSheets] = useState(false);
  const [matches, setMatches] = useState<FindMatch[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const search = useCallback(() => {
    if (!query) { setMatches([]); setCurrentIndex(-1); return; }

    const results: FindMatch[] = [];
    const sheets = searchAllSheets
      ? workbook.sheets.map((_, i) => i)
      : [activeSheet];

    for (const si of sheets) {
      const sheet = workbook.sheets[si];
      for (let r = 0; r < NUM_ROWS; r++) {
        for (let c = 0; c < NUM_COLS; c++) {
          const id = cellId(c, r);
          const cell = sheet.cells[id];
          if (!cell) continue;
          const val = cell.computed ?? cell.value;
          const q = caseSensitive ? query : query.toLowerCase();
          const v = caseSensitive ? val : val.toLowerCase();
          if (matchEntireCell ? v === q : v.includes(q)) {
            results.push({ sheetIndex: si, row: r, col: c, cellId: id });
          }
        }
      }
    }

    setMatches(results);
    if (results.length > 0) {
      setCurrentIndex(0);
      onNavigate(results[0].sheetIndex, results[0].row, results[0].col);
    } else {
      setCurrentIndex(-1);
    }
  }, [query, caseSensitive, matchEntireCell, searchAllSheets, workbook, activeSheet, onNavigate]);

  // Re-search when query or options change
  useEffect(() => { search(); }, [query, caseSensitive, matchEntireCell, searchAllSheets]);

  const goTo = useCallback((idx: number) => {
    if (matches.length === 0) return;
    const wrapped = ((idx % matches.length) + matches.length) % matches.length;
    setCurrentIndex(wrapped);
    const m = matches[wrapped];
    onNavigate(m.sheetIndex, m.row, m.col);
  }, [matches, onNavigate]);

  const handleReplace = useCallback(() => {
    if (currentIndex < 0 || currentIndex >= matches.length) return;
    const m = matches[currentIndex];
    const sheet = workbook.sheets[m.sheetIndex];
    const cell = sheet.cells[m.cellId];
    if (!cell) return;
    const val = cell.computed ?? cell.value;
    const q = caseSensitive ? query : query.toLowerCase();
    const v = caseSensitive ? val : val.toLowerCase();
    let newVal: string;
    if (matchEntireCell) {
      newVal = replacement;
    } else {
      const idx = v.indexOf(q);
      newVal = val.substring(0, idx) + replacement + val.substring(idx + query.length);
    }
    onReplace(m.sheetIndex, m.cellId, val, newVal);
    // Re-search after replace
    setTimeout(search, 0);
  }, [currentIndex, matches, workbook, query, replacement, caseSensitive, matchEntireCell, onReplace, search]);

  const handleReplaceAll = useCallback(() => {
    // Replace from end to avoid index shifting issues
    for (let i = matches.length - 1; i >= 0; i--) {
      const m = matches[i];
      const sheet = workbook.sheets[m.sheetIndex];
      const cell = sheet.cells[m.cellId];
      if (!cell) continue;
      const val = cell.computed ?? cell.value;
      const q = caseSensitive ? query : query.toLowerCase();
      const v = caseSensitive ? val : val.toLowerCase();
      let newVal: string;
      if (matchEntireCell) {
        newVal = replacement;
      } else {
        const idx = v.indexOf(q);
        newVal = val.substring(0, idx) + replacement + val.substring(idx + query.length);
      }
      onReplace(m.sheetIndex, m.cellId, val, newVal);
    }
    setTimeout(search, 0);
  }, [matches, workbook, query, replacement, caseSensitive, matchEntireCell, onReplace, search]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) goTo(currentIndex - 1);
      else goTo(currentIndex + 1);
    }
    // Stop propagation so spreadsheet doesn't capture these
    e.stopPropagation();
  }, [onClose, goTo, currentIndex]);

  return (
    <div className="sheet-find-replace" onKeyDown={handleKeyDown}>
      <div className="sheet-find-row">
        <input
          ref={inputRef}
          className="sheet-find-input"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Find"
        />
        <span className="sheet-find-count">
          {matches.length > 0 ? `${currentIndex + 1} of ${matches.length}` : query ? 'No results' : ''}
        </span>
        <button className="sheet-tb-btn" onClick={() => goTo(currentIndex - 1)} title="Previous" disabled={matches.length === 0}>▲</button>
        <button className="sheet-tb-btn" onClick={() => goTo(currentIndex + 1)} title="Next" disabled={matches.length === 0}>▼</button>
        <button className="sheet-tb-btn" onClick={() => setShowReplace(!showReplace)} title="Toggle replace">⇄</button>
        <button className="sheet-tb-btn" onClick={onClose} title="Close">✕</button>
      </div>

      {showReplace && (
        <div className="sheet-find-row">
          <input
            className="sheet-find-input"
            value={replacement}
            onChange={e => setReplacement(e.target.value)}
            placeholder="Replace with"
          />
          <button
            className="sheet-tb-btn"
            onClick={handleReplace}
            disabled={matches.length === 0}
            title="Replace"
          >Replace</button>
          <button
            className="sheet-tb-btn"
            onClick={handleReplaceAll}
            disabled={matches.length === 0}
            title="Replace all"
          >All</button>
        </div>
      )}

      <div className="sheet-find-options">
        <label><input type="checkbox" checked={caseSensitive} onChange={e => setCaseSensitive(e.target.checked)} /> Case sensitive</label>
        <label><input type="checkbox" checked={matchEntireCell} onChange={e => setMatchEntireCell(e.target.checked)} /> Match entire cell</label>
        <label><input type="checkbox" checked={searchAllSheets} onChange={e => setSearchAllSheets(e.target.checked)} /> All sheets</label>
      </div>
    </div>
  );
}

/** Returns set of cell IDs that match current find query (for highlight rendering) */
export function getFindMatchCellIds(matches: FindMatch[], activeSheet: number): Set<string> {
  const s = new Set<string>();
  for (const m of matches) {
    if (m.sheetIndex === activeSheet) s.add(m.cellId);
  }
  return s;
}
