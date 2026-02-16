import { describe, it, expect } from 'vitest';
import { detectPattern, generateFill, adjustFormula } from '../fillLogic';

describe('detectPattern', () => {
  it('detects number sequence', () => {
    const p = detectPattern(['1', '2', '3']);
    expect(p.type).toBe('number');
    expect(p.increment).toBe(1);
  });

  it('detects number sequence with step 5', () => {
    const p = detectPattern(['10', '15', '20']);
    expect(p.type).toBe('number');
    expect(p.increment).toBe(5);
  });

  it('detects single number', () => {
    const p = detectPattern(['5']);
    expect(p.type).toBe('number');
    expect(p.increment).toBe(1);
  });

  it('detects formula pattern', () => {
    const p = detectPattern(['=A1', '=A2']);
    expect(p.type).toBe('formula');
  });

  it('detects month pattern (short)', () => {
    const p = detectPattern(['Jan', 'Feb', 'Mar']);
    expect(p.type).toBe('date');
  });

  it('detects month pattern (long)', () => {
    const p = detectPattern(['January', 'February', 'March']);
    expect(p.type).toBe('date');
  });

  it('detects day pattern', () => {
    const p = detectPattern(['Mon', 'Tue', 'Wed']);
    expect(p.type).toBe('date');
  });

  it('falls back to copy for mixed content', () => {
    const p = detectPattern(['a', 'b', 'c']);
    expect(p.type).toBe('copy');
  });

  it('empty input', () => {
    const p = detectPattern([]);
    expect(p.type).toBe('copy');
  });
});

describe('generateFill', () => {
  it('extends number sequence 1,2,3 → 4,5,6', () => {
    const p = detectPattern(['1', '2', '3']);
    const filled = generateFill(p, 3);
    expect(filled).toEqual(['4', '5', '6']);
  });

  it('extends number sequence with decimals', () => {
    const p = detectPattern(['1.0', '2.0', '3.0']);
    const filled = generateFill(p, 2);
    expect(filled).toEqual(['4.0', '5.0']);
  });

  it('extends month sequence', () => {
    const p = detectPattern(['Jan', 'Feb', 'Mar']);
    const filled = generateFill(p, 3);
    expect(filled).toEqual(['Apr', 'May', 'Jun']);
  });

  it('wraps month sequence around year', () => {
    const p = detectPattern(['Nov', 'Dec']);
    const filled = generateFill(p, 2);
    expect(filled).toEqual(['Jan', 'Feb']);
  });

  it('copy pattern repeats', () => {
    const p = detectPattern(['a', 'b']);
    const filled = generateFill(p, 4);
    expect(filled).toEqual(['a', 'b', 'a', 'b']);
  });

  it('returns empty for count 0', () => {
    const p = detectPattern(['1', '2']);
    expect(generateFill(p, 0)).toEqual([]);
  });
});

describe('adjustFormula', () => {
  it('adjusts row references down', () => {
    expect(adjustFormula('=A1+B1', 1, 0)).toBe('=A2+B2');
  });

  it('adjusts column references right', () => {
    expect(adjustFormula('=A1+A2', 0, 1)).toBe('=B1+B2');
  });

  it('preserves $A$1 absolute references', () => {
    expect(adjustFormula('=$A$1+B1', 1, 0)).toBe('=$A$1+B2');
  });

  it('preserves $A (absolute col) but adjusts row', () => {
    expect(adjustFormula('=$A1', 1, 0)).toBe('=$A2');
  });

  it('preserves A$1 (absolute row) but adjusts col', () => {
    expect(adjustFormula('=A$1', 0, 1)).toBe('=B$1');
  });

  it('adjusts both row and col', () => {
    expect(adjustFormula('=A1', 2, 3)).toBe('=D3');
  });

  it('handles complex formulas', () => {
    expect(adjustFormula('=SUM(A1:A3)+$B$1', 1, 0)).toBe('=SUM(A2:A4)+$B$1');
  });
});
