/**
 * Yjs collaboration layer for MD Sheets.
 * Uses Y.Map for cell data, Y.Map for sheet metadata, awareness for cursors.
 */
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { getUserColor } from '../utils/collabColors';
import type { SheetData, CellData, WorkbookData } from './sheetModel';
import { createEmptySheet } from './sheetModel';

// ── Types ──────────────────────────────────────────────────────────────────

export interface SheetAwarenessState {
  user: { name: string; color: string };
  selectedCell: string | null;       // e.g. "B3"
  selectedRange: string | null;      // e.g. "A1:C5"
  activeSheet: number;
}

export interface RemoteCursor {
  name: string;
  color: string;
  cell: string | null;
  range: string | null;
  activeSheet: number;
  clientId: number;
}

// ── Yjs type accessors ────────────────────────────────────────────────────

/** Get the Y.Map<Y.Map<string>> that holds all sheets' cell data, keyed by sheet index */
function getCellsMap(ydoc: Y.Doc, sheetIndex: number): Y.Map<string> {
  return ydoc.getMap(`sheet_cells_${sheetIndex}`);
}

/** Sheet metadata (name, colWidths, freeze, etc.) */
function getMetaMap(ydoc: Y.Doc, sheetIndex: number): Y.Map<any> {
  return ydoc.getMap(`sheet_meta_${sheetIndex}`);
}

/** Workbook-level metadata (sheet count, activeSheet, namedRanges) */
function getWorkbookMeta(ydoc: Y.Doc): Y.Map<any> {
  return ydoc.getMap('workbook_meta');
}

// ── Serialise / deserialise cell data to JSON-safe strings ─────────────────

function cellToJson(cell: CellData): string {
  return JSON.stringify(cell);
}

function jsonToCell(json: string): CellData | null {
  try {
    return JSON.parse(json) as CellData;
  } catch {
    return null;
  }
}

// ── Sync local → Yjs ──────────────────────────────────────────────────────

export function syncWorkbookToYjs(workbook: WorkbookData, ydoc: Y.Doc): void {
  ydoc.transact(() => {
    const wbMeta = getWorkbookMeta(ydoc);
    wbMeta.set('sheetCount', workbook.sheets.length);
    wbMeta.set('namedRanges', JSON.stringify(workbook.namedRanges ?? {}));

    for (let si = 0; si < workbook.sheets.length; si++) {
      syncSheetToYjs(workbook.sheets[si], ydoc, si);
    }
  });
}

export function syncSheetToYjs(sheet: SheetData, ydoc: Y.Doc, sheetIndex: number): void {
  const cellsMap = getCellsMap(ydoc, sheetIndex);
  const metaMap = getMetaMap(ydoc, sheetIndex);

  // Metadata
  metaMap.set('name', sheet.name);
  metaMap.set('colWidths', JSON.stringify(sheet.colWidths));
  metaMap.set('rowHeights', JSON.stringify(sheet.rowHeights));
  metaMap.set('merges', JSON.stringify(sheet.merges));
  metaMap.set('freeze', JSON.stringify(sheet.freeze));
  metaMap.set('filtersEnabled', sheet.filtersEnabled);
  metaMap.set('conditionalFormats', JSON.stringify(sheet.conditionalFormats ?? []));
  metaMap.set('validationRules', JSON.stringify(sheet.validationRules ?? []));

  // Cells — set each key, remove keys not in local
  const localKeys = new Set(Object.keys(sheet.cells));
  for (const [key] of cellsMap.entries()) {
    if (!localKeys.has(key)) cellsMap.delete(key);
  }
  for (const [key, cell] of Object.entries(sheet.cells)) {
    cellsMap.set(key, cellToJson(cell));
  }
}

// ── Sync Yjs → local ──────────────────────────────────────────────────────

export function syncWorkbookFromYjs(ydoc: Y.Doc): WorkbookData {
  const wbMeta = getWorkbookMeta(ydoc);
  const sheetCount = (wbMeta.get('sheetCount') as number) || 1;
  const namedRanges = safeJsonParse<Record<string, string>>(wbMeta.get('namedRanges') as string, {});

  const sheets: SheetData[] = [];
  for (let si = 0; si < sheetCount; si++) {
    sheets.push(syncSheetFromYjs(ydoc, si));
  }

  return {
    sheets: sheets.length > 0 ? sheets : [createEmptySheet('Sheet1')],
    activeSheet: 0,
    namedRanges,
    pivotTables: [],
  };
}

function syncSheetFromYjs(ydoc: Y.Doc, sheetIndex: number): SheetData {
  const cellsMap = getCellsMap(ydoc, sheetIndex);
  const metaMap = getMetaMap(ydoc, sheetIndex);

  const cells: Record<string, CellData> = {};
  for (const [key, val] of cellsMap.entries()) {
    const cell = jsonToCell(val as string);
    if (cell) cells[key] = cell;
  }

  return {
    name: (metaMap.get('name') as string) || `Sheet${sheetIndex + 1}`,
    cells,
    colWidths: safeJsonParse(metaMap.get('colWidths') as string, {}),
    rowHeights: safeJsonParse(metaMap.get('rowHeights') as string, {}),
    merges: safeJsonParse(metaMap.get('merges') as string, []),
    freeze: safeJsonParse(metaMap.get('freeze') as string, { rows: 0, cols: 0 }),
    filtersEnabled: (metaMap.get('filtersEnabled') as boolean) ?? false,
    filters: [],
    charts: [],
    conditionalFormats: safeJsonParse(metaMap.get('conditionalFormats') as string, []),
    validationRules: safeJsonParse(metaMap.get('validationRules') as string, []),
    protectedRanges: safeJsonParse(metaMap.get('protectedRanges') as string, []),
    sortState: undefined,
  };
}

