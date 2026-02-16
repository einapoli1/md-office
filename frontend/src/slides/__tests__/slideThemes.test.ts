import { describe, it, expect } from 'vitest';
import { THEMES, getTheme } from '../slideThemes';

const REQUIRED_VARS = [
  '--slide-bg',
  '--slide-text',
  '--slide-accent',
  '--slide-heading-font',
  '--slide-body-font',
  '--slide-heading-color',
];

describe('Slide themes', () => {
  it('has at least 2 themes', () => {
    expect(THEMES.length).toBeGreaterThanOrEqual(2);
  });

  THEMES.forEach(theme => {
    describe(`theme: ${theme.id}`, () => {
      it('has id and name', () => {
        expect(theme.id).toBeTruthy();
        expect(theme.name).toBeTruthy();
      });

      REQUIRED_VARS.forEach(varName => {
        it(`has CSS variable ${varName}`, () => {
          expect(theme.vars[varName]).toBeTruthy();
        });
      });
    });
  });

  it('getTheme returns correct theme', () => {
    const dark = getTheme('dark');
    expect(dark.id).toBe('dark');
  });

  it('getTheme falls back to first theme for unknown id', () => {
    const fallback = getTheme('nonexistent');
    expect(fallback.id).toBe(THEMES[0].id);
  });
});
