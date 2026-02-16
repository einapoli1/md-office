import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { CellFormat, getCellStyle, formatCellValue } from './cellFormat';
import { cellId, indexToCol, extractRefs } from './formulaEngine';
import { WorkbookData, CellData, createWorkbook, createEmptySheet, getColWidth, getRowHeight, recalculate, buildDependencyGraph, recalcAll, UndoManager, serializeWorkbook, deserializeWorkbook } from './sheetModel';
import { DependencyGraph } from './formulaEngine';
import FormulaBar from './FormulaBar';
import SheetToolbar from './SheetToolbar';
import SheetTabs from './SheetTabs';
import './sheets-styles.css';

const NUM_COLS = 26;
const NUM_ROWS = 100;
const ROW_HEADER_WIDTH = 50;
const OVERSCAN = 5;

interface SpreadsheetEditorProps {
  initialData?: string;
  onSave?: (data: string) => void;
}

interface Selection {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export default function SpreadsheetEditor({ initialData, onSave }: SpreadsheetEditorProps) {
  const [workbook, setWorkbook] = useState<WorkbookData>(() => {
    if (initialData) {
      try { return deserializeWorkbook(initialData); } catch { /* fallthrough */ }
    }
    // Check localStorage
    const saved = localStorage.getItem('md-sheets-data');
    if (saved) {
      try { return deserializeWorkbook(saved); } catch { /* fallthrough */ }
    }
    return createWorkbook();
  });

  const [activeCell, setActiveCell] = useState<{ row: number; col: number }>({ row: 0, col: 0 });
  const [selection, setSelection] = useState<Selection>({ startRow: 0, startCol: 0, endRow: 0, endCol: 0 });
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [formulaBarValue, setFormulaBarValue] = useState('');
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const graphRef = useRef<DependencyGraph>(new DependencyGraph());
  const undoRef = useRef(new UndoManager());
  const containerRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const sheet = workbook.sheets[workbook.activeSheet];

  // Build dep graph on mount / sheet change
  useEffect(() => {
    graphRef.current = buildDependencyGraph(sheet);
    recalcAll(sheet, graphRef.current);
    triggerUpdate();
  }, [workbook.activeSheet]);

  // Trigger a re-render
  const [, setTick] = useState(0);
  const triggerUpdate = useCallback(() => setTick(t => t + 1), []);

  // Auto-save to localStorage
  useEffect(() => {
    const timer = setTimeout(() => {
      const data = serializeWorkbook(workbook);
      localStorage.setItem('md-sheets-data', data);
      onSave?.(data);
    }, 1000);
    return () => clearTimeout(timer);
  }, [workbook, onSave]);

  // Get display value for a cell
  const getCellDisplay = useCallback((id: string): string => {
    const cell = sheet.cells[id];
    if (!cell) return '';
    if (cell.formula) return formatCellValue(cell.computed ?? '', cell.format);
    return formatCellValue(cell.value, cell.format);
  }, [sheet]);

  // Get raw value (for formula bar)
  const getCellRaw = useCallback((id: string): string => {
    const cell = sheet.cells[id];
    if (!cell) return '';
    return cell.formula || cell.value;
  }, [sheet]);

