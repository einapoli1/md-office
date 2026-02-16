import { describe, it, expect } from 'vitest';
import {
  createWorkbook,
  createEmptySheet,
  serializeWorkbook,
  deserializeWorkbook,
  recalculate,
  recalcAll,
  buildDependencyGraph,
  getColWidth,
  getRowHeight,
  UndoManager,
} from '../sheetModel';
import { DependencyGraph } from '../formulaEngine';

describe('Sheet creation', () => {
  it('creates a workbook with one sheet', () => {
    const wb = createWorkbook();
    expect(wb.sheets).toHaveLength(1);
    expect(wb.sheets[0].name).toBe('Sheet1');
    expect(wb.activeSheet).toBe(0);
  });

  it('createEmptySheet has correct defaults', () => {
    const s = createEmptySheet('Test');
    expect(s.name).toBe('Test');
    expect(s.cells).toEqual({});
    expect(s.merges).toEqual([]);
    expect(s.charts).toEqual([]);
    expect(s.freeze).toEqual({ rows: 0, cols: 0 });
  });
});

describe('Cell get/set', () => {
  it('sets and reads a cell value', () => {
    const wb = createWorkbook();
    wb.sheets[0].cells['A1'] = { value: 'hello' };
    expect(wb.sheets[0].cells['A1'].value).toBe('hello');
  });

  it('sets a formula cell', () => {
    const wb = createWorkbook();
    wb.sheets[0].cells['A1'] = { value: '', formula: '=1+2' };
    expect(wb.sheets[0].cells['A1'].formula).toBe('=1+2');
  });

  it('deletes a cell', () => {
    const wb = createWorkbook();
    wb.sheets[0].cells['A1'] = { value: '42' };
    delete wb.sheets[0].cells['A1'];
    expect(wb.sheets[0].cells['A1']).toBeUndefined();
  });
});

describe('Multi-sheet operations', () => {
  it('adds a sheet', () => {
    const wb = createWorkbook();
    wb.sheets.push(createEmptySheet('Sheet2'));
    expect(wb.sheets).toHaveLength(2);
    expect(wb.sheets[1].name).toBe('Sheet2');
  });

  it('removes a sheet', () => {
    const wb = createWorkbook();
    wb.sheets.push(createEmptySheet('Sheet2'));
    wb.sheets.splice(0, 1);
    expect(wb.sheets).toHaveLength(1);
    expect(wb.sheets[0].name).toBe('Sheet2');
  });

  it('renames a sheet', () => {
    const wb = createWorkbook();
    wb.sheets[0].name = 'Revenue';
    expect(wb.sheets[0].name).toBe('Revenue');
  });
});

describe('Serialization round-trip', () => {
  it('serializes and deserializes a simple workbook', () => {
    const wb = createWorkbook();
    wb.sheets[0].cells['A1'] = { value: 'hello' };
    wb.sheets[0].cells['B1'] = { value: '42' };
    wb.sheets[0].cells['A2'] = { value: '', formula: '=A1' };

    const text = serializeWorkbook(wb);
    const wb2 = deserializeWorkbook(text);

    expect(wb2.sheets).toHaveLength(1);
    expect(wb2.sheets[0].cells['A1'].value).toBe('hello');
    expect(wb2.sheets[0].cells['B1'].value).toBe('42');
    expect(wb2.sheets[0].cells['A2'].formula).toBe('=A1');
  });

  it('round-trips multi-sheet workbook', () => {
    const wb = createWorkbook();
    wb.sheets.push(createEmptySheet('Data'));
    wb.sheets[1].cells['A1'] = { value: '100' };
    wb.activeSheet = 1;

    const text = serializeWorkbook(wb);
    const wb2 = deserializeWorkbook(text);

    expect(wb2.sheets).toHaveLength(2);
    expect(wb2.sheets[1].name).toBe('Data');
    expect(wb2.sheets[1].cells['A1'].value).toBe('100');
    expect(wb2.activeSheet).toBe(1);
  });

  it('handles plain TSV without frontmatter', () => {
    const wb = deserializeWorkbook('a\tb\n1\t2');
    expect(wb.sheets[0].cells['A1'].value).toBe('a');
    expect(wb.sheets[0].cells['B2'].value).toBe('2');
  });
});

