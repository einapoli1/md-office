import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { CellFormat, getCellStyle, formatCellValue } from './cellFormat';
import { cellId, indexToCol, extractRefs } from './formulaEngine';
import { WorkbookData, CellData, createWorkbook, createEmptySheet, getColWidth, getRowHeight, recalculate, buildDependencyGraph, recalcAll, UndoManager, serializeWorkbook, deserializeWorkbook, ChartConfig, FilterState, FreezePanes } from './sheetModel';
import { DependencyGraph } from './formulaEngine';
import FormulaBar from './FormulaBar';
import SheetToolbar from './SheetToolbar';
import SheetTabs from './SheetTabs';
import { SheetChartOverlay, InsertChartDialog } from './SheetChart';
import { exportCSV, importCSV, exportXLSX, importXLSX, downloadBlob, downloadString } from './sheetIO';
import ConditionalFormatDialog from './ConditionalFormat';
import DataValidationDialog from './DataValidation';
import { evaluateConditionalFormats, getNumericValuesInRange, isCellInRange, validateCell } from './conditionalEval';
import type { ConditionalRule, ValidationRule } from './conditionalEval';
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

interface ContextMenu {
  x: number;
  y: number;
  type: 'col' | 'row';
  index: number;
}

interface FilterDropdown {
  col: number;
  x: number;
  y: number;
}

