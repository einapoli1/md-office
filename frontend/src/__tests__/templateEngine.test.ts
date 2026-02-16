import { describe, it, expect } from 'vitest';
import { extractVariables, renderTemplate, parseCSV } from '../lib/templateEngine';

describe('extractVariables', () => {
  it('extracts simple variables', () => {
    expect(extractVariables('Hello {{name}}')).toEqual(['name']);
  });
  it('extracts multiple unique variables', () => {
    const vars = extractVariables('{{first}} {{last}} {{first}}');
    expect(vars).toEqual(['first', 'last']);
  });
  it('ignores block keywords', () => {
    const vars = extractVariables('{{#each items}}{{name}}{{/each}}');
    expect(vars).toEqual(['name']);
  });
  it('handles dotted paths', () => {
    expect(extractVariables('{{address.city}}')).toEqual(['address.city']);
  });
  it('returns empty for no variables', () => {
    expect(extractVariables('plain text')).toEqual([]);
  });
});

describe('renderTemplate', () => {
  it('replaces simple variables', () => {
    expect(renderTemplate('Hello {{name}}!', { name: 'World' })).toBe('Hello World!');
  });
  it('replaces missing variables with empty string', () => {
    expect(renderTemplate('Hello {{name}}!', {})).toBe('Hello !');
  });
  it('resolves nested dot paths', () => {
    expect(renderTemplate('{{a.b}}', { a: { b: 'deep' } })).toBe('deep');
  });
  it('renders numbers', () => {
    expect(renderTemplate('Count: {{n}}', { n: 42 })).toBe('Count: 42');
  });

  describe('#each loops', () => {
    it('iterates over arrays of objects', () => {
      const tpl = '{{#each items}}{{name}} {{/each}}';
      const result = renderTemplate(tpl, { items: [{ name: 'A' }, { name: 'B' }] });
      expect(result).toBe('A B ');
    });
    it('returns empty for non-array', () => {
      expect(renderTemplate('{{#each x}}hi{{/each}}', { x: 'nope' })).toBe('');
    });
    it('provides this for primitive items', () => {
      const tpl = '{{#each items}}{{this}}{{/each}}';
      expect(renderTemplate(tpl, { items: ['a', 'b', 'c'] })).toBe('abc');
    });
  });

  describe('#if conditionals', () => {
    it('renders truthy branch', () => {
      expect(renderTemplate('{{#if show}}yes{{/if}}', { show: true })).toBe('yes');
    });
    it('renders else branch when falsy', () => {
      expect(renderTemplate('{{#if show}}yes{{else}}no{{/if}}', { show: false })).toBe('no');
    });
    it('treats empty string as falsy', () => {
      expect(renderTemplate('{{#if val}}yes{{else}}no{{/if}}', { val: '' })).toBe('no');
    });
    it('treats non-empty string as truthy', () => {
      expect(renderTemplate('{{#if val}}yes{{/if}}', { val: 'hi' })).toBe('yes');
    });
    it('treats empty array as falsy', () => {
      expect(renderTemplate('{{#if arr}}yes{{else}}no{{/if}}', { arr: [] })).toBe('no');
    });
  });
});

describe('parseCSV', () => {
  it('parses simple CSV', () => {
    const rows = parseCSV('name,age\nAlice,30\nBob,25');
    expect(rows).toEqual([{ name: 'Alice', age: '30' }, { name: 'Bob', age: '25' }]);
  });
  it('handles quoted fields with commas', () => {
    const rows = parseCSV('name,address\nAlice,"123 Main St, Apt 4"');
    expect(rows[0].address).toBe('123 Main St, Apt 4');
  });
  it('handles escaped quotes', () => {
    const rows = parseCSV('val\n"say ""hello"""');
    expect(rows[0].val).toBe('say "hello"');
  });
  it('returns empty for header-only CSV', () => {
    expect(parseCSV('name,age')).toEqual([]);
  });
  it('returns empty for empty input', () => {
    expect(parseCSV('')).toEqual([]);
  });
  it('skips blank lines', () => {
    const rows = parseCSV('a\n1\n\n2');
    expect(rows).toHaveLength(2);
  });
});
