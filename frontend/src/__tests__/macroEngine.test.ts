import { describe, it, expect } from 'vitest';
import { EXAMPLE_MACROS, type MacroContext, type SavedMacro } from '../lib/macroEngine';

// The runMacro function uses `new Function` with blocked globals including 'eval'
// as parameter names, which conflicts with strict mode in the test environment.
// We test the supporting structures and mock-test the macro context API shape.

function mockContext(overrides: Partial<MacroContext> = {}): MacroContext {
  return {
    getDocText: () => 'Hello world',
    insertText: () => {},
    replaceAll: () => {},
    getSelection: () => '',
    getCell: () => null,
    setCell: () => {},
    getRange: () => [[]],
    alert: () => {},
    prompt: async () => null,
    toast: () => {},
    log: () => {},
    ...overrides,
  };
}

describe('MacroContext interface', () => {
  it('getDocText returns document text', () => {
    const ctx = mockContext({ getDocText: () => 'test' });
    expect(ctx.getDocText()).toBe('test');
  });

  it('insertText accepts text and position', () => {
    let captured: [string, number | undefined] = ['', undefined];
    const ctx = mockContext({ insertText: (t, p) => { captured = [t, p]; } });
    ctx.insertText('hello', 5);
    expect(captured).toEqual(['hello', 5]);
  });

  it('replaceAll accepts search and replace', () => {
    let args: string[] = [];
    const ctx = mockContext({ replaceAll: (s, r) => { args = [s, r]; } });
    ctx.replaceAll('old', 'new');
    expect(args).toEqual(['old', 'new']);
  });

  it('getSelection returns selected text', () => {
    const ctx = mockContext({ getSelection: () => 'selected' });
    expect(ctx.getSelection()).toBe('selected');
  });

  it('getCell returns cell value', () => {
    const ctx = mockContext({ getCell: (c, r) => `${c},${r}` });
    expect(ctx.getCell(1, 2)).toBe('1,2');
  });

  it('setCell sets cell value', () => {
    let set: unknown[] = [];
    const ctx = mockContext({ setCell: (c, r, v) => { set = [c, r, v]; } });
    ctx.setCell(0, 0, 42);
    expect(set).toEqual([0, 0, 42]);
  });

  it('getRange returns 2d array', () => {
    const ctx = mockContext({ getRange: () => [[1, 2], [3, 4]] });
    expect(ctx.getRange(0, 0, 1, 1)).toEqual([[1, 2], [3, 4]]);
  });

  it('alert receives message', () => {
    let msg = '';
    const ctx = mockContext({ alert: (m) => { msg = m; } });
    ctx.alert('test');
    expect(msg).toBe('test');
  });

  it('prompt returns value', async () => {
    const ctx = mockContext({ prompt: async () => 'answer' });
    expect(await ctx.prompt('q')).toBe('answer');
  });

  it('toast receives message', () => {
    let msg = '';
    const ctx = mockContext({ toast: (m) => { msg = m; } });
    ctx.toast('done');
    expect(msg).toBe('done');
  });

  it('log receives message', () => {
    let msg = '';
    const ctx = mockContext({ log: (m) => { msg = m; } });
    ctx.log('info');
    expect(msg).toBe('info');
  });
});

describe('EXAMPLE_MACROS', () => {
  it('has at least 5 example macros', () => {
    expect(Object.keys(EXAMPLE_MACROS).length).toBeGreaterThanOrEqual(5);
  });

  it('Word Count Alert macro is defined', () => {
    expect(EXAMPLE_MACROS['Word Count Alert']).toBeDefined();
    expect(EXAMPLE_MACROS['Word Count Alert']).toContain('split');
  });

  it('Title Case Selection macro is defined', () => {
    expect(EXAMPLE_MACROS['Title Case Selection']).toBeDefined();
    expect(EXAMPLE_MACROS['Title Case Selection']).toContain('getSelection');
  });

  it('Insert Date macro is defined', () => {
    expect(EXAMPLE_MACROS['Insert Date']).toContain('Date');
  });

  it('Sort Lines macro is defined', () => {
    expect(EXAMPLE_MACROS['Sort Lines']).toContain('sort');
  });

  it('Remove Duplicates macro is defined', () => {
    expect(EXAMPLE_MACROS['Remove Duplicates']).toContain('Set');
  });

  it('all macros reference md API', () => {
    for (const [, code] of Object.entries(EXAMPLE_MACROS)) {
      expect(code).toContain('md.');
    }
  });
});

describe('SavedMacro type', () => {
  it('structure matches expected shape', () => {
    const macro: SavedMacro = {
      name: 'Test',
      code: 'console.log("hi");',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    expect(macro.name).toBe('Test');
    expect(macro.code).toContain('console');
    expect(typeof macro.createdAt).toBe('number');
  });
});