export default function SpreadsheetEditor({ initialData, onSave }: SpreadsheetEditorProps) {
  const [workbook, setWorkbook] = useState<WorkbookData>(() => {
    if (initialData) {
      try { return deserializeWorkbook(initialData); } catch { /* fallthrough */ }
    }
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
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [showChartDialog, setShowChartDialog] = useState(false);
  const [filterDropdown, setFilterDropdown] = useState<FilterDropdown | null>(null);
  const [hiddenRows, setHiddenRows] = useState<Set<number>>(new Set());
  const [showCFDialog, setShowCFDialog] = useState(false);
  const [showDVDialog, setShowDVDialog] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const graphRef = useRef<DependencyGraph>(new DependencyGraph());
  const undoRef = useRef(new UndoManager());
  const containerRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const sheet = workbook.sheets[workbook.activeSheet];

  // Ensure sheet has new fields
  if (!sheet.charts) sheet.charts = [];
  if (!sheet.filters) sheet.filters = [];
  if (sheet.filtersEnabled === undefined) sheet.filtersEnabled = false;
  if (!sheet.freeze) sheet.freeze = { rows: 0, cols: 0 };
  if (!sheet.conditionalFormats) sheet.conditionalFormats = [];
  if (!sheet.validationRules) sheet.validationRules = [];

  // Build dep graph on mount / sheet change
  useEffect(() => {
    graphRef.current = buildDependencyGraph(sheet);
    recalcAll(sheet, graphRef.current);
    triggerUpdate();
  }, [workbook.activeSheet]);

  const [, setTick] = useState(0);
  const triggerUpdate = useCallback(() => setTick(t => t + 1), []);

  // Auto-save
  useEffect(() => {
    const timer = setTimeout(() => {
      const data = serializeWorkbook(workbook);
      localStorage.setItem('md-sheets-data', data);
      onSave?.(data);
    }, 1000);
    return () => clearTimeout(timer);
  }, [workbook, onSave]);

  // Close context menu on click outside
  useEffect(() => {
    const handler = () => { setContextMenu(null); setFilterDropdown(null); };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // Compute hidden rows from filters
  useEffect(() => {
    if (!sheet.filtersEnabled || sheet.filters.length === 0) {
      setHiddenRows(new Set());
      return;
    }
    const hidden = new Set<number>();
    for (let r = 0; r < NUM_ROWS; r++) {
      for (const f of sheet.filters) {
        const id = cellId(f.column, r);
        const cell = sheet.cells[id];
        const val = cell ? (cell.computed ?? cell.value) : '';
        if (!matchesFilter(val, f)) {
          hidden.add(r);
          break;
        }
      }
    }
    setHiddenRows(hidden);
  }, [sheet.filters, sheet.filtersEnabled, sheet.cells]);

  const getCellDisplay = useCallback((id: string): string => {
    const cell = sheet.cells[id];
    if (!cell) return '';
    if (cell.formula) return formatCellValue(cell.computed ?? '', cell.format);
    return formatCellValue(cell.value, cell.format);
  }, [sheet]);

  const getCellRaw = useCallback((id: string): string => {
    const cell = sheet.cells[id];
    if (!cell) return '';
    return cell.formula || cell.value;
  }, [sheet]);

  const commitEdit = useCallback((value?: string) => {
    const val = value ?? editValue;
    const id = cellId(activeCell.col, activeCell.row);
    const oldCell = sheet.cells[id] ? { ...sheet.cells[id] } : undefined;

    if (val === '') {
      if (oldCell) {
        undoRef.current.push([{ sheetIndex: workbook.activeSheet, cellId: id, before: oldCell, after: undefined }]);
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

    // Validate
    const newErrors = { ...validationErrors };
    const cellVal = sheet.cells[id] ? (sheet.cells[id].computed ?? sheet.cells[id].value) : '';
    let hasValidationIssue = false;
    for (const vr of sheet.conditionalFormats ? sheet.validationRules || [] : sheet.validationRules || []) {
      if (isCellInRange(activeCell.col, activeCell.row, vr.range)) {
        const result = validateCell(cellVal, vr.rule);
        if (!result.valid) {
          newErrors[id] = result.message || 'Invalid';
          hasValidationIssue = true;
          if (vr.rule.onInvalid === 'reject' && val !== '') {
            // Restore old value
            if (oldCell) sheet.cells[id] = { ...oldCell };
            else delete sheet.cells[id];
            alert(result.message || 'Invalid value');
            setEditing(false);
            return;
          }
        } else {
          delete newErrors[id];
        }
      }
    }
    if (!hasValidationIssue) delete newErrors[id];
    setValidationErrors(newErrors);

    setEditing(false);
    setWorkbook({ ...workbook });
  }, [editValue, activeCell, sheet, workbook, validationErrors]);

  const startEdit = useCallback((initialChar?: string) => {
    const id = cellId(activeCell.col, activeCell.row);
    const raw = getCellRaw(id);
    setEditing(true);
    const val = initialChar !== undefined ? initialChar : raw;
    setEditValue(val);
    setFormulaBarValue(val);
    setTimeout(() => editInputRef.current?.focus(), 0);
  }, [activeCell, getCellRaw]);

  useEffect(() => {
    if (!editing) {
      const id = cellId(activeCell.col, activeCell.row);
      setFormulaBarValue(getCellRaw(id));
    }
  }, [activeCell, editing, getCellRaw]);

  const handleFormulaBarChange = useCallback((val: string) => {
    setFormulaBarValue(val);
    if (editing) setEditValue(val);
    else {
      startEdit();
      setEditValue(val);
    }
  }, [editing, startEdit]);

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
  }, [editing, activeCell, commitEdit, moveTo, startEdit, workbook, sheet, getCellRaw]);

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      setScrollTop(containerRef.current.scrollTop);
      setScrollLeft(containerRef.current.scrollLeft);
    }
  }, []);

  const containerHeight = containerRef.current?.clientHeight ?? 600;
  const containerWidth = containerRef.current?.clientWidth ?? 900;
  
  const visibleRows = useMemo(() => {
    const rowH = 28;
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

  const totalWidth = useMemo(() => {
    let w = 0;
    for (let c = 0; c < NUM_COLS; c++) w += getColWidth(sheet, c);
    return w;
  }, [sheet]);
  const totalHeight = NUM_ROWS * 28;

  const colLefts = useMemo(() => {
    const lefts: number[] = [];
    let x = 0;
    for (let c = 0; c < NUM_COLS; c++) {
      lefts.push(x);
      x += getColWidth(sheet, c);
    }
    return lefts;
  }, [sheet]);

  const handleCellClick = useCallback((row: number, col: number, e: React.MouseEvent) => {
    if (editing) commitEdit();
    if (e.shiftKey) {
      setSelection(s => ({ ...s, endRow: row, endCol: col }));
    } else {
      setActiveCell({ row, col });
      setSelection({ startRow: row, startCol: col, endRow: row, endCol: col });
    }
  }, [editing, commitEdit]);

  const handleCellDoubleClick = useCallback(() => {
    startEdit();
  }, [startEdit]);

  const selRange = useMemo(() => ({
    minRow: Math.min(selection.startRow, selection.endRow),
    maxRow: Math.max(selection.startRow, selection.endRow),
    minCol: Math.min(selection.startCol, selection.endCol),
    maxCol: Math.max(selection.startCol, selection.endCol),
  }), [selection]);

  const selectedRangeStr = useMemo(() => {
    return `${indexToCol(selRange.minCol)}${selRange.minRow + 1}:${indexToCol(selRange.maxCol)}${selRange.maxRow + 1}`;
  }, [selRange]);

  const currentFormat = useMemo((): CellFormat => {
    const id = cellId(activeCell.col, activeCell.row);
    return sheet.cells[id]?.format || {};
  }, [activeCell, sheet]);

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

  const handleColHeaderDoubleClick = useCallback((col: number) => {
    let maxW = 60;
    for (let r = 0; r < NUM_ROWS; r++) {
      const id = cellId(col, r);
      const display = getCellDisplay(id);
      if (display) maxW = Math.max(maxW, display.length * 8 + 16);
    }
    sheet.colWidths[col] = Math.min(300, maxW);
    setWorkbook({ ...workbook });
  }, [sheet, workbook, getCellDisplay]);

  // Context menu handlers
  const handleColHeaderContextMenu = useCallback((col: number, e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'col', index: col });
  }, []);

  const handleRowHeaderContextMenu = useCallback((row: number, e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'row', index: row });
  }, []);

  // Sorting
  const sortByColumn = useCallback((col: number, ascending: boolean) => {
    // Collect all rows with data
    const rows: { row: number; sortVal: string }[] = [];
    for (let r = 0; r < NUM_ROWS; r++) {
      const id = cellId(col, r);
      const cell = sheet.cells[id];
      const val = cell ? (cell.computed ?? cell.value) : '';
      rows.push({ row: r, sortVal: val });
    }

    // Find data range (skip header row 0 if it has content)
    const hasData = rows.filter(r => r.sortVal !== '');
    if (hasData.length < 2) return;
    const startRow = 1; // assume row 0 is header

    const dataRows = rows.slice(startRow).filter(r => r.sortVal !== '');
    dataRows.sort((a, b) => {
      const na = parseFloat(a.sortVal), nb = parseFloat(b.sortVal);
      if (!isNaN(na) && !isNaN(nb)) return ascending ? na - nb : nb - na;
      return ascending ? a.sortVal.localeCompare(b.sortVal) : b.sortVal.localeCompare(a.sortVal);
    });

    // Rebuild cells by swapping rows
    const oldCells = { ...sheet.cells };
    // Clear data rows
    for (let r = startRow; r < NUM_ROWS; r++) {
      for (let c = 0; c < NUM_COLS; c++) {
        delete sheet.cells[cellId(c, r)];
      }
    }
    // Write sorted
    for (let i = 0; i < dataRows.length; i++) {
      const srcRow = dataRows[i].row;
      const dstRow = startRow + i;
      for (let c = 0; c < NUM_COLS; c++) {
        const srcId = cellId(c, srcRow);
        const cell = oldCells[srcId];
        if (cell) sheet.cells[cellId(c, dstRow)] = cell;
      }
    }

    sheet.sortState = { col, ascending };
    graphRef.current = buildDependencyGraph(sheet);
    recalcAll(sheet, graphRef.current);
    setWorkbook({ ...workbook });
    setContextMenu(null);
  }, [sheet, workbook]);

  // Freeze panes
  const handleFreezeChange = useCallback((freeze: FreezePanes) => {
    sheet.freeze = freeze;
    setWorkbook({ ...workbook });
  }, [sheet, workbook]);

  const handleFreezeUpToRow = useCallback((row: number) => {
    sheet.freeze = { ...sheet.freeze, rows: row + 1 };
    setWorkbook({ ...workbook });
    setContextMenu(null);
  }, [sheet, workbook]);

  const handleFreezeUpToCol = useCallback((col: number) => {
    sheet.freeze = { ...sheet.freeze, cols: col + 1 };
    setWorkbook({ ...workbook });
    setContextMenu(null);
  }, [sheet, workbook]);

  // Charts
  const handleInsertChart = useCallback((config: Omit<ChartConfig, 'id' | 'x' | 'y'>) => {
    const chart: ChartConfig = {
      ...config,
      id: `chart_${Date.now()}`,
      x: 100 + scrollLeft,
      y: 100 + scrollTop,
    };
    sheet.charts.push(chart);
    setShowChartDialog(false);
    setWorkbook({ ...workbook });
  }, [sheet, workbook, scrollLeft, scrollTop]);

  const handleChartMove = useCallback((id: string, x: number, y: number) => {
    const chart = sheet.charts.find(c => c.id === id);
    if (chart) { chart.x = x; chart.y = y; triggerUpdate(); }
  }, [sheet, triggerUpdate]);

  const handleChartResize = useCallback((id: string, w: number, h: number) => {
    const chart = sheet.charts.find(c => c.id === id);
    if (chart) { chart.width = w; chart.height = h; triggerUpdate(); }
  }, [sheet, triggerUpdate]);

  const handleChartDelete = useCallback((id: string) => {
    sheet.charts = sheet.charts.filter(c => c.id !== id);
    setWorkbook({ ...workbook });
  }, [sheet, workbook]);

  // Filters
  const handleToggleFilters = useCallback(() => {
    sheet.filtersEnabled = !sheet.filtersEnabled;
    if (!sheet.filtersEnabled) sheet.filters = [];
    setWorkbook({ ...workbook });
  }, [sheet, workbook]);

  const handleFilterClick = useCallback((col: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setFilterDropdown(prev => prev?.col === col ? null : { col, x: e.clientX, y: e.clientY });
  }, []);

  const getUniqueValues = useCallback((col: number): string[] => {
    const vals = new Set<string>();
    for (let r = 0; r < NUM_ROWS; r++) {
      const id = cellId(col, r);
      const cell = sheet.cells[id];
      if (cell) vals.add(cell.computed ?? cell.value);
    }
    return Array.from(vals).sort();
  }, [sheet]);

  const applyFilter = useCallback((col: number, mode: FilterState['mode'], value?: string, selectedValues?: Set<string>) => {
    const existing = sheet.filters.findIndex(f => f.column === col);
    if (mode === 'all') {
      if (existing >= 0) sheet.filters.splice(existing, 1);
    } else {
      const filter: FilterState = { column: col, mode, value, selectedValues };
      if (existing >= 0) sheet.filters[existing] = filter;
      else sheet.filters.push(filter);
    }
    setFilterDropdown(null);
    setWorkbook({ ...workbook });
  }, [sheet, workbook]);

  // Import/Export handlers
  const handleImportCSV = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const csv = reader.result as string;
      const imported = importCSV(csv);
      imported.name = file.name.replace(/\.csv$/i, '') || 'Imported';
      workbook.sheets.push(imported);
      workbook.activeSheet = workbook.sheets.length - 1;
      graphRef.current = buildDependencyGraph(imported);
      recalcAll(imported, graphRef.current);
      setWorkbook({ ...workbook });
    };
    reader.readAsText(file);
  }, [workbook]);

  const handleImportXLSX = useCallback(async (file: File) => {
    const sheets = await importXLSX(file);
    for (const s of sheets) {
      workbook.sheets.push(s);
    }
    workbook.activeSheet = workbook.sheets.length - sheets.length;
    graphRef.current = buildDependencyGraph(workbook.sheets[workbook.activeSheet]);
    recalcAll(workbook.sheets[workbook.activeSheet], graphRef.current);
    setWorkbook({ ...workbook });
  }, [workbook]);

  const handleExportCSV = useCallback(() => {
    const csv = exportCSV(sheet);
    downloadString(csv, `${sheet.name || 'sheet'}.csv`, 'text/csv');
  }, [sheet]);

  const handleExportXLSX = useCallback(() => {
    const blob = exportXLSX(workbook.sheets);
    downloadBlob(blob, 'spreadsheet.xlsx');
  }, [workbook.sheets]);

  // Freeze pane styles
  const freezeRowPx = sheet.freeze.rows * 28;
  const freezeColPx = useMemo(() => {
    let w = 0;
    for (let c = 0; c < sheet.freeze.cols; c++) w += getColWidth(sheet, c);
    return w;
  }, [sheet]);

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
        onInsertChart={() => setShowChartDialog(true)}
        filtersEnabled={sheet.filtersEnabled}
        onToggleFilters={handleToggleFilters}
        freeze={sheet.freeze}
        onFreezeChange={handleFreezeChange}
        onImportCSV={handleImportCSV}
        onImportXLSX={handleImportXLSX}
        onExportCSV={handleExportCSV}
        onExportXLSX={handleExportXLSX}
        onConditionalFormat={() => setShowCFDialog(true)}
        onDataValidation={() => setShowDVDialog(true)}
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
              style={{
                width: getColWidth(sheet, c),
                left: colLefts[c],
                ...(c < sheet.freeze.cols ? { position: 'sticky' as const, left: colLefts[c], zIndex: 3 } : {}),
              }}
              onDoubleClick={() => handleColHeaderDoubleClick(c)}
              onContextMenu={e => handleColHeaderContextMenu(c, e)}
            >
              {indexToCol(c)}
              {sheet.filtersEnabled && (
                <span
                  className="sheet-filter-arrow"
                  style={{ position: 'absolute', right: 2, top: 2, cursor: 'pointer', fontSize: 10, opacity: 0.6 }}
                  onClick={e => handleFilterClick(c, e)}
                >▼</span>
              )}
            </div>
          ))}
        </div>

        <div className="sheet-body-wrapper">
          {/* Row headers */}
          <div className="sheet-row-headers" style={{ height: totalHeight, transform: `translateY(-${scrollTop}px)` }}>
            {Array.from({ length: visibleRows.endRow - visibleRows.startRow }, (_, i) => {
              const r = visibleRows.startRow + i;
              if (hiddenRows.has(r)) return null;
              return (
                <div
                  key={r}
                  className={`sheet-row-header ${r >= selRange.minRow && r <= selRange.maxRow ? 'selected' : ''}`}
                  style={{
                    top: r * 28,
                    height: getRowHeight(sheet, r),
                    width: ROW_HEADER_WIDTH,
                    ...(r < sheet.freeze.rows ? { position: 'sticky' as const, top: r * 28, zIndex: 3 } : {}),
                  }}
                  onContextMenu={e => handleRowHeaderContextMenu(r, e)}
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
              {/* Freeze boundary lines */}
              {sheet.freeze.rows > 0 && (
                <div className="sheet-freeze-line-h" style={{ position: 'absolute', left: 0, top: freezeRowPx, width: totalWidth, height: 2, background: '#1a73e8', zIndex: 5, pointerEvents: 'none' }} />
              )}
              {sheet.freeze.cols > 0 && (
                <div className="sheet-freeze-line-v" style={{ position: 'absolute', top: 0, left: freezeColPx, width: 2, height: totalHeight, background: '#1a73e8', zIndex: 5, pointerEvents: 'none' }} />
              )}

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
                if (hiddenRows.has(r)) return null;
                return Array.from({ length: visibleCols.endCol - visibleCols.startCol }, (_, ci) => {
                  const c = visibleCols.startCol + ci;
                  const id = cellId(c, r);
                  const cell = sheet.cells[id];
                  const display = getCellDisplay(id);
                  const isActive = r === activeCell.row && c === activeCell.col;
                  const isFrozenRow = r < sheet.freeze.rows;
                  const isFrozenCol = c < sheet.freeze.cols;

                  // Conditional formatting
                  const cellValue = cell ? (cell.computed ?? cell.value) : '';
                  const cfResult = sheet.conditionalFormats.length > 0
                    ? evaluateConditionalFormats(c, r, cellValue, sheet.conditionalFormats,
                        getNumericValuesInRange(
                          sheet.conditionalFormats.find(cf => isCellInRange(c, r, cf.range) && (cf.type === 'colorScale' || cf.type === 'dataBars'))?.range || '',
                          sheet.cells
                        ))
                    : null;

                  // Validation error
                  const valError = validationErrors[id];
                  const hasListValidation = sheet.validationRules.some(vr => vr.rule.type === 'list' && isCellInRange(c, r, vr.range));

                  const style: React.CSSProperties = {
                    position: 'absolute',
                    top: r * 28,
                    left: colLefts[c],
                    width: getColWidth(sheet, c),
                    height: 28,
                    ...getCellStyle(cell?.format),
                    ...(cfResult?.style || {}),
                    ...((isFrozenRow || isFrozenCol) ? {
                      position: 'sticky' as const,
                      zIndex: (isFrozenRow && isFrozenCol) ? 4 : 2,
                      ...(isFrozenRow ? { top: r * 28 } : {}),
                      ...(isFrozenCol ? { left: colLefts[c] } : {}),
                    } : {}),
                  };

                  if (isActive && editing) {
                    // Check if this cell has list validation for dropdown
                    const listRule = sheet.validationRules.find(vr => vr.rule.type === 'list' && isCellInRange(c, r, vr.range));
                    if (listRule && listRule.rule.listItems) {
                      return (
                        <select
                          key={id}
                          className="sheet-cell-input sheet-cell-dropdown"
                          style={style}
                          value={editValue}
                          onChange={e => {
                            setEditValue(e.target.value);
                            setFormulaBarValue(e.target.value);
                            commitEdit(e.target.value);
                          }}
                          onBlur={() => commitEdit()}
                          autoFocus
                        >
                          <option value="">—</option>
                          {listRule.rule.listItems.map(item => (
                            <option key={item} value={item}>{item}</option>
                          ))}
                        </select>
                      );
                    }
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
                      className={`sheet-cell ${valError ? 'sheet-cell-invalid' : ''}`}
                      style={style}
                      onClick={e => handleCellClick(r, c, e)}
                      onDoubleClick={() => handleCellDoubleClick()}
                      title={valError || undefined}
                    >
                      {cfResult?.dataBarWidth !== undefined && (
                        <div
                          className="sheet-data-bar"
                          style={{
                            width: `${cfResult.dataBarWidth}%`,
                            backgroundColor: sheet.conditionalFormats.find(cf => cf.type === 'dataBars' && isCellInRange(c, r, cf.range))?.dataBarColor || '#4285f4',
                          }}
                        />
                      )}
                      {cfResult?.icon && <span className="sheet-cf-icon">{cfResult.icon}</span>}
                      <span className="sheet-cell-text">{display}</span>
                      {hasListValidation && <span className="sheet-dropdown-arrow">▾</span>}
                      {valError && <span className="sheet-validation-indicator" />}
                    </div>
                  );
                });
              }).flat()}

              {/* Chart overlays */}
              {sheet.charts.map(chart => (
                <SheetChartOverlay
                  key={chart.id}
                  chart={chart}
                  sheet={sheet}
                  onMove={handleChartMove}
                  onResize={handleChartResize}
                  onDelete={handleChartDelete}
                />
              ))}
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

      {/* Context menu */}
      {contextMenu && (
        <div
          className="sheet-context-menu"
          style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, background: '#fff', border: '1px solid #ccc', borderRadius: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', zIndex: 1000, padding: '4px 0', minWidth: 160 }}
          onClick={e => e.stopPropagation()}
        >
          {contextMenu.type === 'col' && (
            <>
              <div className="sheet-ctx-item" style={{ padding: '6px 16px', cursor: 'pointer' }} onClick={() => sortByColumn(contextMenu.index, true)}>Sort A → Z</div>
              <div className="sheet-ctx-item" style={{ padding: '6px 16px', cursor: 'pointer' }} onClick={() => sortByColumn(contextMenu.index, false)}>Sort Z → A</div>
              <div style={{ borderTop: '1px solid #eee', margin: '4px 0' }} />
              <div className="sheet-ctx-item" style={{ padding: '6px 16px', cursor: 'pointer' }} onClick={() => handleFreezeUpToCol(contextMenu.index)}>Freeze up to this column</div>
            </>
          )}
          {contextMenu.type === 'row' && (
            <>
              <div className="sheet-ctx-item" style={{ padding: '6px 16px', cursor: 'pointer' }} onClick={() => handleFreezeUpToRow(contextMenu.index)}>Freeze up to this row</div>
            </>
          )}
        </div>
      )}

      {/* Filter dropdown */}
      {filterDropdown && (
        <FilterDropdownMenu
          col={filterDropdown.col}
          x={filterDropdown.x}
          y={filterDropdown.y}
          uniqueValues={getUniqueValues(filterDropdown.col)}
          currentFilter={sheet.filters.find(f => f.column === filterDropdown.col)}
          onApply={applyFilter}
          onClose={() => setFilterDropdown(null)}
        />
      )}

      {/* Chart dialog */}
      {showChartDialog && (
        <InsertChartDialog
          onInsert={handleInsertChart}
          onClose={() => setShowChartDialog(false)}
        />
      )}

      {showCFDialog && (
        <ConditionalFormatDialog
          existingRules={sheet.conditionalFormats}
          selectedRange={selectedRangeStr}
          onSave={(rules: ConditionalRule[]) => {
            sheet.conditionalFormats = rules;
            setShowCFDialog(false);
            setWorkbook({ ...workbook });
          }}
          onClose={() => setShowCFDialog(false)}
        />
      )}

      {showDVDialog && (
        <DataValidationDialog
          existingRules={sheet.validationRules}
          selectedRange={selectedRangeStr}
          onSave={(rules: ValidationRule[]) => {
            sheet.validationRules = rules;
            setShowDVDialog(false);
            setWorkbook({ ...workbook });
          }}
          onClose={() => setShowDVDialog(false)}
        />
      )}
    </div>
  );
}

