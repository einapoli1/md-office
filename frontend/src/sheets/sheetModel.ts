// Sheet data model with undo/redo, serialization, and multi-sheet support

import { CellFormat } from './cellFormat';
import { MergeRange } from './cellFormat';
import type { ConditionalRule, ValidationRule } from './conditionalEval';
import { DependencyGraph, extractRefs, evaluateFormula, cellId, parseCellRef, indexToCol } from './formulaEngine';

export interface CellData {
  value: string;
  formula?: string;
  format?: CellFormat;
  computed?: string; // cached computed value for formulas
}

export type ChartType = 'bar' | 'line' | 'pie' | 'scatter' | 'area';

export interface ChartConfig {
  id: string;
  type: ChartType;
  dataRange: string;   // e.g. "B1:B10"
  labelRange: string;  // e.g. "A1:A10"
  title: string;
  colors?: string[];
  x: number;  // pixel position
  y: number;
  width: number;
  height: number;
}

export interface FilterState {
  column: number;
  mode: 'all' | 'values' | 'contains' | 'equals' | 'gt' | 'lt';
  value?: string;
  selectedValues?: Set<string>;
}

export interface FreezePanes {
  rows: number;  // number of frozen rows (0 = none)
  cols: number;  // number of frozen columns (0 = none)
}

export interface SheetData {
  name: string;
  cells: Record<string, CellData>;
  merges: MergeRange[];
  colWidths: Record<number, number>;
  rowHeights: Record<number, number>;
  charts: ChartConfig[];
  filters: FilterState[];
  filtersEnabled: boolean;
  freeze: FreezePanes;
  sortState?: { col: number; ascending: boolean };
  conditionalFormats: ConditionalRule[];
  validationRules: ValidationRule[];
}

export interface WorkbookData {
  sheets: SheetData[];
  activeSheet: number;
}

export interface UndoEntry {
  sheetIndex: number;
  cellId: string;
  before: CellData | undefined;
  after: CellData | undefined;
}

const DEFAULT_COL_WIDTH = 100;
const DEFAULT_ROW_HEIGHT = 28;

export function createEmptySheet(name: string): SheetData {
  return { name, cells: {}, merges: [], colWidths: {}, rowHeights: {}, charts: [], filters: [], filtersEnabled: false, freeze: { rows: 0, cols: 0 }, conditionalFormats: [], validationRules: [] };
}

export function createWorkbook(): WorkbookData {
  return { sheets: [createEmptySheet('Sheet1')], activeSheet: 0 };
}

export function getColWidth(sheet: SheetData, col: number): number {
  return sheet.colWidths[col] ?? DEFAULT_COL_WIDTH;
}

export function getRowHeight(sheet: SheetData, row: number): number {
  return sheet.rowHeights[row] ?? DEFAULT_ROW_HEIGHT;
}

// Recalculate a cell and its dependents
export function recalculate(sheet: SheetData, graph: DependencyGraph, changedCell: string): void {
  const cell = sheet.cells[changedCell];
  
  const getCellValue = (ref: string): string => {
    const c = sheet.cells[ref];
    if (!c) return '';
    return c.computed ?? c.value;
  };

  // Recalc the changed cell itself if it has a formula
  if (cell?.formula) {
    const refs = extractRefs(cell.formula);
    if (graph.hasCircular(changedCell, refs)) {
      cell.computed = '#CIRCULAR!';
    } else {
      graph.setDependencies(changedCell, refs);
      cell.computed = evaluateFormula(cell.formula, getCellValue);
    }
  } else if (cell) {
    cell.computed = undefined;
    graph.removeDependencies(changedCell);
  }

  // Recalc dependents
  const dependents = graph.getDependents(changedCell);
  if (dependents.length === 1 && dependents[0] === '#CIRCULAR!') {
    return; // circular detected
  }
  
  for (const dep of dependents) {
    const depCell = sheet.cells[dep];
    if (depCell?.formula) {
      depCell.computed = evaluateFormula(depCell.formula, getCellValue);
    }
  }
}

// Initialize dependency graph from sheet
export function buildDependencyGraph(sheet: SheetData): DependencyGraph {
  const graph = new DependencyGraph();
  for (const [id, cell] of Object.entries(sheet.cells)) {
    if (cell.formula) {
      const refs = extractRefs(cell.formula);
      graph.setDependencies(id, refs);
    }
  }
  return graph;
}