// ── Cell-level operations (fine-grained, no full sync) ─────────────────────

export function setCellInYjs(ydoc: Y.Doc, sheetIndex: number, cellId: string, cell: CellData | undefined): void {
  const cellsMap = getCellsMap(ydoc, sheetIndex);
  if (cell) {
    cellsMap.set(cellId, cellToJson(cell));
  } else {
    cellsMap.delete(cellId);
  }
}

export function setSheetMetaInYjs(ydoc: Y.Doc, sheetIndex: number, key: string, value: any): void {
  const metaMap = getMetaMap(ydoc, sheetIndex);
  metaMap.set(key, typeof value === 'string' ? value : JSON.stringify(value));
}

// ── Observers ──────────────────────────────────────────────────────────────

export type CellChangeCallback = (sheetIndex: number, changes: Map<string, CellData | null>) => void;

export function observeCells(
  ydoc: Y.Doc,
  sheetIndex: number,
  callback: CellChangeCallback,
): () => void {
  const cellsMap = getCellsMap(ydoc, sheetIndex);
  const handler = (events: Y.YMapEvent<string>) => {
    const changes = new Map<string, CellData | null>();
    events.changes.keys.forEach((change, key) => {
      if (change.action === 'delete') {
        changes.set(key, null);
      } else {
        const val = cellsMap.get(key);
        if (val) {
          const cell = jsonToCell(val as string);
          changes.set(key, cell);
        }
      }
    });
    if (changes.size > 0) callback(sheetIndex, changes);
  };
  cellsMap.observe(handler);
  return () => cellsMap.unobserve(handler);
}

export function observeMeta(
  ydoc: Y.Doc,
  sheetIndex: number,
  callback: (sheetIndex: number) => void,
): () => void {
  const metaMap = getMetaMap(ydoc, sheetIndex);
  const handler = () => callback(sheetIndex);
  metaMap.observe(handler);
  return () => metaMap.unobserve(handler);
}

// ── Awareness (cursors) ────────────────────────────────────────────────────

export function setLocalCursor(
  provider: HocuspocusProvider,
  userName: string,
  selectedCell: string | null,
  selectedRange: string | null,
  activeSheet: number,
): void {
  if (!provider.awareness) return;
  const state: SheetAwarenessState = {
    user: { name: userName, color: getUserColor(userName) },
    selectedCell,
    selectedRange,
    activeSheet,
  };
  provider.awareness.setLocalStateField('sheetCursor', state);
}

export function getRemoteCursors(provider: HocuspocusProvider): RemoteCursor[] {
  if (!provider.awareness) return [];
  const cursors: RemoteCursor[] = [];
  const localId = provider.awareness.clientID;
  provider.awareness.getStates().forEach((state: any, clientId: number) => {
    if (clientId === localId) return;
    const sc = state?.sheetCursor as SheetAwarenessState | undefined;
    if (!sc?.user) return;
    cursors.push({
      name: sc.user.name,
      color: sc.user.color,
      cell: sc.selectedCell,
      range: sc.selectedRange,
      activeSheet: sc.activeSheet,
      clientId,
    });
  });
  return cursors;
}

export function onAwarenessChange(
  provider: HocuspocusProvider,
  callback: (cursors: RemoteCursor[]) => void,
): () => void {
  if (!provider.awareness) return () => {};
  const handler = () => callback(getRemoteCursors(provider));
  provider.awareness.on('change', handler);
  return () => provider.awareness!.off('change', handler);
}

// ── Init helper ────────────────────────────────────────────────────────────

export interface SheetCollabHandle {
  ydoc: Y.Doc;
  provider: HocuspocusProvider;
  destroy: () => void;
}

export function initSheetCollab(
  documentName: string,
  serverUrl: string,
  userName: string,
  workbook: WorkbookData,
  onCellsChanged: CellChangeCallback,
  onMetaChanged: (sheetIndex: number) => void,
  onCursorsChanged: (cursors: RemoteCursor[]) => void,
): SheetCollabHandle {
  const ydoc = new Y.Doc();
  const provider = new HocuspocusProvider({
    url: serverUrl,
    name: `sheet:${documentName}`,
    document: ydoc,
  });

  // Set user info on awareness
  if (provider.awareness) {
    provider.awareness.setLocalStateField('user', {
      name: userName,
      color: getUserColor(userName),
    });
  }

  const unsubscribers: (() => void)[] = [];

  // When synced, seed Yjs if empty then observe
  const handleSynced = () => {
    const wbMeta = getWorkbookMeta(ydoc);
    const existingCount = wbMeta.get('sheetCount') as number | undefined;

    if (!existingCount || existingCount === 0) {
      // First client — push local workbook into Yjs
      syncWorkbookToYjs(workbook, ydoc);
    }

    // Observe all sheets
    const sheetCount = (wbMeta.get('sheetCount') as number) || 1;
    for (let si = 0; si < sheetCount; si++) {
      unsubscribers.push(observeCells(ydoc, si, onCellsChanged));
      unsubscribers.push(observeMeta(ydoc, si, onMetaChanged));
    }

    // Awareness
    unsubscribers.push(onAwarenessChange(provider, onCursorsChanged));
  };

  if (provider.isSynced) {
    handleSynced();
  }
  provider.on('synced', handleSynced);

  return {
    ydoc,
    provider,
    destroy: () => {
      unsubscribers.forEach(fn => fn());
      provider.off('synced', handleSynced);
      provider.destroy();
      ydoc.destroy();
    },
  };
}

// ── Utilities ──────────────────────────────────────────────────────────────

function safeJsonParse<T>(str: string | undefined | null, fallback: T): T {
  if (!str) return fallback;
  try { return JSON.parse(str) as T; } catch { return fallback; }
}
