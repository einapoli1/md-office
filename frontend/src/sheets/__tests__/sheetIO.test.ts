import { describe, it, expect } from 'vitest';
import { exportCSV, importCSV } from '../sheetIO';
import { createEmptySheet } from '../sheetModel';

describe('CSV export', () => {
  it('exports simple values', () => {
    const sheet = createEmptySheet('Test');
    sheet.cells['A1'] = { value: 'Name' };
    sheet.cells['B1'] = { value: 'Age' };
    sheet.cells['A2'] = { value: 'Alice' };
    sheet.cells['B2'] = { value: '30' };

    const csv = exportCSV(sheet);
    expect(csv).toBe('Name,Age\nAlice,30');
  });

  it('escapes commas in values', () => {
    const sheet = createEmptySheet('Test');
    sheet.cells['A1'] = { value: 'hello, world' };

    const csv = exportCSV(sheet);
    expect(csv).toBe('"hello, world"');
  });

  it('escapes quotes in values', () => {
    const sheet = createEmptySheet('Test');
    sheet.cells['A1'] = { value: 'say "hi"' };

    const csv = exportCSV(sheet);
    expect(csv).toBe('"say ""hi"""');
  });

  it('uses computed value for formulas', () => {
    const sheet = createEmptySheet('Test');
    sheet.cells['A1'] = { value: '', formula: '=1+2', computed: '3' };

    const csv = exportCSV(sheet);
    expect(csv).toBe('3');
  });
});

describe('CSV import', () => {
  it('imports simple CSV', () => {
    const sheet = importCSV('Name,Age\nAlice,30');
    expect(sheet.cells['A1'].value).toBe('Name');
    expect(sheet.cells['B1'].value).toBe('Age');
    expect(sheet.cells['A2'].value).toBe('Alice');
    expect(sheet.cells['B2'].value).toBe('30');
  });

  it('handles quoted fields with commas', () => {
    const sheet = importCSV('"hello, world",test');
    expect(sheet.cells['A1'].value).toBe('hello, world');
    expect(sheet.cells['B1'].value).toBe('test');
  });

  it('handles escaped quotes', () => {
    const sheet = importCSV('"say ""hi"""');
    expect(sheet.cells['A1'].value).toBe('say "hi"');
  });

  it('imports formulas', () => {
    const sheet = importCSV('=A1+1');
    expect(sheet.cells['A1'].formula).toBe('=A1+1');
  });
});

describe('CSV round-trip', () => {
  it('export then import preserves data', () => {
    const sheet = createEmptySheet('Test');
    sheet.cells['A1'] = { value: 'hello' };
    sheet.cells['B1'] = { value: '42' };
    sheet.cells['A2'] = { value: 'world' };
    sheet.cells['B2'] = { value: '99' };

    const csv = exportCSV(sheet);
    const sheet2 = importCSV(csv);

    expect(sheet2.cells['A1'].value).toBe('hello');
    expect(sheet2.cells['B1'].value).toBe('42');
    expect(sheet2.cells['A2'].value).toBe('world');
    expect(sheet2.cells['B2'].value).toBe('99');
  });

  it('round-trips values with commas', () => {
    const sheet = createEmptySheet('Test');
    sheet.cells['A1'] = { value: 'a, b' };
    sheet.cells['B1'] = { value: 'c' };

    const csv = exportCSV(sheet);
    const sheet2 = importCSV(csv);
    expect(sheet2.cells['A1'].value).toBe('a, b');
    expect(sheet2.cells['B1'].value).toBe('c');
  });
});
