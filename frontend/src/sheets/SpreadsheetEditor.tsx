import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { CellFormat, getCellStyle, formatCellValue } from './cellFormat';
import { cellId, indexToCol, extractRefs, parseCellRef, expandRange } from './formulaEngine';
import { solveEquation, formatResult as formatMathResult, extractVariables } from '../utils/mathSolver';
import { WorkbookData, CellData, createWorkbook, createEmptySheet, getColWidth, getRowHeight, recalculate, buildDependencyGraph, recalcAll, UndoManager, serializeWorkbook, deserializeWorkbook, ChartConfig, FilterState, FreezePanes } from './sheetModel';
import { DependencyGraph } from './formulaEngine';
import { detectPattern, generateFill, adjustFormula, parseFormulaRefs, measureTextWidth, FormulaRef } from './fillLogic';
import FormulaBar from './FormulaBar';
import SheetToolbar from './SheetToolbar';
import SheetTabs from './SheetTabs';
import { SheetChartOverlay, InsertChartDialog } from './SheetChart';
import SheetShortcuts from './SheetShortcuts';
import { exportCSV, importCSV, exportXLSX, importXLSX, downloadBlob, downloadString } from './sheetIO';
import ConditionalFormatDialog from './ConditionalFormat';
import DataValidationDialog from './DataValidation';
import { evaluateConditionalFormats, getNumericValuesInRange, isCellInRange, validateCell } from './conditionalEval';
import type { ConditionalRule, ValidationRule } from './conditionalEval';
import PivotTableDialog from './PivotTable';
import NamedRangesDialog from './NamedRanges';
import SheetComments, { CommentTooltip } from './SheetComments';
import Sparkline, { isSparklineValue, parseSparklineValue, SparklineData } from './Sparkline';
import CellMiniChart from './CellMiniChart';
import SparklineDialog from './SparklineDialog';
import ProtectedRanges from './ProtectedRanges';
import SheetFindReplace from './SheetFindReplace';
import GoalSeekDialog, { goalSeek } from './GoalSeek';
import DataTableDialog, { computeDataTable, DataTableConfig } from './DataTable';
import SolverDialog, { solve, SolverConfig } from './Solver';
import DataImportDialog from './DataImport';
import FrequencyAnalysisDialog from './FrequencyAnalysis';
import type { FindMatch } from './SheetFindReplace';
import { getFindMatchCellIds } from './SheetFindReplace';
import type { CellComment, ProtectedRange } from './sheetModel';
import { PivotConfig } from './pivotEngine';
import { PivotChartButton } from './PivotChart';
import { SlicerOverlay, InsertSlicerDialog, SlicerConfig } from './Slicer';
import { DashboardToolbar, DashboardLabelOverlay, DashboardPresentation, DashboardConfig, DashboardLabel, createDashboardConfig } from './Dashboard';
import { HeatmapLegend, CreateHeatmapDialog, HeatmapConfig, computeHeatmapColors } from './Heatmap';
import { TimelineOverlay, InsertTimelineDialog, TimelineConfig } from './SheetTimeline';
import SheetPrintSetup, { defaultPrintSettings } from './SheetPrintSetup';
import SheetPrintPreview from './SheetPrintPreview';
import {
  initSheetCollab,
  setCellInYjs,
  syncWorkbookFromYjs,
  setLocalCursor,
  type RemoteCursor,
  type SheetCollabHandle,
  type CellChangeCallback,
} from './sheetCollab';
import { COLLAB_COLORS } from '../utils/collabColors';
import SheetStatusBar from './SheetStatusBar';
import './sheets-styles.css';

const NUM_COLS = 26;
const NUM_ROWS = 100;
const ROW_HEADER_WIDTH = 50;
const OVERSCAN = 5;

interface SpreadsheetEditorProps {
  initialData?: string;
  onSave?: (data: string) => void;
  /** Enable real-time Yjs collaboration */
  enableCollaboration?: boolean;
  /** Document name used as the collab room id */
  documentName?: string;
  /** Hocuspocus WebSocket URL */
  collaborationServerUrl?: string;
  /** Current user display name */
  userName?: string;
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

export default function SpreadsheetEditor({
  initialData,
  onSave,
  enableCollaboration = false,
  documentName,
  collaborationServerUrl = 'ws://localhost:1234',
  userName = 'Anonymous',
}: SpreadsheetEditorProps) {
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
  const [showPivotDialog, setShowPivotDialog] = useState(false);
  const [showNamedRangesDialog, setShowNamedRangesDialog] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [fillDrag, setFillDrag] = useState<{ startRow: number; startCol: number; endRow: number; endCol: number; active: boolean } | null>(null);
  const [formulaHighlights, setFormulaHighlights] = useState<FormulaRef[]>([]);

  // Comments state
  const [commentPanel, setCommentPanel] = useState<{ cellId: string; rect: { top: number; left: number; width: number; height: number } } | null>(null);
  const [hoveredComment, setHoveredComment] = useState<{ cellId: string; comment: CellComment; x: number; y: number } | null>(null);

  // Protected ranges
  const [showProtectedRangesDialog, setShowProtectedRangesDialog] = useState(false);
  const [protectedToast, setProtectedToast] = useState<string | null>(null);

  // Find & Replace
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findReplaceMode, setFindReplaceMode] = useState(false);
  const [findMatches, setFindMatches] = useState<FindMatch[]>([]);
  const [showSparklineDialog, setShowSparklineDialog] = useState(false);
  const [hoveredSparkline, setHoveredSparkline] = useState<{ data: SparklineData; x: number; y: number } | null>(null);
  const [latexFormulaMode, setLatexFormulaMode] = useState<'equation' | 'result'>('equation');
  const [showGoalSeek, setShowGoalSeek] = useState(false);
  const [showDataTable, setShowDataTable] = useState(false);
  const [showSolver, setShowSolver] = useState(false);
  const [showDataImport, setShowDataImport] = useState(false);
  const [showFreqAnalysis, setShowFreqAnalysis] = useState(false);
  const [slicers, setSlicers] = useState<SlicerConfig[]>([]);
  const [showSlicerDialog, setShowSlicerDialog] = useState(false);
  const [dashboardConfig, setDashboardConfig] = useState<DashboardConfig>(createDashboardConfig());
  const [showPresentation, setShowPresentation] = useState(false);
  const [heatmaps, setHeatmaps] = useState<HeatmapConfig[]>([]);
  const [showHeatmapDialog, setShowHeatmapDialog] = useState(false);
  const [timelines, setTimelines] = useState<TimelineConfig[]>([]);
  const [showTimelineDialog, setShowTimelineDialog] = useState(false);
  const [showPrintSetup, setShowPrintSetup] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [printSettings, setPrintSettings] = useState(() => defaultPrintSettings);
  const [manualPageBreaks, setManualPageBreaks] = useState<number[]>([]);
  // Listen for latex-formula-mode toggle
  useEffect(() => {
    const handler = () => setLatexFormulaMode(m => m === 'equation' ? 'result' : 'equation');
    window.addEventListener('latex-formula-mode-toggle', handler);
    return () => window.removeEventListener('latex-formula-mode-toggle', handler);
  }, []);