describe('Recalculation', () => {
  it('recalculates a formula cell', () => {
    const wb = createWorkbook();
    const sheet = wb.sheets[0];
    sheet.cells['A1'] = { value: '10' };
    sheet.cells['B1'] = { value: '', formula: '=A1+5' };

    const graph = buildDependencyGraph(sheet);
    recalcAll(sheet, graph);

    expect(sheet.cells['B1'].computed).toBe('15');
  });

  it('cascading recalculation', () => {
    const wb = createWorkbook();
    const sheet = wb.sheets[0];
    sheet.cells['A1'] = { value: '2' };
    sheet.cells['B1'] = { value: '', formula: '=A1*3' };
    sheet.cells['C1'] = { value: '', formula: '=B1+1' };

    const graph = buildDependencyGraph(sheet);
    recalcAll(sheet, graph);

    expect(sheet.cells['B1'].computed).toBe('6');
    expect(sheet.cells['C1'].computed).toBe('7');
  });

  it('recalculate single cell triggers dependents', () => {
    const wb = createWorkbook();
    const sheet = wb.sheets[0];
    sheet.cells['A1'] = { value: '5' };
    sheet.cells['B1'] = { value: '', formula: '=A1*2' };

    const graph = buildDependencyGraph(sheet);
    recalcAll(sheet, graph);
    expect(sheet.cells['B1'].computed).toBe('10');

    // Change A1
    sheet.cells['A1'].value = '10';
    recalculate(sheet, graph, 'A1');
    expect(sheet.cells['B1'].computed).toBe('20');
  });
});

describe('Named ranges resolution', () => {
  it('recalcAll with named ranges', () => {
    const wb = createWorkbook();
    const sheet = wb.sheets[0];
    sheet.cells['A1'] = { value: '1' };
    sheet.cells['A2'] = { value: '2' };
    sheet.cells['A3'] = { value: '3' };
    sheet.cells['B1'] = { value: '', formula: '=SUM(mydata)' };
    wb.namedRanges = { mydata: 'A1:A3' };

    const graph = buildDependencyGraph(sheet);
    recalcAll(sheet, graph, wb.namedRanges);

    expect(sheet.cells['B1'].computed).toBe('6');
  });
});

describe('Column/row defaults', () => {
  it('getColWidth returns default 100', () => {
    const s = createEmptySheet('X');
    expect(getColWidth(s, 0)).toBe(100);
  });
  it('getColWidth returns custom', () => {
    const s = createEmptySheet('X');
    s.colWidths[0] = 200;
    expect(getColWidth(s, 0)).toBe(200);
  });
  it('getRowHeight returns default 28', () => {
    const s = createEmptySheet('X');
    expect(getRowHeight(s, 0)).toBe(28);
  });
});

describe('UndoManager', () => {
  it('undo reverts cell change', () => {
    const wb = createWorkbook();
    const um = new UndoManager();
    wb.sheets[0].cells['A1'] = { value: 'new' };
    um.push([{ sheetIndex: 0, cellId: 'A1', before: { value: 'old' }, after: { value: 'new' } }]);

    expect(um.canUndo()).toBe(true);
    um.undo(wb);
    expect(wb.sheets[0].cells['A1'].value).toBe('old');
  });

  it('redo re-applies', () => {
    const wb = createWorkbook();
    const um = new UndoManager();
    wb.sheets[0].cells['A1'] = { value: 'new' };
    um.push([{ sheetIndex: 0, cellId: 'A1', before: { value: 'old' }, after: { value: 'new' } }]);

    um.undo(wb);
    expect(um.canRedo()).toBe(true);
    um.redo(wb);
    expect(wb.sheets[0].cells['A1'].value).toBe('new');
  });

  it('push clears redo stack', () => {
    const um = new UndoManager();
    const wb = createWorkbook();
    um.push([{ sheetIndex: 0, cellId: 'A1', before: undefined, after: { value: '1' } }]);
    um.undo(wb);
    expect(um.canRedo()).toBe(true);
    um.push([{ sheetIndex: 0, cellId: 'A1', before: undefined, after: { value: '2' } }]);
    expect(um.canRedo()).toBe(false);
  });
});
