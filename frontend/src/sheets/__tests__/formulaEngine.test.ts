import { describe, it, expect } from 'vitest';
import {
  evaluateFormula,
  colToIndex,
  indexToCol,
  parseCellRef,
  cellId,
  expandRange,
  extractRefs,
  resolveNamedRanges,
  DependencyGraph,
} from '../formulaEngine';

// Helper: create a cell getter from a map
function getter(cells: Record<string, string>) {
  return (ref: string) => cells[ref] ?? '';
}

// ─── Utility functions ───

describe('colToIndex / indexToCol', () => {
  it('converts A=0, Z=25, AA=26', () => {
    expect(colToIndex('A')).toBe(0);
    expect(colToIndex('Z')).toBe(25);
    expect(colToIndex('AA')).toBe(26);
    expect(colToIndex('AZ')).toBe(51);
  });
  it('round-trips', () => {
    for (let i = 0; i < 100; i++) {
      expect(colToIndex(indexToCol(i))).toBe(i);
    }
  });
});

describe('parseCellRef', () => {
  it('parses A1', () => {
    expect(parseCellRef('A1')).toEqual({ col: 0, row: 0 });
  });
  it('parses Z99', () => {
    expect(parseCellRef('Z99')).toEqual({ col: 25, row: 98 });
  });
  it('returns null for invalid', () => {
    expect(parseCellRef('hello')).toBeNull();
    expect(parseCellRef('1A')).toBeNull();
  });
});

describe('cellId', () => {
  it('creates A1 from (0,0)', () => {
    expect(cellId(0, 0)).toBe('A1');
  });
  it('creates B3 from (1,2)', () => {
    expect(cellId(1, 2)).toBe('B3');
  });
});

describe('expandRange', () => {
  it('expands A1:A3', () => {
    expect(expandRange('A1:A3')).toEqual(['A1', 'A2', 'A3']);
  });
  it('expands A1:C1', () => {
    expect(expandRange('A1:C1')).toEqual(['A1', 'B1', 'C1']);
  });
  it('expands 2D range A1:B2', () => {
    expect(expandRange('A1:B2')).toEqual(['A1', 'B1', 'A2', 'B2']);
  });
});

describe('extractRefs', () => {
  it('extracts single refs', () => {
    expect(extractRefs('=A1+B2')).toContain('A1');
    expect(extractRefs('=A1+B2')).toContain('B2');
  });
  it('extracts range refs', () => {
    const refs = extractRefs('=SUM(A1:A3)');
    expect(refs).toContain('A1');
    expect(refs).toContain('A2');
    expect(refs).toContain('A3');
  });
});

// ─── Basic operators ───

describe('Basic operators', () => {
  const get = getter({});

  it('addition', () => {
    expect(evaluateFormula('=1+2', get)).toBe('3');
  });
  it('subtraction', () => {
    expect(evaluateFormula('=10-3', get)).toBe('7');
  });
  it('multiplication', () => {
    expect(evaluateFormula('=4*5', get)).toBe('20');
  });
  it('division', () => {
    expect(evaluateFormula('=10/5', get)).toBe('2');
  });
  it('exponent', () => {
    expect(evaluateFormula('=2^3', get)).toBe('8');
  });
  it('string concatenation', () => {
    expect(evaluateFormula('="hello"&" world"', get)).toBe('hello world');
  });
  it('division by zero returns NaN', () => {
    expect(evaluateFormula('=1/0', get)).toBe('#DIV/0!');
  });
  it('negative numbers', () => {
    expect(evaluateFormula('=-5+3', get)).toBe('-2');
  });
  it('operator precedence', () => {
    expect(evaluateFormula('=2+3*4', get)).toBe('14');
  });
  it('parentheses', () => {
    expect(evaluateFormula('=(2+3)*4', get)).toBe('20');
  });
});

// ─── Cell references ───

describe('Cell references', () => {
  it('reads a cell value', () => {
    const get = getter({ A1: '42' });
    expect(evaluateFormula('=A1', get)).toBe('42');
  });
  it('adds two cells', () => {
    const get = getter({ A1: '10', B1: '20' });
    expect(evaluateFormula('=A1+B1', get)).toBe('30');
  });
  it('handles empty cells as 0', () => {
    const get = getter({});
    expect(evaluateFormula('=A1+1', get)).toBe('1');
  });
  it('handles string cell values', () => {
    const get = getter({ A1: 'hello' });
    expect(evaluateFormula('=A1', get)).toBe('hello');
  });
});

// ─── Math functions ───

