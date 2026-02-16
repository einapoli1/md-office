import { describe, it, expect } from 'vitest';
import { LAYOUTS, getLayout } from '../slideLayouts';

describe('Slide layouts', () => {
  const expectedLayouts = ['title', 'content', 'two-column', 'image', 'section', 'blank'];

  it('has all expected layouts', () => {
    const names = LAYOUTS.map(l => l.name);
    for (const expected of expectedLayouts) {
      expect(names).toContain(expected);
    }
  });

  LAYOUTS.forEach(layout => {
    describe(`layout: ${layout.name}`, () => {
      it('has required fields', () => {
        expect(layout.name).toBeTruthy();
        expect(layout.label).toBeTruthy();
        expect(layout.description).toBeTruthy();
        expect(layout.icon).toBeTruthy();
      });
    });
  });

  it('getLayout returns correct layout', () => {
    expect(getLayout('title').name).toBe('title');
    expect(getLayout('blank').name).toBe('blank');
  });

  it('getLayout falls back to content for unknown', () => {
    expect(getLayout('nonexistent' as any).name).toBe('content');
  });
});