  // Commit cell edit
  const commitEdit = useCallback((value?: string) => {
    const val = value ?? editValue;
    const id = cellId(activeCell.col, activeCell.row);
    const oldCell = sheet.cells[id] ? { ...sheet.cells[id] } : undefined;

    if (val === '') {
      if (oldCell) {
        const newCell = undefined;
        undoRef.current.push([{ sheetIndex: workbook.activeSheet, cellId: id, before: oldCell, after: newCell }]);
        delete sheet.cells[id];
        graphRef.current.removeDependencies(id);
      }
    } else {
      const newCell: CellData = val.startsWith('=')
        ? { value: '', formula: val, format: oldCell?.format }
        : { value: val, format: oldCell?.format };
      
      undoRef.current.push([{ sheetIndex: workbook.activeSheet, cellId: id, before: oldCell, after: { ...newCell } }]);
      sheet.cells[id] = newCell;
      
      if (newCell.formula) {
        const refs = extractRefs(newCell.formula);
        if (graphRef.current.hasCircular(id, refs)) {
          newCell.computed = '#CIRCULAR!';
        } else {
          graphRef.current.setDependencies(id, refs);
          recalculate(sheet, graphRef.current, id);
        }
      } else {
        graphRef.current.removeDependencies(id);
        recalculate(sheet, graphRef.current, id);
      }
    }

    setEditing(false);
    setWorkbook({ ...workbook });
  }, [editValue, activeCell, sheet, workbook]);

  // Start editing
  const startEdit = useCallback((initialChar?: string) => {
    const id = cellId(activeCell.col, activeCell.row);
    const raw = getCellRaw(id);
    setEditing(true);
    const val = initialChar !== undefined ? initialChar : raw;
    setEditValue(val);
    setFormulaBarValue(val);
    setTimeout(() => editInputRef.current?.focus(), 0);
  }, [activeCell, getCellRaw]);

  // Update formula bar when active cell changes
  useEffect(() => {
    if (!editing) {
      const id = cellId(activeCell.col, activeCell.row);
      setFormulaBarValue(getCellRaw(id));
    }
  }, [activeCell, editing, getCellRaw]);

  // Sync formula bar and cell edit
  const handleFormulaBarChange = useCallback((val: string) => {
    setFormulaBarValue(val);
    if (editing) setEditValue(val);
    else {
      startEdit();
      setEditValue(val);
    }
  }, [editing, startEdit]);

  // Navigation
  const moveTo = useCallback((row: number, col: number, shift?: boolean) => {
    const r = Math.max(0, Math.min(NUM_ROWS - 1, row));
    const c = Math.max(0, Math.min(NUM_COLS - 1, col));
    setActiveCell({ row: r, col: c });
    if (shift) {
      setSelection(s => ({ ...s, endRow: r, endCol: c }));
    } else {
      setSelection({ startRow: r, startCol: c, endRow: r, endCol: c });
    }
  }, []);

  // Keyboard handler
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (editing) {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitEdit();
        moveTo(activeCell.row + 1, activeCell.col);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        commitEdit();
        moveTo(activeCell.row, activeCell.col + (e.shiftKey ? -1 : 1));
      } else if (e.key === 'Escape') {
        setEditing(false);
        const id = cellId(activeCell.col, activeCell.row);
        setFormulaBarValue(getCellRaw(id));
      }
      return;
    }

