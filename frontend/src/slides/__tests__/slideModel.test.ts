import { describe, it, expect } from 'vitest';
import {
  parsePresentation,
  serializePresentation,
  parseFragments,
  createSlide,
  pushUndo,
  undo,
  redo,
} from '../slideModel';

describe('parsePresentation', () => {
  it('parses frontmatter', () => {
    const md = '---\ntitle: My Deck\ntheme: dark\naspectRatio: 16:9\n---\n\n# Hello';
    const pres = parsePresentation(md);
    expect(pres.meta.title).toBe('My Deck');
    expect(pres.meta.theme).toBe('dark');
    expect(pres.meta.aspectRatio).toBe('16:9');
  });

  it('splits slides by --- separator', () => {
    const md = '---\ntitle: T\ntheme: default\naspectRatio: 16:9\n---\n\n# Slide 1\n\n---\n\n# Slide 2\n\n---\n\n# Slide 3';
    const pres = parsePresentation(md);
    expect(pres.slides).toHaveLength(3);
  });

  it('detects title layout from heading', () => {
    const md = '# Big Title';
    const pres = parsePresentation(md);
    expect(pres.slides[0].layout).toBe('title');
  });

  it('detects layout from HTML comment', () => {
    const md = '<!-- slide: two-column -->\n# Columns\n\nContent here';
    const pres = parsePresentation(md);
    expect(pres.slides[0].layout).toBe('two-column');
  });

  it('detects content layout for multi-line slides', () => {
    const md = '# Heading\n\n- Point 1\n- Point 2\n- Point 3\n- Point 4';
    const pres = parsePresentation(md);
    expect(pres.slides[0].layout).toBe('content');
  });

  it('parses speaker notes', () => {
    const md = '# Slide\n\nContent\n\n::: notes\nThese are my notes\n:::';
    const pres = parsePresentation(md);
    expect(pres.slides[0].notes).toBe('These are my notes');
    expect(pres.slides[0].content).not.toContain('::: notes');
  });

  it('parses fragments', () => {
    const md = '# Slide\n\n<!-- fragment: fade-in -->\nItem 1\n<!-- fragment: slide-up -->\nItem 2';
    const pres = parsePresentation(md);
    expect(pres.slides[0].fragments).toHaveLength(2);
    expect(pres.slides[0].fragments[0].type).toBe('fade-in');
    expect(pres.slides[0].fragments[1].type).toBe('slide-up');
  });

  it('creates default slide for empty input', () => {
    const pres = parsePresentation('');
    expect(pres.slides).toHaveLength(1);
    expect(pres.slides[0].content).toContain('New Presentation');
  });

  it('handles no frontmatter', () => {
    const md = '# Just a slide';
    const pres = parsePresentation(md);
    expect(pres.meta.title).toBe('Untitled');
    expect(pres.slides).toHaveLength(1);
  });
});

describe('serializePresentation', () => {
  it('round-trips markdown', () => {
    const md = '---\ntitle: Test\ntheme: default\naspectRatio: 16:9\n---\n\n# Slide 1\n\n---\n\n# Slide 2\n';
    const pres = parsePresentation(md);
    const out = serializePresentation(pres);
    expect(out).toContain('title: Test');
    expect(out).toContain('# Slide 1');
    expect(out).toContain('# Slide 2');
    expect(out).toContain('---');
  });

  it('serializes notes', () => {
    const pres = parsePresentation('# Hi\n\n::: notes\nSpeaker note\n:::');
    const out = serializePresentation(pres);
    expect(out).toContain('::: notes');
    expect(out).toContain('Speaker note');
  });

  it('preserves slide count through round-trip', () => {
    const md = '---\ntitle: T\ntheme: default\naspectRatio: 16:9\n---\n\n# A\n\n---\n\n# B\n\n---\n\n# C\n';
    const pres = parsePresentation(md);
    const out = serializePresentation(pres);
    const pres2 = parsePresentation(out);
    expect(pres2.slides).toHaveLength(3);
  });
});

describe('parseFragments', () => {
  it('parses default fragment type', () => {
    const frags = parseFragments('text <!-- fragment --> more');
    expect(frags).toHaveLength(1);
    expect(frags[0].type).toBe('fade-in');
  });

  it('parses typed fragment', () => {
    const frags = parseFragments('<!-- fragment: zoom-in -->');
    expect(frags[0].type).toBe('zoom-in');
  });

  it('returns empty for no fragments', () => {
    expect(parseFragments('just text')).toEqual([]);
  });
});

describe('createSlide', () => {
  it('creates title slide', () => {
    const s = createSlide('title');
    expect(s.layout).toBe('title');
    expect(s.content).toContain('Title');
    expect(s.id).toMatch(/^slide-/);
  });

  it('creates blank slide', () => {
    const s = createSlide('blank');
    expect(s.layout).toBe('blank');
  });

  it('all layouts create valid slides', () => {
    const layouts = ['title', 'content', 'two-column', 'image', 'section', 'blank'] as const;
    for (const l of layouts) {
      const s = createSlide(l);
      expect(s.layout).toBe(l);
      expect(s.id).toBeTruthy();
    }
  });
});

describe('Undo/Redo', () => {
  it('undo restores previous state', () => {
    let stack = { past: [] as any[], future: [] as any[] };
    const slides1 = [createSlide('title')];
    stack = pushUndo(stack, slides1);
    const slides2 = [createSlide('content')];

    const result = undo(stack, slides2);
    expect(result).not.toBeNull();
    expect(result!.slides).toHaveLength(1);
  });

  it('redo restores undone state', () => {
    let stack = { past: [] as any[], future: [] as any[] };
    const slides1 = [createSlide('title')];
    stack = pushUndo(stack, slides1);
    const slides2 = [createSlide('content')];

    const undoResult = undo(stack, slides2)!;
    const redoResult = redo(undoResult.stack, undoResult.slides);
    expect(redoResult).not.toBeNull();
  });

  it('undo on empty returns null', () => {
    const stack = { past: [] as any[], future: [] as any[] };
    expect(undo(stack, [])).toBeNull();
  });

  it('redo on empty returns null', () => {
    const stack = { past: [] as any[], future: [] as any[] };
    expect(redo(stack, [])).toBeNull();
  });
});
