import { describe, it, expect } from 'vitest';
import { StyleEngine } from '../lib/styleEngine';

describe('StyleEngine', () => {
  it('has built-in styles', () => {
    const engine = new StyleEngine();
    const styles = engine.getAllStyles();
    expect(styles.length).toBeGreaterThan(10);
    expect(styles.find(s => s.name === 'Normal')).toBeDefined();
  });

  it('gets a style by name', () => {
    const engine = new StyleEngine();
    const normal = engine.getStyle('Normal');
    expect(normal).toBeDefined();
    expect(normal!.fontFamily).toContain('Arial');
  });

  it('returns undefined for unknown style', () => {
    const engine = new StyleEngine();
    expect(engine.getStyle('NonExistent')).toBeUndefined();
  });

  it('resolves style inheritance', () => {
    const engine = new StyleEngine();
    const h1 = engine.resolveStyle('Heading 1');
    // Heading 1 is basedOn Normal, should inherit fontFamily
    expect(h1.fontFamily).toBeDefined();
    expect(h1.bold).toBe(true);
    expect(h1.fontSize).toBe('20pt');
  });

  it('resolveStyle falls back to Normal for unknown', () => {
    const engine = new StyleEngine();
    const resolved = engine.resolveStyle('DoesNotExist');
    expect(resolved.name).toBe('Normal');
  });

  it('creates a custom style', () => {
    const engine = new StyleEngine();
    engine.createStyle({ name: 'MyStyle', basedOn: 'Normal', bold: true, category: 'paragraph' });
    expect(engine.getStyle('MyStyle')).toBeDefined();
    expect(engine.getStyle('MyStyle')!.isBuiltIn).toBe(false);
  });

  it('updates an existing style', () => {
    const engine = new StyleEngine();
    engine.updateStyle('Normal', { fontSize: '14pt' });
    expect(engine.getStyle('Normal')!.fontSize).toBe('14pt');
  });

  it('deletes custom styles', () => {
    const engine = new StyleEngine();
    engine.createStyle({ name: 'Temp', category: 'paragraph' });
    expect(engine.deleteStyle('Temp')).toBe(true);
    expect(engine.getStyle('Temp')).toBeUndefined();
  });

  it('cannot delete built-in styles', () => {
    const engine = new StyleEngine();
    expect(engine.deleteStyle('Normal')).toBe(false);
    expect(engine.getStyle('Normal')).toBeDefined();
  });

  it('generates CSS class names', () => {
    expect(StyleEngine.cssClassName('Heading 1')).toBe('doc-style-heading-1');
    expect(StyleEngine.cssClassName('Normal')).toBe('doc-style-normal');
  });

  it('generates CSS stylesheet', () => {
    const engine = new StyleEngine();
    const css = engine.generateCSS();
    expect(css).toContain('.doc-style-normal');
    expect(css).toContain('font-family');
    expect(css).toContain('.doc-style-heading-1');
  });

  it('applies quick style set', () => {
    const engine = new StyleEngine();
    engine.applyQuickStyleSet('Elegant');
    const normal = engine.getStyle('Normal')!;
    expect(normal.fontFamily).toContain('Georgia');
  });

  it('getQuickStyleSets returns sets', () => {
    const engine = new StyleEngine();
    const sets = engine.getQuickStyleSets();
    expect(sets.length).toBeGreaterThanOrEqual(4);
    expect(sets.map(s => s.name)).toContain('Professional');
  });

  it('subscribe notifies on changes', () => {
    const engine = new StyleEngine();
    let called = 0;
    const unsub = engine.subscribe(() => called++);
    engine.updateStyle('Normal', { bold: true });
    expect(called).toBe(1);
    unsub();
    engine.updateStyle('Normal', { bold: false });
    expect(called).toBe(1);
  });

  it('importStyles adds new styles', () => {
    const engine = new StyleEngine();
    engine.importStyles([{ name: 'Imported', fontSize: '18pt', category: 'paragraph' }]);
    expect(engine.getStyle('Imported')).toBeDefined();
  });

  it('resolves deep inheritance chain', () => {
    const engine = new StyleEngine();
    // TOC Heading -> basedOn Heading 1 -> basedOn Normal
    const toc = engine.resolveStyle('TOC Heading');
    expect(toc.fontFamily).toBeDefined();
    expect(toc.bold).toBe(true);
  });

  it('serializes custom styles to frontmatter', () => {
    const engine = new StyleEngine();
    engine.createStyle({ name: 'Custom', basedOn: 'Normal', bold: true, color: '#ff0000', category: 'paragraph' });
    const fm = engine.serializeToFrontmatter();
    expect(fm).toContain('Custom:');
    expect(fm).toContain('bold: true');
  });

  it('CSS includes style properties from resolved styles', () => {
    const engine = new StyleEngine();
    const css = engine.generateCSS();
    expect(css).toContain('font-weight: bold'); // from Heading 1
    expect(css).toContain('text-align: center'); // from Title
  });
});