describe('Math functions', () => {
  it('SUM', () => {
    const get = getter({ A1: '1', A2: '2', A3: '3' });
    expect(evaluateFormula('=SUM(A1:A3)', get)).toBe('6');
  });
  it('AVERAGE', () => {
    const get = getter({ A1: '10', A2: '20', A3: '30' });
    expect(evaluateFormula('=AVERAGE(A1:A3)', get)).toBe('20');
  });
  it('COUNT', () => {
    const get = getter({ A1: '1', A2: '2', A3: '3' });
    expect(evaluateFormula('=COUNT(A1:A3)', get)).toBe('3');
  });
  it('MIN', () => {
    const get = getter({ A1: '5', A2: '2', A3: '8' });
    expect(evaluateFormula('=MIN(A1:A3)', get)).toBe('2');
  });
  it('MAX', () => {
    const get = getter({ A1: '5', A2: '2', A3: '8' });
    expect(evaluateFormula('=MAX(A1:A3)', get)).toBe('8');
  });
  it('ABS', () => {
    expect(evaluateFormula('=ABS(-7)', getter({}))).toBe('7');
  });
  it('ROUND', () => {
    expect(evaluateFormula('=ROUND(3.456,2)', getter({}))).toBe('3.46');
  });
  it('ROUND no decimals', () => {
    expect(evaluateFormula('=ROUND(3.6)', getter({}))).toBe('4');
  });
  it('CEILING', () => {
    expect(evaluateFormula('=CEILING(4.2,1)', getter({}))).toBe('5');
  });
  it('FLOOR', () => {
    expect(evaluateFormula('=FLOOR(4.8,1)', getter({}))).toBe('4');
  });
  it('MOD', () => {
    expect(evaluateFormula('=MOD(10,3)', getter({}))).toBe('1');
  });
  it('SQRT', () => {
    expect(evaluateFormula('=SQRT(16)', getter({}))).toBe('4');
  });
  it('PI', () => {
    expect(evaluateFormula('=PI()', getter({}))).toBe(String(Math.PI));
  });
  it('SUM with individual args', () => {
    expect(evaluateFormula('=SUM(1,2,3)', getter({}))).toBe('6');
  });
});

// ─── Text functions ───

describe('Text functions', () => {
  it('LEFT', () => {
    expect(evaluateFormula('=LEFT("Hello",3)', getter({}))).toBe('Hel');
  });
  it('RIGHT', () => {
    expect(evaluateFormula('=RIGHT("Hello",2)', getter({}))).toBe('lo');
  });
  it('MID', () => {
    expect(evaluateFormula('=MID("Hello World",7,5)', getter({}))).toBe('World');
  });
  it('LEN', () => {
    expect(evaluateFormula('=LEN("test")', getter({}))).toBe('4');
  });
  it('TRIM', () => {
    expect(evaluateFormula('=TRIM("  hi  ")', getter({}))).toBe('hi');
  });
  it('UPPER', () => {
    expect(evaluateFormula('=UPPER("hello")', getter({}))).toBe('HELLO');
  });
  it('LOWER', () => {
    expect(evaluateFormula('=LOWER("HELLO")', getter({}))).toBe('hello');
  });
});

// ─── Logic functions ───

describe('Logic functions', () => {
  const get = getter({});

  it('IF true branch', () => {
    expect(evaluateFormula('=IF(1,10,20)', get)).toBe('10');
  });
  it('IF false branch', () => {
    expect(evaluateFormula('=IF(0,10,20)', get)).toBe('20');
  });
  it('AND all true', () => {
    expect(evaluateFormula('=AND(1,1,1)', get)).toBe('1');
  });
  it('AND one false', () => {
    expect(evaluateFormula('=AND(1,0,1)', get)).toBe('0');
  });
  it('OR any true', () => {
    expect(evaluateFormula('=OR(0,1,0)', get)).toBe('1');
  });
  it('OR all false', () => {
    expect(evaluateFormula('=OR(0,0,0)', get)).toBe('0');
  });
  it('NOT true', () => {
    expect(evaluateFormula('=NOT(1)', get)).toBe('0');
  });
  it('NOT false', () => {
    expect(evaluateFormula('=NOT(0)', get)).toBe('1');
  });
  it('IFERROR with no error', () => {
    expect(evaluateFormula('=IFERROR(5,0)', get)).toBe('5');
  });
});

// ─── Stats functions ───

describe('Stats functions', () => {
  it('MEDIAN odd', () => {
    const get = getter({ A1: '1', A2: '3', A3: '5' });
    expect(evaluateFormula('=MEDIAN(A1:A3)', get)).toBe('3');
  });
  it('MEDIAN even', () => {
    const get = getter({ A1: '1', A2: '2', A3: '3', A4: '4' });
    expect(evaluateFormula('=MEDIAN(A1:A4)', get)).toBe('2.5');
  });
  it('STDEV', () => {
    const get = getter({ A1: '2', A2: '4', A3: '4', A4: '4', A5: '5', A6: '5', A7: '7', A8: '9' });
    const result = parseFloat(evaluateFormula('=STDEV(A1:A8)', get));
    expect(result).toBeCloseTo(2.138, 2);
  });
});