// Filter matching
function matchesFilter(val: string, filter: FilterState): boolean {
  if (filter.mode === 'all') return true;
  if (filter.mode === 'values' && filter.selectedValues) return filter.selectedValues.has(val);
  if (filter.mode === 'contains') return val.toLowerCase().includes((filter.value || '').toLowerCase());
  if (filter.mode === 'equals') return val === (filter.value || '');
  if (filter.mode === 'gt') return (parseFloat(val) || 0) > parseFloat(filter.value || '0');
  if (filter.mode === 'lt') return (parseFloat(val) || 0) < parseFloat(filter.value || '0');
  return true;
}

// Filter dropdown component
function FilterDropdownMenu({ col, x, y, uniqueValues, currentFilter, onApply, onClose }: {
  col: number; x: number; y: number;
  uniqueValues: string[];
  currentFilter?: FilterState;
  onApply: (col: number, mode: FilterState['mode'], value?: string, selectedValues?: Set<string>) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<FilterState['mode']>(currentFilter?.mode || 'all');
  const [value, setValue] = useState(currentFilter?.value || '');
  const [selected, setSelected] = useState<Set<string>>(currentFilter?.selectedValues || new Set(uniqueValues));

  return (
    <div
      style={{ position: 'fixed', left: x, top: y, background: '#fff', border: '1px solid #ccc', borderRadius: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', zIndex: 1000, padding: 12, minWidth: 200, maxHeight: 350, overflowY: 'auto' }}
      onClick={e => e.stopPropagation()}
    >
      <div style={{ marginBottom: 8, fontWeight: 'bold', fontSize: 12 }}>Filter Column {indexToCol(col)}</div>
      <select value={mode} onChange={e => setMode(e.target.value as FilterState['mode'])} style={{ width: '100%', marginBottom: 8 }}>
        <option value="all">Show All</option>
        <option value="values">By Values</option>
        <option value="contains">Text Contains</option>
        <option value="equals">Equals</option>
        <option value="gt">Greater Than</option>
        <option value="lt">Less Than</option>
      </select>
      {(mode === 'contains' || mode === 'equals' || mode === 'gt' || mode === 'lt') && (
        <input value={value} onChange={e => setValue(e.target.value)} placeholder="Value..." style={{ width: '100%', marginBottom: 8, boxSizing: 'border-box' }} />
      )}
      {mode === 'values' && (
        <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid #eee', padding: 4, marginBottom: 8 }}>
          <label style={{ display: 'block', marginBottom: 2, fontSize: 11 }}>
            <input type="checkbox" checked={selected.size === uniqueValues.length} onChange={e => setSelected(e.target.checked ? new Set(uniqueValues) : new Set())} /> (Select All)
          </label>
          {uniqueValues.map(v => (
            <label key={v} style={{ display: 'block', marginBottom: 1, fontSize: 11 }}>
              <input type="checkbox" checked={selected.has(v)} onChange={e => {
                const ns = new Set(selected);
                e.target.checked ? ns.add(v) : ns.delete(v);
                setSelected(ns);
              }} /> {v || '(empty)'}
            </label>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={{ fontSize: 12 }}>Cancel</button>
        <button
          onClick={() => onApply(col, mode, value, mode === 'values' ? selected : undefined)}
          style={{ fontSize: 12, background: '#4285F4', color: '#fff', border: 'none', padding: '4px 12px', borderRadius: 3, cursor: 'pointer' }}
        >Apply</button>
      </div>
    </div>
  );
}