    const shift = e.shiftKey;
    switch (e.key) {
      case 'ArrowUp': e.preventDefault(); moveTo(activeCell.row - 1, activeCell.col, shift); break;
      case 'ArrowDown': e.preventDefault(); moveTo(activeCell.row + 1, activeCell.col, shift); break;
      case 'ArrowLeft': e.preventDefault(); moveTo(activeCell.row, activeCell.col - 1, shift); break;
      case 'ArrowRight': e.preventDefault(); moveTo(activeCell.row, activeCell.col + 1, shift); break;
      case 'Tab':
        e.preventDefault();
        moveTo(activeCell.row, activeCell.col + (shift ? -1 : 1));
        break;
      case 'Enter':
        e.preventDefault();
        startEdit();
        break;
      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        commitEdit('');
        break;
      case 'F2':
        e.preventDefault();
        startEdit();
        break;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          startEdit(e.key);
        }
        // Undo/Redo
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            if (undoRef.current.canRedo()) {
              undoRef.current.redo(workbook);
              recalcAll(sheet, graphRef.current);
              setWorkbook({ ...workbook });
            }
          } else {
            if (undoRef.current.canUndo()) {
              undoRef.current.undo(workbook);
              recalcAll(sheet, graphRef.current);
              setWorkbook({ ...workbook });
            }
          }
        }
        break;
    }
  }, [editing, activeCell, commitEdit, moveTo, startEdit, workbook, sheet]);

  // Scroll handler
  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      setScrollTop(containerRef.current.scrollTop);
      setScrollLeft(containerRef.current.scrollLeft);
    }
  }, []);

  // Virtualization: compute visible range
  const containerHeight = containerRef.current?.clientHeight ?? 600;
  const containerWidth = containerRef.current?.clientWidth ?? 900;
  
  const visibleRows = useMemo(() => {
    const rowH = 28; // default row height
    const startRow = Math.max(0, Math.floor(scrollTop / rowH) - OVERSCAN);
    const endRow = Math.min(NUM_ROWS, Math.ceil((scrollTop + containerHeight) / rowH) + OVERSCAN);
    return { startRow, endRow };
  }, [scrollTop, containerHeight]);

  const visibleCols = useMemo(() => {
    let accW = 0;
    let startCol = 0;
    for (let c = 0; c < NUM_COLS; c++) {
      const w = getColWidth(sheet, c);
      if (accW + w >= scrollLeft - 200) { startCol = c; break; }
      accW += w;
    }
    accW = 0;
    let endCol = NUM_COLS;
    for (let c = 0; c < NUM_COLS; c++) {
      accW += getColWidth(sheet, c);
      if (accW > scrollLeft + containerWidth + 200) { endCol = c + 1; break; }
    }
    return { startCol: Math.max(0, startCol - OVERSCAN), endCol: Math.min(NUM_COLS, endCol + OVERSCAN) };
  }, [scrollLeft, containerWidth, sheet]);

  // Compute total grid size
  const totalWidth = useMemo(() => {
    let w = 0;
    for (let c = 0; c < NUM_COLS; c++) w += getColWidth(sheet, c);
    return w;
  }, [sheet]);
  const totalHeight = NUM_ROWS * 28;

  // Column left positions
  const colLefts = useMemo(() => {
    const lefts: number[] = [];
    let x = 0;
    for (let c = 0; c < NUM_COLS; c++) {
      lefts.push(x);
      x += getColWidth(sheet, c);
    }
    return lefts;
  }, [sheet]);

  // Cell click
  const handleCellClick = useCallback((row: number, col: number, e: React.MouseEvent) => {
    if (editing) commitEdit();
    if (e.shiftKey) {
      setSelection(s => ({ ...s, endRow: row, endCol: col }));
    } else {
      setActiveCell({ row, col });
      setSelection({ startRow: row, startCol: col, endRow: row, endCol: col });
    }
  }, [editing, commitEdit]);

  const handleCellDoubleClick = useCallback((_row: number, _col: number) => {
    startEdit();
  }, [startEdit]);

  // Selection range normalized
  const selRange = useMemo(() => ({
    minRow: Math.min(selection.startRow, selection.endRow),
    maxRow: Math.max(selection.startRow, selection.endRow),
    minCol: Math.min(selection.startCol, selection.endCol),
    maxCol: Math.max(selection.startCol, selection.endCol),
  }), [selection]);

  // Current cell format
  const currentFormat = useMemo((): CellFormat => {
    const id = cellId(activeCell.col, activeCell.row);
    return sheet.cells[id]?.format || {};
  }, [activeCell, sheet]);

  // Format change handler
  const handleFormatChange = useCallback((updates: Partial<CellFormat>) => {
    const entries: import('./sheetModel').UndoEntry[] = [];
    for (let r = selRange.minRow; r <= selRange.maxRow; r++) {
      for (let c = selRange.minCol; c <= selRange.maxCol; c++) {
        const id = cellId(c, r);
        const old = sheet.cells[id] ? { ...sheet.cells[id] } : undefined;
        if (!sheet.cells[id]) sheet.cells[id] = { value: '' };
        sheet.cells[id].format = { ...sheet.cells[id].format, ...updates };
        entries.push({ sheetIndex: workbook.activeSheet, cellId: id, before: old, after: { ...sheet.cells[id] } });
      }
    }
    undoRef.current.push(entries);
    setWorkbook({ ...workbook });
  }, [selRange, sheet, workbook]);

  // Merge cells
  const handleMergeCells = useCallback(() => {
    if (selRange.minRow === selRange.maxRow && selRange.minCol === selRange.maxCol) return;
    sheet.merges.push({
      startRow: selRange.minRow,
      startCol: selRange.minCol,
      endRow: selRange.maxRow,
      endCol: selRange.maxCol,
    });
    setWorkbook({ ...workbook });
  }, [selRange, sheet, workbook]);

  // Sheet tab handlers
  const handleAddSheet = useCallback(() => {
    workbook.sheets.push(createEmptySheet(`Sheet${workbook.sheets.length + 1}`));
    workbook.activeSheet = workbook.sheets.length - 1;
    setWorkbook({ ...workbook });
  }, [workbook]);

  const handleSelectSheet = useCallback((idx: number) => {
    if (editing) commitEdit();
    workbook.activeSheet = idx;
    setActiveCell({ row: 0, col: 0 });
    setSelection({ startRow: 0, startCol: 0, endRow: 0, endCol: 0 });
    setWorkbook({ ...workbook });
  }, [workbook, editing, commitEdit]);

  const handleRenameSheet = useCallback((idx: number, name: string) => {
    workbook.sheets[idx].name = name;
    setWorkbook({ ...workbook });
  }, [workbook]);

  const handleDeleteSheet = useCallback((idx: number) => {
    if (workbook.sheets.length <= 1) return;
    workbook.sheets.splice(idx, 1);
    if (workbook.activeSheet >= workbook.sheets.length) workbook.activeSheet = workbook.sheets.length - 1;
    setWorkbook({ ...workbook });
  }, [workbook]);

  // Column resize on double-click header border
  const handleColHeaderDoubleClick = useCallback((col: number) => {
    // Auto-fit: find max content width
    let maxW = 60;
    for (let r = 0; r < NUM_ROWS; r++) {
      const id = cellId(col, r);
      const display = getCellDisplay(id);
      if (display) {
        maxW = Math.max(maxW, display.length * 8 + 16);
      }
    }
    sheet.colWidths[col] = Math.min(300, maxW);
    setWorkbook({ ...workbook });
  }, [sheet, workbook, getCellDisplay]);

  return (
    <div className="spreadsheet-editor" onKeyDown={handleKeyDown} tabIndex={0}>
      <SheetToolbar
        format={currentFormat}
        onFormatChange={handleFormatChange}
        onMergeCells={handleMergeCells}
        canUndo={undoRef.current.canUndo()}
        canRedo={undoRef.current.canRedo()}
        onUndo={() => { undoRef.current.undo(workbook); recalcAll(sheet, graphRef.current); setWorkbook({ ...workbook }); }}
        onRedo={() => { undoRef.current.redo(workbook); recalcAll(sheet, graphRef.current); setWorkbook({ ...workbook }); }}
      />
      <FormulaBar
        cellRef={cellId(activeCell.col, activeCell.row)}
        value={formulaBarValue}
        onChange={handleFormulaBarChange}
        onCommit={() => { if (editing) commitEdit(formulaBarValue); }}
        onCancel={() => {
          setEditing(false);
          setFormulaBarValue(getCellRaw(cellId(activeCell.col, activeCell.row)));
        }}
      />
      
      <div className="sheet-grid-wrapper">
        {/* Corner */}
        <div className="sheet-corner" />
        
        {/* Column headers */}
        <div className="sheet-col-headers" style={{ width: totalWidth, transform: `translateX(-${scrollLeft}px)` }}>
          {Array.from({ length: NUM_COLS }, (_, c) => (
            <div
              key={c}
              className={`sheet-col-header ${c >= selRange.minCol && c <= selRange.maxCol ? 'selected' : ''}`}
              style={{ width: getColWidth(sheet, c), left: colLefts[c] }}
              onDoubleClick={() => handleColHeaderDoubleClick(c)}
            >
              {indexToCol(c)}
            </div>
          ))}
        </div>

        <div className="sheet-body-wrapper">
          {/* Row headers */}
          <div className="sheet-row-headers" style={{ height: totalHeight, transform: `translateY(-${scrollTop}px)` }}>
            {Array.from({ length: visibleRows.endRow - visibleRows.startRow }, (_, i) => {
              const r = visibleRows.startRow + i;
              return (
                <div
                  key={r}
                  className={`sheet-row-header ${r >= selRange.minRow && r <= selRange.maxRow ? 'selected' : ''}`}
                  style={{ top: r * 28, height: getRowHeight(sheet, r), width: ROW_HEADER_WIDTH }}
                >
                  {r + 1}
                </div>
              );
            })}
          </div>

          {/* Grid */}
          <div
            ref={containerRef}
            className="sheet-grid-container"
            onScroll={handleScroll}
          >
            <div className="sheet-grid" style={{ width: totalWidth, height: totalHeight }}>
              {/* Selection highlight */}
              {(selRange.minRow !== selRange.maxRow || selRange.minCol !== selRange.maxCol) && (
                <div
                  className="sheet-selection-range"
                  style={{
                    top: selRange.minRow * 28,
                    left: colLefts[selRange.minCol],
                    width: colLefts[selRange.maxCol] + getColWidth(sheet, selRange.maxCol) - colLefts[selRange.minCol],
                    height: (selRange.maxRow - selRange.minRow + 1) * 28,
                  }}
                />
              )}

              {/* Active cell highlight */}
              <div
                className="sheet-active-cell"
                style={{
                  top: activeCell.row * 28,
                  left: colLefts[activeCell.col],
                  width: getColWidth(sheet, activeCell.col),
                  height: 28,
                }}
              />

              {/* Cells */}
              {Array.from({ length: visibleRows.endRow - visibleRows.startRow }, (_, ri) => {
                const r = visibleRows.startRow + ri;
                return Array.from({ length: visibleCols.endCol - visibleCols.startCol }, (_, ci) => {
                  const c = visibleCols.startCol + ci;
                  const id = cellId(c, r);
                  const cell = sheet.cells[id];
                  const display = getCellDisplay(id);
                  const isActive = r === activeCell.row && c === activeCell.col;
                  const style: React.CSSProperties = {
                    position: 'absolute',
                    top: r * 28,
                    left: colLefts[c],
                    width: getColWidth(sheet, c),
                    height: 28,
                    ...getCellStyle(cell?.format),
                  };

                  if (isActive && editing) {
                    return (
                      <input
                        key={id}
                        ref={editInputRef}
                        className="sheet-cell-input"
                        style={style}
                        value={editValue}
                        onChange={e => {
                          setEditValue(e.target.value);
                          setFormulaBarValue(e.target.value);
                        }}
                        onBlur={() => commitEdit()}
                      />
                    );
                  }

                  return (
                    <div
                      key={id}
                      className="sheet-cell"
                      style={style}
                      onClick={e => handleCellClick(r, c, e)}
                      onDoubleClick={() => handleCellDoubleClick(r, c)}
                    >
                      {display}
                    </div>
                  );
                });
              }).flat()}
            </div>
          </div>
        </div>
      </div>

      <SheetTabs
        sheets={workbook.sheets}
        activeSheet={workbook.activeSheet}
        onSelectSheet={handleSelectSheet}
        onAddSheet={handleAddSheet}
        onRenameSheet={handleRenameSheet}
        onDeleteSheet={handleDeleteSheet}
      />
    </div>
  );
}