  // Collaboration state
  const [remoteCursors, setRemoteCursors] = useState<RemoteCursor[]>([]);
  const [collabStatus, setCollabStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const collabRef = useRef<SheetCollabHandle | null>(null);
  const suppressRemoteRef = useRef(false);

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
  if (!workbook.namedRanges) workbook.namedRanges = {};
  if (!workbook.pivotTables) workbook.pivotTables = [];
  if (!sheet.protectedRanges) sheet.protectedRanges = [];

  // Build dep graph on mount / sheet change
  useEffect(() => {
    graphRef.current = buildDependencyGraph(sheet);
    recalcAll(sheet, graphRef.current, workbook.namedRanges);
    triggerUpdate();
  }, [workbook.activeSheet]);

  const [, setTick] = useState(0);
  const triggerUpdate = useCallback(() => setTick(t => t + 1), []);

  // ── Collaboration setup ───────────────────────────────────────────────
  useEffect(() => {
    if (!enableCollaboration || !documentName) return;

    const onCellsChanged: CellChangeCallback = (sheetIndex, changes) => {
      if (suppressRemoteRef.current) return;
      const s = workbook.sheets[sheetIndex];
      if (!s) return;
      changes.forEach((cell, key) => {
        if (cell) {
          s.cells[key] = cell;
        } else {
          delete s.cells[key];
        }
      });
      graphRef.current = buildDependencyGraph(s);
      recalcAll(s, graphRef.current, workbook.namedRanges);
      setWorkbook(wb => ({ ...wb }));
    };

    const onMetaChanged = (sheetIndex: number) => {
      if (suppressRemoteRef.current) return;
      // Re-read meta from Yjs
      const handle = collabRef.current;
      if (!handle) return;
      const freshWb = syncWorkbookFromYjs(handle.ydoc);
      const freshSheet = freshWb.sheets[sheetIndex];
      if (freshSheet && workbook.sheets[sheetIndex]) {
        const s = workbook.sheets[sheetIndex];
        s.name = freshSheet.name;
        s.colWidths = freshSheet.colWidths;
        s.rowHeights = freshSheet.rowHeights;
        s.merges = freshSheet.merges;
        s.freeze = freshSheet.freeze;
        setWorkbook(wb => ({ ...wb }));
      }
    };

    const handle = initSheetCollab(
      documentName,
      collaborationServerUrl,
      userName,
      workbook,
      onCellsChanged,
      onMetaChanged,
      setRemoteCursors,
    );
    collabRef.current = handle;

    // Track connection status
    handle.provider.on('status', ({ status }: { status: string }) => {
      setCollabStatus(status as any);
    });

    return () => {
      handle.destroy();
      collabRef.current = null;
      setCollabStatus('disconnected');
      setRemoteCursors([]);
    };
  }, [enableCollaboration, documentName, collaborationServerUrl, userName]);

  // Broadcast local cursor position via awareness
  useEffect(() => {
    if (!enableCollaboration || !collabRef.current) return;
    const cellRef = cellId(activeCell.col, activeCell.row);
    const rangeStr = selection.startRow !== selection.endRow || selection.startCol !== selection.endCol
      ? `${cellId(Math.min(selection.startCol, selection.endCol), Math.min(selection.startRow, selection.endRow))}:${cellId(Math.max(selection.startCol, selection.endCol), Math.max(selection.startRow, selection.endRow))}`
      : null;
    setLocalCursor(collabRef.current.provider, userName, cellRef, rangeStr, workbook.activeSheet);
  }, [activeCell, selection, workbook.activeSheet, enableCollaboration, userName]);

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

  // ── Protected range check ───────────────────────────────────────────
  const isCellProtected = useCallback((row: number, col: number): boolean => {
    if (!sheet.protectedRanges || sheet.protectedRanges.length === 0) return false;
    for (const pr of sheet.protectedRanges) {
      if (!pr.locked) continue;
      if (isCellInRange(col, row, pr.range)) return true;
    }
    return false;
  }, [sheet]);

  // ── Comment handlers ──────────────────────────────────────────────────
  const handleAddComment = useCallback((cId: string, text: string) => {
    if (!sheet.cells[cId]) sheet.cells[cId] = { value: '' };
    sheet.cells[cId].comment = {
      author: userName || 'You',
      text,
      timestamp: Date.now(),
      replies: [],
    };
    setCommentPanel(null);
    setWorkbook({ ...workbook });
  }, [sheet, workbook, userName]);

  const handleReplyComment = useCallback((cId: string, text: string) => {
    const cell = sheet.cells[cId];
    if (!cell?.comment) return;
    cell.comment.replies.push({ author: userName || 'You', text, timestamp: Date.now() });
    setWorkbook({ ...workbook });
  }, [sheet, workbook, userName]);

  const handleResolveComment = useCallback((cId: string) => {
    const cell = sheet.cells[cId];
    if (cell) delete cell.comment;
    setCommentPanel(null);
    setWorkbook({ ...workbook });
  }, [sheet, workbook]);

  const handleDeleteComment = useCallback((cId: string) => {
    const cell = sheet.cells[cId];
    if (cell) delete cell.comment;
    setCommentPanel(null);
    setWorkbook({ ...workbook });
  }, [sheet, workbook]);

  const handleDeleteReply = useCallback((cId: string, idx: number) => {
    const cell = sheet.cells[cId];
    if (cell?.comment) {
      cell.comment.replies.splice(idx, 1);
      setWorkbook({ ...workbook });
    }
  }, [sheet, workbook]);

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

    // Check protected range
    if (isCellProtected(activeCell.row, activeCell.col)) {
      setEditing(false);
      setProtectedToast('This cell is in a protected range and cannot be edited.');
      setTimeout(() => setProtectedToast(null), 3000);
      return;
    }

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
          recalculate(sheet, graphRef.current, id, workbook.namedRanges);
        }
      } else {
        graphRef.current.removeDependencies(id);
        recalculate(sheet, graphRef.current, id, workbook.namedRanges);
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

    // Broadcast cell change to Yjs
    if (enableCollaboration && collabRef.current) {
      suppressRemoteRef.current = true;
      setCellInYjs(collabRef.current.ydoc, workbook.activeSheet, id, sheet.cells[id] ?? undefined);
      suppressRemoteRef.current = false;
    }

    setWorkbook({ ...workbook });
  }, [editValue, activeCell, sheet, workbook, validationErrors, enableCollaboration]);

  const startEdit = useCallback((initialChar?: string) => {
    if (isCellProtected(activeCell.row, activeCell.col)) {
      setProtectedToast('This cell is in a protected range and cannot be edited.');
      setTimeout(() => setProtectedToast(null), 3000);
      return;
    }
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
      setFormulaHighlights([]);
    }
  }, [activeCell, editing, getCellRaw]);

  // Update formula highlights in real-time while editing
  useEffect(() => {
    if (editing && editValue.startsWith('=')) {
      setFormulaHighlights(parseFormulaRefs(editValue));
    } else {
      setFormulaHighlights([]);
    }
  }, [editing, editValue]);

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
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
          e.preventDefault();
          setFindReplaceMode(false);
          setShowFindReplace(true);
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
          e.preventDefault();
          setFindReplaceMode(true);
          setShowFindReplace(true);
        }
        if ((e.ctrlKey || e.metaKey) && e.key === '/') {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('sheet-shortcuts-toggle'));
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            if (undoRef.current.canRedo()) {
              undoRef.current.redo(workbook);
              recalcAll(sheet, graphRef.current, workbook.namedRanges);
              setWorkbook({ ...workbook });
            }
          } else {
            if (undoRef.current.canUndo()) {
              undoRef.current.undo(workbook);
              recalcAll(sheet, graphRef.current, workbook.namedRanges);
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

  const openCommentPanel = useCallback((row: number, col: number) => {
    const id = cellId(col, row);
    const top = row * 28;
    const left = colLefts[col] ?? 0;
    const width = getColWidth(sheet, col);
    setCommentPanel({ cellId: id, rect: { top, left, width, height: 28 } });
  }, [colLefts, sheet]);

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

  const selectedNumericValues = useMemo(() => {
    const values: number[] = [];
    for (let r = selRange.minRow; r <= selRange.maxRow; r++) {
      for (let c = selRange.minCol; c <= selRange.maxCol; c++) {
        const id = cellId(c, r);
        const cell = sheet.cells[id];
        if (cell) {
          const v = cell.computed !== undefined ? cell.computed : cell.value;
          const n = typeof v === 'number' ? v : parseFloat(String(v));
          if (!isNaN(n)) values.push(n);
        }
      }
    }
    return values;
  }, [selRange, sheet.cells]);

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
    // Broadcast format changes to Yjs
    if (enableCollaboration && collabRef.current) {
      suppressRemoteRef.current = true;
      for (const e of entries) {
        if (e.after) setCellInYjs(collabRef.current.ydoc, e.sheetIndex, e.cellId, e.after);
      }
      suppressRemoteRef.current = false;
    }
    setWorkbook({ ...workbook });
  }, [selRange, sheet, workbook, enableCollaboration]);

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

  // Formatting & clipboard keyboard shortcuts (defined after selRange/currentFormat/handleFormatChange)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === 'b') { e.preventDefault(); handleFormatChange({ bold: !currentFormat.bold }); }
      else if (e.key === 'i') { e.preventDefault(); handleFormatChange({ italic: !currentFormat.italic }); }
      else if (e.key === 'u') { e.preventDefault(); handleFormatChange({ underline: !currentFormat.underline }); }
      else if (e.key === 'c' && !e.shiftKey) {
        const rows: string[] = [];
        for (let r = selRange.minRow; r <= selRange.maxRow; r++) {
          const cols: string[] = [];
          for (let c = selRange.minCol; c <= selRange.maxCol; c++) cols.push(getCellDisplay(cellId(c, r)));
          rows.push(cols.join('\t'));
        }
        navigator.clipboard.writeText(rows.join('\n')).catch(() => {});
      }
      else if (e.key === 'x') {
        const rows: string[] = [];
        for (let r = selRange.minRow; r <= selRange.maxRow; r++) {
          const cols: string[] = [];
          for (let c = selRange.minCol; c <= selRange.maxCol; c++) cols.push(getCellDisplay(cellId(c, r)));
          rows.push(cols.join('\t'));
        }
        navigator.clipboard.writeText(rows.join('\n')).catch(() => {});
        for (let r = selRange.minRow; r <= selRange.maxRow; r++) {
          for (let c = selRange.minCol; c <= selRange.maxCol; c++) {
            const id = cellId(c, r);
            if (sheet.cells[id]) sheet.cells[id] = { ...sheet.cells[id], value: '', formula: undefined, computed: undefined };
          }
        }
        recalcAll(sheet, graphRef.current, workbook.namedRanges);
        setWorkbook({ ...workbook });
      }
      else if (e.key === 'v') {
        e.preventDefault();
        navigator.clipboard.readText().then(text => {
          const rows = text.split('\n').map(r => r.split('\t'));
          const entries: import('./sheetModel').UndoEntry[] = [];
          rows.forEach((cols, ri) => {
            cols.forEach((val, ci) => {
              const r = activeCell.row + ri;
              const c = activeCell.col + ci;
              const id = cellId(c, r);
              const old = sheet.cells[id] ? { ...sheet.cells[id] } : undefined;
              sheet.cells[id] = { ...(sheet.cells[id] || {}), value: val, formula: undefined };
              entries.push({ sheetIndex: workbook.activeSheet, cellId: id, before: old, after: { ...sheet.cells[id] } });
            });
          });
          if (entries.length) undoRef.current.push(entries);
          recalcAll(sheet, graphRef.current, workbook.namedRanges);
          setWorkbook({ ...workbook });
        }).catch(() => {});
      }
    };
    const el = document.querySelector('.spreadsheet-editor');
    el?.addEventListener('keydown', handler as EventListener);
    return () => { el?.removeEventListener('keydown', handler as EventListener); };
  }, [currentFormat, handleFormatChange, selRange, getCellDisplay, activeCell, sheet, workbook]);

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
      if (display) {
        const w = measureTextWidth(display) + 20; // padding
        maxW = Math.max(maxW, w);
      }
    }
    sheet.colWidths[col] = Math.min(400, Math.ceil(maxW));
    setWorkbook({ ...workbook });
  }, [sheet, workbook, getCellDisplay]);

  // Auto-fit row height on double-click row border
  const handleRowHeaderDoubleClick = useCallback((row: number) => {
    let maxH = 28;
    for (let c = 0; c < NUM_COLS; c++) {
      const id = cellId(c, row);
      const display = getCellDisplay(id);
      if (display) {
        const colW = getColWidth(sheet, c);
        const textW = measureTextWidth(display);
        const lines = Math.max(1, Math.ceil(textW / (colW - 8)));
        maxH = Math.max(maxH, lines * 20 + 8);
      }
    }
    sheet.rowHeights[row] = Math.ceil(maxH);
    setWorkbook({ ...workbook });
  }, [sheet, workbook, getCellDisplay]);

  // Fill handle drag handlers
  const handleFillMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFillDrag({
      startRow: selRange.minRow,
      startCol: selRange.minCol,
      endRow: selRange.maxRow,
      endCol: selRange.maxCol,
      active: true,
    });
  }, [selRange]);

  // Listen for mousemove/mouseup during fill drag
  useEffect(() => {
    if (!fillDrag?.active) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left + containerRef.current.scrollLeft;
      const y = e.clientY - rect.top + containerRef.current.scrollTop;

      // Determine which cell the mouse is over
      let col = 0;
      let accX = 0;
      for (let c = 0; c < NUM_COLS; c++) {
        const w = getColWidth(sheet, c);
        if (accX + w > x) { col = c; break; }
        accX += w;
        col = c;
      }
      const row = Math.max(0, Math.min(NUM_ROWS - 1, Math.floor(y / 28)));

      // Only extend in one direction (the dominant axis)
      const rowDist = Math.abs(row - fillDrag.endRow);
      const colDist = Math.abs(col - fillDrag.endCol);
      
      if (rowDist >= colDist) {
        // Extend vertically
        setFillDrag(prev => prev ? { ...prev, endRow: Math.max(row, prev.startRow), endCol: prev.startCol + (selRange.maxCol - selRange.minCol) } : null);
      } else {
        // Extend horizontally
        setFillDrag(prev => prev ? { ...prev, endCol: Math.max(col, prev.startCol), endRow: prev.startRow + (selRange.maxRow - selRange.minRow) } : null);
      }
    };

    const handleMouseUp = () => {
      if (!fillDrag) return;
      // Apply fill
      const srcMinRow = selRange.minRow;
      const srcMaxRow = selRange.maxRow;
      const srcMinCol = selRange.minCol;
      const srcMaxCol = selRange.maxCol;

      const fillEndRow = fillDrag.endRow;
      const fillEndCol = fillDrag.endCol;

      // Determine fill direction
      if (fillEndRow > srcMaxRow) {
        // Fill down
        for (let c = srcMinCol; c <= srcMaxCol; c++) {
          const srcValues: string[] = [];
          for (let r = srcMinRow; r <= srcMaxRow; r++) {
            srcValues.push(getCellRaw(cellId(c, r)));
          }
          const pattern = detectPattern(srcValues);
          const count = fillEndRow - srcMaxRow;

          if (pattern.type === 'formula') {
            for (let i = 1; i <= count; i++) {
              const srcFormula = srcValues[(i - 1) % srcValues.length];
              const adjusted = adjustFormula(srcFormula, srcMaxRow - srcMinRow + i, 0);
              const id = cellId(c, srcMaxRow + i);
              sheet.cells[id] = { value: '', formula: adjusted };
            }
          } else {
            const filled = generateFill(pattern, count);
            for (let i = 0; i < filled.length; i++) {
              const id = cellId(c, srcMaxRow + 1 + i);
              sheet.cells[id] = { value: filled[i] };
            }
          }
        }
      } else if (fillEndCol > srcMaxCol) {
        // Fill right
        for (let r = srcMinRow; r <= srcMaxRow; r++) {
          const srcValues: string[] = [];
          for (let c = srcMinCol; c <= srcMaxCol; c++) {
            srcValues.push(getCellRaw(cellId(c, r)));
          }
          const pattern = detectPattern(srcValues);
          const count = fillEndCol - srcMaxCol;

          if (pattern.type === 'formula') {
            for (let i = 1; i <= count; i++) {
              const srcFormula = srcValues[(i - 1) % srcValues.length];
              const adjusted = adjustFormula(srcFormula, 0, srcMaxCol - srcMinCol + i);
              const id = cellId(srcMaxCol + i, r);
              sheet.cells[id] = { value: '', formula: adjusted };
            }
          } else {
            const filled = generateFill(pattern, count);
            for (let i = 0; i < filled.length; i++) {
              const id = cellId(srcMaxCol + 1 + i, r);
              sheet.cells[id] = { value: filled[i] };
            }
          }
        }
      }

      // Recalc
      graphRef.current = buildDependencyGraph(sheet);
      recalcAll(sheet, graphRef.current, workbook.namedRanges);
      setWorkbook({ ...workbook });
      setFillDrag(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [fillDrag, selRange, sheet, workbook, getCellRaw]);

  // Context menu handlers
  // Cell context menu for right-click on cells
  const [cellContextMenu, setCellContextMenu] = useState<{ x: number; y: number; row: number; col: number } | null>(null);

  const handleCellContextMenu = useCallback((row: number, col: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCellContextMenu({ x: e.clientX, y: e.clientY, row, col });
  }, []);

  // Close cell context menu on click
  useEffect(() => {
    const handler = () => setCellContextMenu(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

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
    recalcAll(sheet, graphRef.current, workbook.namedRanges);
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

  // Pivot table creation
  const handleCreatePivot = useCallback((config: PivotConfig, result: { headers: string[]; rows: string[][] }) => {
    // Create a new sheet with pivot results
    const pivotSheet = createEmptySheet(`Pivot_${workbook.sheets.length + 1}`);
    // Write headers
    for (let c = 0; c < result.headers.length; c++) {
      const id = cellId(c, 0);
      pivotSheet.cells[id] = { value: result.headers[c], format: { bold: true } };
    }
    // Write data rows
    for (let r = 0; r < result.rows.length; r++) {
      for (let c = 0; c < result.rows[r].length; c++) {
        const id = cellId(c, r + 1);
        pivotSheet.cells[id] = { value: result.rows[r][c] };
      }
    }
    workbook.sheets.push(pivotSheet);
    workbook.pivotTables.push(config);
    workbook.activeSheet = workbook.sheets.length - 1;
    setShowPivotDialog(false);
    setWorkbook({ ...workbook });
  }, [workbook]);

  // Slicer handlers
  const handleInsertSlicer = useCallback((column: string, sourceRange: string) => {
    const slicer: SlicerConfig = {
      id: `slicer_${Date.now()}`,
      column, sourceRange, sourceSheet: workbook.activeSheet,
      selectedValues: new Set(),
      x: 500, y: 100, width: 200, height: 250,
    };
    setSlicers(s => [...s, slicer]);
    setShowSlicerDialog(false);
  }, [workbook.activeSheet]);

  const handleSlicerSelectionChange = useCallback((id: string, selected: Set<string>) => {
    setSlicers(s => s.map(sl => sl.id === id ? { ...sl, selectedValues: selected } : sl));
  }, []);

  const handleSlicerMove = useCallback((id: string, x: number, y: number) => {
    setSlicers(s => s.map(sl => sl.id === id ? { ...sl, x, y } : sl));
  }, []);

  const handleSlicerResize = useCallback((id: string, w: number, h: number) => {
    setSlicers(s => s.map(sl => sl.id === id ? { ...sl, width: w, height: h } : sl));
  }, []);

  const handleSlicerDelete = useCallback((id: string) => {
    setSlicers(s => s.filter(sl => sl.id !== id));
  }, []);

  // Dashboard handlers
  const handleToggleDashboard = useCallback(() => {
    setDashboardConfig(c => ({ ...c, enabled: !c.enabled }));
  }, []);

  const handleAddDashboardLabel = useCallback(() => {
    const label: DashboardLabel = {
      id: `label_${Date.now()}`, text: 'Title', x: 200, y: 50,
      fontSize: 18, color: '#333', bold: true,
    };
    setDashboardConfig(c => ({ ...c, labels: [...c.labels, label] }));
  }, []);

  const handleUpdateDashboardLabel = useCallback((id: string, updates: Partial<DashboardLabel>) => {
    setDashboardConfig(c => ({ ...c, labels: c.labels.map(l => l.id === id ? { ...l, ...updates } : l) }));
  }, []);

  const handleDeleteDashboardLabel = useCallback((id: string) => {
    setDashboardConfig(c => ({ ...c, labels: c.labels.filter(l => l.id !== id) }));
  }, []);

  // Heatmap handlers
  const handleInsertHeatmap = useCallback((config: Omit<HeatmapConfig, 'id'>) => {
    setHeatmaps(h => [...h, { ...config, id: `heatmap_${Date.now()}` }]);
    setShowHeatmapDialog(false);
  }, []);

  const handleDeleteHeatmap = useCallback((id: string) => {
    setHeatmaps(h => h.filter(hm => hm.id !== id));
  }, []);

  // Compute heatmap colors for cell rendering
  const heatmapColorMap = useMemo(() => {
    const combined = new Map<string, string>();
    for (const hm of heatmaps) {
      const colors = computeHeatmapColors(sheet, hm);
      colors.forEach((v, k) => combined.set(k, v));
    }
    return combined;
  }, [heatmaps, sheet]);

  // Timeline handlers
  const handleInsertTimeline = useCallback((config: Omit<TimelineConfig, 'id' | 'x' | 'y' | 'width' | 'height'>) => {
    setTimelines(t => [...t, { ...config, id: `timeline_${Date.now()}`, x: 50, y: 100, width: 600, height: 300 }]);
    setShowTimelineDialog(false);
  }, []);

  const handleTimelineMove = useCallback((id: string, x: number, y: number) => {
    setTimelines(t => t.map(tl => tl.id === id ? { ...tl, x, y } : tl));
  }, []);

  const handleTimelineResize = useCallback((id: string, w: number, h: number) => {
    setTimelines(t => t.map(tl => tl.id === id ? { ...tl, width: w, height: h } : tl));
  }, []);

  const handleTimelineDelete = useCallback((id: string) => {
    setTimelines(t => t.filter(tl => tl.id !== id));
  }, []);

  // Named ranges
  const handleSaveNamedRanges = useCallback((ranges: Record<string, string>) => {
    workbook.namedRanges = ranges;
    setShowNamedRangesDialog(false);
    // Recalc all sheets since named ranges are workbook-level
    recalcAll(sheet, graphRef.current, workbook.namedRanges);
    setWorkbook({ ...workbook });
  }, [workbook, sheet]);

  // Find & Replace handlers
  const handleFindNavigate = useCallback((sheetIndex: number, row: number, col: number) => {
    if (sheetIndex !== workbook.activeSheet) {
      workbook.activeSheet = sheetIndex;
    }
    setActiveCell({ row, col });
    setSelection({ startRow: row, startCol: col, endRow: row, endCol: col });
    setWorkbook({ ...workbook });
  }, [workbook]);

  const handleFindReplace = useCallback((sheetIndex: number, cId: string, _oldVal: string, newVal: string) => {
    const s = workbook.sheets[sheetIndex];
    if (!s.cells[cId]) s.cells[cId] = { value: '' };
    if (s.cells[cId].formula) {
      // Don't replace in formula cells
      return;
    }
    s.cells[cId].value = newVal;
    graphRef.current = buildDependencyGraph(s);
    recalcAll(s, graphRef.current, workbook.namedRanges);
    setWorkbook({ ...workbook });
  }, [workbook]);

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
      recalcAll(imported, graphRef.current, workbook.namedRanges);
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
    recalcAll(workbook.sheets[workbook.activeSheet], graphRef.current, workbook.namedRanges);
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
  // Find match highlights
  const findMatchSet = useMemo(() => getFindMatchCellIds(findMatches, workbook.activeSheet), [findMatches, workbook.activeSheet]);

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
        onUndo={() => { undoRef.current.undo(workbook); recalcAll(sheet, graphRef.current, workbook.namedRanges); setWorkbook({ ...workbook }); }}
        onRedo={() => { undoRef.current.redo(workbook); recalcAll(sheet, graphRef.current, workbook.namedRanges); setWorkbook({ ...workbook }); }}
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
        onPivotTable={() => setShowPivotDialog(true)}
        onNamedRanges={() => setShowNamedRangesDialog(true)}
        onInsertComment={() => openCommentPanel(activeCell.row, activeCell.col)}
        onProtectedRanges={() => setShowProtectedRangesDialog(true)}
        onFindReplace={() => { setFindReplaceMode(false); setShowFindReplace(true); }}
        onInsertSparkline={() => setShowSparklineDialog(true)}
        onGoalSeek={() => setShowGoalSeek(true)}
        onDataTable={() => setShowDataTable(true)}
        onSolver={() => setShowSolver(true)}
        onDataImport={() => setShowDataImport(true)}
        onFrequencyAnalysis={() => setShowFreqAnalysis(true)}
        onSlicer={() => setShowSlicerDialog(true)}
        onHeatmap={() => setShowHeatmapDialog(true)}
        onTimeline={() => setShowTimelineDialog(true)}
        onDashboardToggle={handleToggleDashboard}
        dashboardEnabled={dashboardConfig.enabled}
        pivotChartButton={<PivotChartButton workbook={workbook} onInsertChart={handleInsertChart} />}
        onPrint={() => setShowPrintPreview(true)}
        onPageSetup={() => setShowPrintSetup(true)}
      />
      {enableCollaboration && (
        <div className="sheet-collab-bar">
          <span className={`sheet-collab-status-dot ${collabStatus}`} />
          {collabStatus === 'connected'
            ? `Connected · ${remoteCursors.length + 1} user${remoteCursors.length !== 0 ? 's' : ''}`
            : collabStatus === 'connecting' ? 'Connecting…' : 'Disconnected'}
        </div>
      )}
      <FormulaBar
        cellRef={cellId(activeCell.col, activeCell.row)}
        value={formulaBarValue}
        onChange={handleFormulaBarChange}
        onCommit={() => { if (editing) commitEdit(formulaBarValue); }}
        onCancel={() => {
          setEditing(false);
          setFormulaBarValue(getCellRaw(cellId(activeCell.col, activeCell.row)));
        }}
        formulaRefs={formulaHighlights}
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
                  <div
                    className="sheet-row-resize-handle"
                    onDoubleClick={(e) => { e.stopPropagation(); handleRowHeaderDoubleClick(r); }}
                  />
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

              {/* Fill handle — bottom-right corner of selection */}
              {!editing && !fillDrag && (
                <div
                  className="sheet-fill-handle"
                  style={{
                    top: (selRange.maxRow + 1) * 28 - 5,
                    left: colLefts[selRange.maxCol] + getColWidth(sheet, selRange.maxCol) - 5,
                  }}
                  onMouseDown={handleFillMouseDown}
                />
              )}

              {/* Fill preview while dragging */}
              {fillDrag && fillDrag.active && (fillDrag.endRow > selRange.maxRow || fillDrag.endCol > selRange.maxCol) && (
                <div
                  className="sheet-fill-preview"
                  style={{
                    top: (selRange.maxRow + 1) * 28,
                    left: fillDrag.endCol > selRange.maxCol
                      ? colLefts[selRange.maxCol + 1] ?? (colLefts[selRange.maxCol] + getColWidth(sheet, selRange.maxCol))
                      : colLefts[selRange.minCol],
                    width: fillDrag.endCol > selRange.maxCol
                      ? (() => { let w = 0; for (let c = selRange.maxCol + 1; c <= fillDrag.endCol; c++) w += getColWidth(sheet, c); return w; })()
                      : (() => { let w = 0; for (let c = selRange.minCol; c <= selRange.maxCol; c++) w += getColWidth(sheet, c); return w; })(),
                    height: fillDrag.endRow > selRange.maxRow
                      ? (fillDrag.endRow - selRange.maxRow) * 28
                      : (selRange.maxRow - selRange.minRow + 1) * 28,
                    ...(fillDrag.endCol > selRange.maxCol ? { top: selRange.minRow * 28 } : {}),
                  }}
                />
              )}

              {/* Formula reference highlights */}
              {formulaHighlights.map((ref, i) =>
                ref.cells.map((cell, j) => (
                  <div
                    key={`fh-${i}-${j}`}
                    className="sheet-formula-highlight"
                    style={{
                      top: cell.row * 28,
                      left: colLefts[cell.col] ?? 0,
                      width: getColWidth(sheet, cell.col),
                      height: 28,
                      borderColor: ref.color,
                      backgroundColor: ref.color + '15',
                    }}
                  />
                ))
              )}

              {/* Remote collaboration cursors */}
              {remoteCursors
                .filter(c => c.activeSheet === workbook.activeSheet && c.cell)
                .map(cursor => {
                  const match = cursor.cell!.match(/^([A-Z]+)(\d+)$/);
                  if (!match) return null;
                  const col = match[1].split('').reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1;
                  const row = parseInt(match[2]) - 1;
                  if (col < 0 || col >= NUM_COLS || row < 0 || row >= NUM_ROWS) return null;
                  const colorEntry = COLLAB_COLORS.find(c => c.color === cursor.color);
                  const lightColor = colorEntry?.light || `${cursor.color}18`;
                  return (
                    <div
                      key={`rc-${cursor.clientId}`}
                      className="sheet-remote-cursor"
                      style={{
                        top: row * 28,
                        left: colLefts[col],
                        width: getColWidth(sheet, col),
                        height: 28,
                        ['--cursor-color' as any]: cursor.color,
                        ['--cursor-color-light' as any]: lightColor,
                      }}
                    >
                      <div className="sheet-remote-cursor-label" style={{ background: cursor.color }}>
                        {cursor.name}
                      </div>
                    </div>
                  );
                })}

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
                    ...(heatmapColorMap.has(id) ? { backgroundColor: heatmapColorMap.get(id) } : {}),
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

                  const hasComment = !!cell?.comment;
                  const isProtected = isCellProtected(r, c);
                  const isFindMatch = showFindReplace && findMatchSet.has(id);

                  return (
                    <div
                      key={id}
                      className={`sheet-cell ${valError ? 'sheet-cell-invalid' : ''} ${isProtected ? 'sheet-cell-protected' : ''} ${isFindMatch ? 'sheet-cell-find-match' : ''}`}
                      style={style}
                      onClick={e => handleCellClick(r, c, e)}
                      onDoubleClick={() => handleCellDoubleClick()}
                      onContextMenu={e => handleCellContextMenu(r, c, e)}
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
                      {/* LaTeX cell rendering */}
                      {cell && cell.value && typeof cell.value === 'string' && cell.value.startsWith('$') && cell.value.endsWith('$') && cell.value.length > 2 ? (() => {
                        const latex = cell.value.slice(1, -1);
                        // Build variables from cell references in the expression
                        const vars: Record<string, number> = {};
                        const exprVars = extractVariables(latex);
                        for (const v of exprVars) {
                          // Check if it's a cell ref like A1
                          const ref = parseCellRef(v.toUpperCase());
                          if (ref) {
                            const refId = cellId(ref.col, ref.row);
                            const refCell = sheet.cells[refId];
                            if (refCell) {
                              const n = parseFloat(refCell.computed ?? refCell.value);
                              if (!isNaN(n)) vars[v] = n;
                            }
                          }
                        }
                        const result = solveEquation(latex, vars);
                        if (latexFormulaMode === 'result' && result.result !== null) {
                          return <span className="sheet-cell-text sheet-latex-result">{formatMathResult(result.result)}</span>;
                        }
                        return (
                          <span className="sheet-cell-text sheet-latex-cell">
                            <span className="sheet-latex-expr">{display}</span>
                            {result.result !== null && (
                              <span className="sheet-latex-eval"> = {formatMathResult(result.result)}</span>
                            )}
                            {result.missing.length > 0 && (
                              <span className="sheet-latex-missing" title={`Missing: ${result.missing.join(', ')}`}> ?</span>
                            )}
                          </span>
                        );
                      })() : isSparklineValue(display) ? (() => {
                        const sparkData = parseSparklineValue(display);
                        if (!sparkData) return <span className="sheet-cell-text">{display}</span>;
                        return (
                          <span
                            className="sheet-cell-text"
                            onMouseEnter={e => setHoveredSparkline({ data: sparkData, x: e.clientX + 10, y: e.clientY + 10 })}
                            onMouseLeave={() => setHoveredSparkline(null)}
                          >
                            <Sparkline data={sparkData} width={getColWidth(sheet, c) - 8} height={24} />
                          </span>
                        );
                      })() : (
                        <span className="sheet-cell-text">{display}</span>
                      )}
                      {hasListValidation && <span className="sheet-dropdown-arrow">▾</span>}
                      {valError && <span className="sheet-validation-indicator" />}
                      {hasComment && (
                        <div
                          className="sheet-comment-indicator"
                          onClick={e => { e.stopPropagation(); openCommentPanel(r, c); }}
                          onMouseEnter={e => setHoveredComment({ cellId: id, comment: cell!.comment!, x: e.clientX, y: e.clientY })}
                          onMouseLeave={() => setHoveredComment(null)}
                        />
                      )}
                      {isProtected && <span className="sheet-protected-icon">🔒</span>}
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
              {/* Slicer overlays */}
              {slicers.filter(s => s.sourceSheet === workbook.activeSheet).map(slicer => (
                <SlicerOverlay
                  key={slicer.id}
                  slicer={slicer}
                  sheet={sheet}
                  onSelectionChange={handleSlicerSelectionChange}
                  onMove={handleSlicerMove}
                  onResize={handleSlicerResize}
                  onDelete={handleSlicerDelete}
                />
              ))}
              {/* Timeline overlays */}
              {timelines.filter(t => t.sourceSheet === workbook.activeSheet).map(tl => (
                <TimelineOverlay
                  key={tl.id}
                  config={tl}
                  sheet={sheet}
                  onMove={handleTimelineMove}
                  onResize={handleTimelineResize}
                  onDelete={handleTimelineDelete}
                />
              ))}
              {/* Heatmap legends */}
              {heatmaps.map((hm, i) => {
                const colors = computeHeatmapColors(sheet, hm);
                const values = Array.from(colors.values());
                if (values.length === 0) return null;
                // Compute min/max from the source data
                const refs = hm.range ? expandRange(hm.range) : [];
                const nums = refs.map(r => { const c = sheet.cells[r]; return c ? parseFloat(c.computed ?? c.value) : NaN; }).filter(n => !isNaN(n));
                const min = nums.length ? Math.min(...nums) : 0;
                const max = nums.length ? Math.max(...nums) : 1;
                return hm.showLegend ? (
                  <HeatmapLegend key={hm.id} config={hm} min={min} max={max} x={10} y={10 + i * 60} onDelete={handleDeleteHeatmap} />
                ) : null;
              })}
              {/* Dashboard labels */}
              {dashboardConfig.enabled && dashboardConfig.labels.map(label => (
                <DashboardLabelOverlay
                  key={label.id}
                  label={label}
                  onUpdate={handleUpdateDashboardLabel}
                  onDelete={handleDeleteDashboardLabel}
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

      {showPivotDialog && (
        <PivotTableDialog
          workbook={workbook}
          onClose={() => setShowPivotDialog(false)}
          onCreatePivot={handleCreatePivot}
        />
      )}

      {showNamedRangesDialog && (
        <NamedRangesDialog
          namedRanges={workbook.namedRanges}
          onSave={handleSaveNamedRanges}
          onClose={() => setShowNamedRangesDialog(false)}
        />
      )}

      {showGoalSeek && (
        <GoalSeekDialog
          onClose={() => setShowGoalSeek(false)}
          onRun={(targetCell, targetValue, changingCell) => {
            const graph = buildDependencyGraph(sheet);
            const getCv = (ref: string): number => {
              const cell = sheet.cells[ref];
              if (!cell) return 0;
              const v = cell.computed !== undefined ? cell.computed : cell.value;
              return parseFloat(String(v)) || 0;
            };
            const setCv = (ref: string, val: number) => {
              if (!sheet.cells[ref]) sheet.cells[ref] = { value: '' };
              sheet.cells[ref].value = String(val);
              if (sheet.cells[ref].formula) delete sheet.cells[ref].formula;
              delete sheet.cells[ref].computed;
            };
            const rc = () => recalcAll(sheet, graph, workbook.namedRanges);
            const result = goalSeek(getCv, setCv, rc, targetCell, targetValue, changingCell);
            setWorkbook({ ...workbook });
            return result;
          }}
        />
      )}

      {showDataTable && (
        <DataTableDialog
          onClose={() => setShowDataTable(false)}
          onApply={(config: DataTableConfig) => {
            const graph = buildDependencyGraph(sheet);
            const getCv = (ref: string): number => {
              const cell = sheet.cells[ref];
              if (!cell) return 0;
              const v = cell.computed !== undefined ? cell.computed : cell.value;
              return parseFloat(String(v)) || 0;
            };
            const setCv = (ref: string, val: number) => {
              if (!sheet.cells[ref]) sheet.cells[ref] = { value: '' };
              sheet.cells[ref].value = String(val);
              if (sheet.cells[ref].formula) delete sheet.cells[ref].formula;
              delete sheet.cells[ref].computed;
            };
            const rc = () => recalcAll(sheet, graph, workbook.namedRanges);
            const result = computeDataTable(config, getCv, setCv, rc, config.formulaCell);
            // Insert results starting 2 rows below active cell
            const startRow = activeCell.row + 2;
            const startCol = activeCell.col;
            result.rows.forEach((row, ri) => {
              const id0 = cellId(startCol, startRow + ri);
              if (!sheet.cells[id0]) sheet.cells[id0] = { value: '' };
              sheet.cells[id0].value = String(row.input);
              row.values.forEach((v, ci) => {
                const id1 = cellId(startCol + 1 + ci, startRow + ri);
                if (!sheet.cells[id1]) sheet.cells[id1] = { value: '' };
                sheet.cells[id1].value = String(v);
              });
            });
            setShowDataTable(false);
            setWorkbook({ ...workbook });
          }}
        />
      )}

      {showSolver && (
        <SolverDialog
          onClose={() => setShowSolver(false)}
          onSolve={(config: SolverConfig) => {
            const graph = buildDependencyGraph(sheet);
            const getCv = (ref: string): number => {
              const cell = sheet.cells[ref];
              if (!cell) return 0;
              const v = cell.computed !== undefined ? cell.computed : cell.value;
              return parseFloat(String(v)) || 0;
            };
            const setCv = (ref: string, val: number) => {
              if (!sheet.cells[ref]) sheet.cells[ref] = { value: '' };
              sheet.cells[ref].value = String(val);
              if (sheet.cells[ref].formula) delete sheet.cells[ref].formula;
              delete sheet.cells[ref].computed;
            };
            const rc = () => recalcAll(sheet, graph, workbook.namedRanges);
            const result = solve(config, getCv, setCv, rc);
            setWorkbook({ ...workbook });
            return result;
          }}
        />
      )}

      {showDataImport && (
        <DataImportDialog
          onClose={() => setShowDataImport(false)}
          onImport={(data, mode) => {
            const startRow = mode === 'append' ? Object.keys(sheet.cells).reduce((max, id) => {
              const p = parseCellRef(id);
              return p ? Math.max(max, p.row + 1) : max;
            }, 0) : 0;
            if (mode === 'replace') {
              sheet.cells = {};
            }
            data.forEach((row, ri) => {
              row.forEach((val, ci) => {
                const id = cellId(ci, startRow + ri);
                sheet.cells[id] = { value: val };
              });
            });
            const graph = buildDependencyGraph(sheet);
            recalcAll(sheet, graph, workbook.namedRanges);
            setShowDataImport(false);
            setWorkbook({ ...workbook });
          }}
        />
      )}

      {showFreqAnalysis && (
        <FrequencyAnalysisDialog
          values={selectedNumericValues}
          selectedRange={selectedRangeStr}
          onClose={() => setShowFreqAnalysis(false)}
          onInsert={(data) => {
            const startCol = selRange.maxCol + 2;
            const startRow = selRange.minRow;
            data.forEach((row, ri) => {
              row.forEach((val, ci) => {
                const id = cellId(startCol + ci, startRow + ri);
                sheet.cells[id] = { value: val };
              });
            });
            setShowFreqAnalysis(false);
            setWorkbook({ ...workbook });
          }}
        />
      )}

      {/* Cell context menu */}
      {cellContextMenu && (
        <div
          className="sheet-context-menu"
          style={{ position: 'fixed', left: cellContextMenu.x, top: cellContextMenu.y, background: '#fff', border: '1px solid #ccc', borderRadius: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', zIndex: 1000, padding: '4px 0', minWidth: 160 }}
          onClick={e => e.stopPropagation()}
        >
          <div className="sheet-ctx-item" style={{ padding: '6px 16px', cursor: 'pointer' }} onClick={() => { openCommentPanel(cellContextMenu.row, cellContextMenu.col); setCellContextMenu(null); }}>
            💬 {sheet.cells[cellId(cellContextMenu.col, cellContextMenu.row)]?.comment ? 'Edit comment' : 'Insert comment'}
          </div>
        </div>
      )}

      {/* Comment panel */}
      {commentPanel && (
        <SheetComments
          cellId={commentPanel.cellId}
          comment={sheet.cells[commentPanel.cellId]?.comment}
          anchorRect={commentPanel.rect}
          onAddComment={handleAddComment}
          onReply={handleReplyComment}
          onResolve={handleResolveComment}
          onDelete={handleDeleteComment}
          onDeleteReply={handleDeleteReply}
          onClose={() => setCommentPanel(null)}
        />
      )}

      {/* Comment tooltip on hover */}
      {hoveredComment && !commentPanel && (
        <CommentTooltip
          comment={hoveredComment.comment}
          style={{ position: 'fixed', left: hoveredComment.x + 12, top: hoveredComment.y + 12, zIndex: 200 }}
        />
      )}

      {/* Protected ranges dialog */}
      {showProtectedRangesDialog && (
        <ProtectedRanges
          ranges={sheet.protectedRanges}
          selectedRange={selectedRangeStr}
          onSave={(ranges: ProtectedRange[]) => {
            sheet.protectedRanges = ranges;
            setWorkbook({ ...workbook });
          }}
          onClose={() => setShowProtectedRangesDialog(false)}
        />
      )}

      {/* Protected cell toast */}
      {protectedToast && (
        <div className="sheet-toast">{protectedToast}</div>
      )}

      {/* Find & Replace */}
      {showFindReplace && (
        <SheetFindReplace
          workbook={workbook}
          activeSheet={workbook.activeSheet}
          onNavigate={handleFindNavigate}
          onReplace={handleFindReplace}
          onClose={() => { setShowFindReplace(false); setFindMatches([]); }}
          replaceMode={findReplaceMode}
        />
      )}
      {hoveredSparkline && (
        <CellMiniChart data={hoveredSparkline.data} x={hoveredSparkline.x} y={hoveredSparkline.y} />
      )}
      {showSparklineDialog && (
        <SparklineDialog
          onInsert={(formula) => {
            const id = cellId(activeCell.col, activeCell.row);
            const newCell = { ...(sheet.cells[id] || { value: '' }), formula: formula.slice(1), value: formula };
            sheet.cells[id] = newCell;
            recalculate(sheet, graphRef.current, id, workbook.namedRanges);
            setWorkbook({ ...workbook });
          }}
          onClose={() => setShowSparklineDialog(false)}
        />
      )}
      {/* Slicer dialog */}
      {showSlicerDialog && (
        <InsertSlicerDialog
          sheet={sheet}
          sourceRange={selectedRangeStr}
          onInsert={handleInsertSlicer}
          onClose={() => setShowSlicerDialog(false)}
        />
      )}
      {/* Heatmap dialog */}
      {showHeatmapDialog && (
        <CreateHeatmapDialog
          selectionRange={selectedRangeStr}
          onInsert={handleInsertHeatmap}
          onClose={() => setShowHeatmapDialog(false)}
        />
      )}
      {/* Timeline dialog */}
      {showTimelineDialog && (
        <InsertTimelineDialog
          sheet={sheet}
          sourceRange={selectedRangeStr}
          onInsert={handleInsertTimeline}
          onClose={() => setShowTimelineDialog(false)}
        />
      )}
      {/* Dashboard presentation */}
      {showPresentation && (
        <DashboardPresentation
          backgroundColor={dashboardConfig.backgroundColor}
          onExit={() => setShowPresentation(false)}
        >
          {sheet.charts.map(chart => (
            <SheetChartOverlay key={chart.id} chart={chart} sheet={sheet} onMove={handleChartMove} onResize={handleChartResize} onDelete={handleChartDelete} />
          ))}
          {slicers.filter(s => s.sourceSheet === workbook.activeSheet).map(slicer => (
            <SlicerOverlay key={slicer.id} slicer={slicer} sheet={sheet} onSelectionChange={handleSlicerSelectionChange} onMove={handleSlicerMove} onResize={handleSlicerResize} onDelete={handleSlicerDelete} />
          ))}
          {dashboardConfig.labels.map(label => (
            <DashboardLabelOverlay key={label.id} label={label} onUpdate={handleUpdateDashboardLabel} onDelete={handleDeleteDashboardLabel} />
          ))}
        </DashboardPresentation>
      )}
      {/* Dashboard toolbar (when enabled) */}
      {dashboardConfig.enabled && (
        <div style={{ position: 'fixed', bottom: 40, left: '50%', transform: 'translateX(-50%)', zIndex: 100 }}>
          <DashboardToolbar
            config={dashboardConfig}
            onToggle={handleToggleDashboard}
            onBackgroundChange={(color) => setDashboardConfig(c => ({ ...c, backgroundColor: color }))}
            onAddLabel={handleAddDashboardLabel}
            onFullscreen={() => setShowPresentation(true)}
          />
        </div>
      )}
      {showPrintSetup && (
        <SheetPrintSetup
          settings={printSettings}
          onApply={s => { setPrintSettings(s); setShowPrintSetup(false); }}
          onClose={() => setShowPrintSetup(false)}
          onPreview={() => { setShowPrintSetup(false); setShowPrintPreview(true); }}
          namedRanges={Object.keys(workbook.namedRanges || {})}
        />
      )}
      {showPrintPreview && (
        <SheetPrintPreview
          workbook={workbook}
          sheetIndex={workbook.activeSheet}
          settings={printSettings}
          onClose={() => setShowPrintPreview(false)}
          manualBreaks={manualPageBreaks}
          onToggleBreak={row => setManualPageBreaks(prev => prev.includes(row) ? prev.filter(r => r !== row) : [...prev, row].sort((a,b) => a-b))}
        />
      )}
      <SheetStatusBar
        cellRef={cellId(activeCell.col, activeCell.row)}
        selectedValues={selectedNumericValues}
        sheetIndex={workbook.activeSheet}
        sheetCount={workbook.sheets.length}
        collaborationStatus={collabStatus}
        connectedUsers={remoteCursors.length + 1}
      />
      <SheetShortcuts />
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