// Recalculate all formulas in sheet
export function recalcAll(sheet: SheetData, _graph: DependencyGraph): void {
  const getCellValue = (ref: string): string => {
    const c = sheet.cells[ref];
    if (!c) return '';
    return c.computed ?? c.value;
  };
  
  // Simple multi-pass: recalc until stable (max 10 passes)
  for (let pass = 0; pass < 10; pass++) {
    let changed = false;
    for (const [, cell] of Object.entries(sheet.cells)) {
      if (cell.formula) {
        const newVal = evaluateFormula(cell.formula, getCellValue);
        if (newVal !== cell.computed) {
          cell.computed = newVal;
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
}

// Serialization: TSV with YAML frontmatter
export function serializeWorkbook(wb: WorkbookData): string {
  const parts: string[] = [];
  
  parts.push('---');
  parts.push(`sheets: ${wb.sheets.length}`);
  parts.push(`activeSheet: ${wb.activeSheet}`);
  for (let i = 0; i < wb.sheets.length; i++) {
    const s = wb.sheets[i];
    parts.push(`sheet${i}Name: "${s.name}"`);
    if (Object.keys(s.colWidths).length > 0) {
      parts.push(`sheet${i}ColWidths: ${JSON.stringify(s.colWidths)}`);
    }
    if (s.merges.length > 0) {
      parts.push(`sheet${i}Merges: ${JSON.stringify(s.merges)}`);
    }
  }
  parts.push('---');
  
  // One TSV block per sheet, separated by a marker line
  for (let si = 0; si < wb.sheets.length; si++) {
    if (si > 0) parts.push('===SHEET===');
    const sheet = wb.sheets[si];
    
    // Find bounds
    let maxRow = 0, maxCol = 0;
    for (const key of Object.keys(sheet.cells)) {
      const ref = parseCellRef(key);
      if (ref) {
        maxRow = Math.max(maxRow, ref.row);
        maxCol = Math.max(maxCol, ref.col);
      }
    }
    
    // Write TSV rows
    for (let r = 0; r <= maxRow; r++) {
      const cols: string[] = [];
      for (let c = 0; c <= maxCol; c++) {
        const id = cellId(c, r);
        const cell = sheet.cells[id];
        if (cell) {
          let val = cell.formula || cell.value;
          // Encode format as JSON suffix if present
          if (cell.format && Object.keys(cell.format).length > 0) {
            val += `\x01${JSON.stringify(cell.format)}`;
          }
          cols.push(val.replace(/\t/g, '\\t').replace(/\n/g, '\\n'));
        } else {
          cols.push('');
        }
      }
      parts.push(cols.join('\t'));
    }
  }
  
  return parts.join('\n');
}

export function deserializeWorkbook(text: string): WorkbookData {
  const wb = createWorkbook();
  
  // Parse YAML frontmatter
  const fmMatch = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fmMatch) {
    // No frontmatter — treat as single sheet TSV
    parseSheetTSV(wb.sheets[0], text);
    return wb;
  }
  
  const yaml = fmMatch[1];
  const body = fmMatch[2];
  
  const getYaml = (key: string): string | undefined => {
    const m = yaml.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
    return m ? m[1].replace(/^"(.*)"$/, '$1') : undefined;
  };
  
  const sheetCount = parseInt(getYaml('sheets') || '1');
  wb.activeSheet = parseInt(getYaml('activeSheet') || '0');
  
  // Create sheets
  wb.sheets = [];
  for (let i = 0; i < sheetCount; i++) {
    const name = getYaml(`sheet${i}Name`) || `Sheet${i + 1}`;
    const sheet = createEmptySheet(name);
    const cwStr = getYaml(`sheet${i}ColWidths`);
    if (cwStr) {
      try { sheet.colWidths = JSON.parse(cwStr); } catch { /* ignore */ }
    }
    const mStr = getYaml(`sheet${i}Merges`);
    if (mStr) {
      try { sheet.merges = JSON.parse(mStr); } catch { /* ignore */ }
    }
    wb.sheets.push(sheet);
  }
  
  // Parse sheet bodies
  const sheetBodies = body.split('===SHEET===');
  for (let i = 0; i < sheetBodies.length && i < wb.sheets.length; i++) {
    parseSheetTSV(wb.sheets[i], sheetBodies[i].trim());
  }
  
  return wb;
}

function parseSheetTSV(sheet: SheetData, tsv: string): void {
  if (!tsv) return;
  const lines = tsv.split('\n');
  for (let r = 0; r < lines.length; r++) {
    const cols = lines[r].split('\t');
    for (let c = 0; c < cols.length; c++) {
      let val = cols[c].replace(/\\t/g, '\t').replace(/\\n/g, '\n');
      if (!val) continue;
      
      let format: CellFormat | undefined;
      const fmtIdx = val.indexOf('\x01');
      if (fmtIdx !== -1) {
        try { format = JSON.parse(val.slice(fmtIdx + 1)); } catch { /* ignore */ }
        val = val.slice(0, fmtIdx);
      }
      
      const id = cellId(c, r);
      if (val.startsWith('=')) {
        sheet.cells[id] = { value: '', formula: val, format };
      } else {
        sheet.cells[id] = { value: val, format };
      }
    }
  }
}

// Undo/Redo manager
export class UndoManager {
  private undoStack: UndoEntry[][] = [];
  private redoStack: UndoEntry[][] = [];
  
  push(entries: UndoEntry[]) {
    this.undoStack.push(entries);
    this.redoStack = [];
  }
  
  canUndo(): boolean { return this.undoStack.length > 0; }
  canRedo(): boolean { return this.redoStack.length > 0; }
  
  undo(wb: WorkbookData): boolean {
    const entries = this.undoStack.pop();
    if (!entries) return false;
    this.redoStack.push(entries);
    for (const e of entries) {
      const sheet = wb.sheets[e.sheetIndex];
      if (e.before) {
        sheet.cells[e.cellId] = { ...e.before };
      } else {
        delete sheet.cells[e.cellId];
      }
    }
    return true;
  }
  
  redo(wb: WorkbookData): boolean {
    const entries = this.redoStack.pop();
    if (!entries) return false;
    this.undoStack.push(entries);
    for (const e of entries) {
      const sheet = wb.sheets[e.sheetIndex];
      if (e.after) {
        sheet.cells[e.cellId] = { ...e.after };
      } else {
        delete sheet.cells[e.cellId];
      }
    }
    return true;
  }
}

// Unused export to keep noUnusedLocals happy
export { DEFAULT_COL_WIDTH, DEFAULT_ROW_HEIGHT, indexToCol as _indexToCol };