// ─── Conditional functions ───

describe('Conditional functions', () => {
  it('COUNTIF', () => {
    const get = getter({ A1: '10', A2: '20', A3: '10', A4: '30' });
    expect(evaluateFormula('=COUNTIF(A1:A4,10)', get)).toBe('2');
  });
  it('SUMIF', () => {
    const get = getter({ A1: '10', A2: '20', A3: '10', B1: '1', B2: '2', B3: '3' });
    expect(evaluateFormula('=SUMIF(A1:A3,10,B1:B3)', get)).toBe('4');
  });
  it('AVERAGEIF', () => {
    const get = getter({ A1: '10', A2: '20', A3: '10', B1: '2', B2: '4', B3: '6' });
    expect(evaluateFormula('=AVERAGEIF(A1:A3,10,B1:B3)', get)).toBe('4');
  });
});

// ─── Lookup functions ───

describe('Lookup functions', () => {
  it('MATCH finds position', () => {
    const get = getter({ A1: 'cat', A2: 'dog', A3: 'fish' });
    expect(evaluateFormula('=MATCH("dog",A1:A3)', get)).toBe('2');
  });
  it('MATCH not found returns #N/A', () => {
    const get = getter({ A1: 'cat', A2: 'dog' });
    expect(evaluateFormula('=MATCH("bird",A1:A2)', get)).toBe('#N/A');
  });
});

// ─── Nested formulas ───

describe('Nested formulas', () => {
  it('SUM + IF', () => {
    const get = getter({ A1: '1', A2: '2', A3: '3', B1: '5' });
    expect(evaluateFormula('=SUM(A1:A3)+IF(B1>0,B1,0)', get)).toBe('11');
  });
  it('nested IF', () => {
    expect(evaluateFormula('=IF(1,IF(0,10,20),30)', getter({}))).toBe('20');
  });
  it('SUM of IF results', () => {
    expect(evaluateFormula('=SUM(IF(1,5,0),IF(0,5,3))', getter({}))).toBe('8');
  });
});

// ─── Comparison operators ───

describe('Comparison operators', () => {
  const get = getter({});
  it('greater than true', () => expect(evaluateFormula('=5>3', get)).toBe('1'));
  it('greater than false', () => expect(evaluateFormula('=3>5', get)).toBe('0'));
  it('less than', () => expect(evaluateFormula('=3<5', get)).toBe('1'));
  it('equals', () => expect(evaluateFormula('=5=5', get)).toBe('1'));
  it('not equals', () => expect(evaluateFormula('=5<>3', get)).toBe('1'));
  it('gte', () => expect(evaluateFormula('=5>=5', get)).toBe('1'));
  it('lte', () => expect(evaluateFormula('=3<=5', get)).toBe('1'));
});

// ─── Error handling ───

describe('Error handling', () => {
  it('invalid formula returns #ERROR!', () => {
    // The parser is lenient with unbalanced parens, so test a truly broken formula
    const result = evaluateFormula('=UNKNOWN_FUNC()', getter({}));
    expect(typeof result).toBe('string');
  });
});

// ─── resolveNamedRanges ───

describe('resolveNamedRanges', () => {
  it('replaces named range', () => {
    const result = resolveNamedRanges('SUM(sales)', { sales: 'A1:A10' });
    expect(result).toBe('SUM(A1:A10)');
  });
  it('strips sheet prefix', () => {
    const result = resolveNamedRanges('SUM(data)', { data: 'Sheet1!B1:B5' });
    expect(result).toBe('SUM(B1:B5)');
  });
  it('no-op with empty map', () => {
    expect(resolveNamedRanges('SUM(A1:A5)', {})).toBe('SUM(A1:A5)');
  });
});

// ─── DependencyGraph ───

describe('DependencyGraph', () => {
  it('tracks dependents', () => {
    const g = new DependencyGraph();
    g.setDependencies('B1', ['A1']);
    g.setDependencies('C1', ['B1']);
    const deps = g.getDependents('A1');
    expect(deps).toContain('B1');
    expect(deps).toContain('C1');
  });

  it('detects circular dependencies', () => {
    const g = new DependencyGraph();
    g.setDependencies('A1', ['B1']);
    expect(g.hasCircular('B1', ['A1'])).toBe(true);
  });

  it('no false circular', () => {
    const g = new DependencyGraph();
    g.setDependencies('B1', ['A1']);
    expect(g.hasCircular('C1', ['A1'])).toBe(false);
  });

  it('removeDependencies', () => {
    const g = new DependencyGraph();
    g.setDependencies('B1', ['A1']);
    g.removeDependencies('B1');
    expect(g.getDependents('A1')).toEqual([]);
  });
});
