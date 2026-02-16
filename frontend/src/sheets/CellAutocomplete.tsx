// Cell Autocomplete — dropdown suggestions when typing in cells

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

export interface FunctionInfo {
  name: string;
  desc: string;
  syntax: string;
  params?: { name: string; desc: string }[];
}

// All spreadsheet functions with signatures
export const ALL_FUNCTIONS: FunctionInfo[] = [
  // Math
  { name: 'SUM', desc: 'Sum of values', syntax: 'SUM(range)', params: [{ name: 'range', desc: 'Range of cells to sum' }] },
  { name: 'AVERAGE', desc: 'Average of values', syntax: 'AVERAGE(range)', params: [{ name: 'range', desc: 'Range of cells to average' }] },
  { name: 'COUNT', desc: 'Count of numbers', syntax: 'COUNT(range)', params: [{ name: 'range', desc: 'Range of cells to count' }] },
  { name: 'MIN', desc: 'Minimum value', syntax: 'MIN(range)', params: [{ name: 'range', desc: 'Range of cells' }] },
  { name: 'MAX', desc: 'Maximum value', syntax: 'MAX(range)', params: [{ name: 'range', desc: 'Range of cells' }] },
  { name: 'ABS', desc: 'Absolute value', syntax: 'ABS(number)', params: [{ name: 'number', desc: 'Number to get absolute value of' }] },
  { name: 'ROUND', desc: 'Round number', syntax: 'ROUND(number, digits)', params: [{ name: 'number', desc: 'Number to round' }, { name: 'digits', desc: 'Decimal places' }] },
  { name: 'CEILING', desc: 'Round up to multiple', syntax: 'CEILING(number, significance)', params: [{ name: 'number', desc: 'Number to round up' }, { name: 'significance', desc: 'Multiple to round to' }] },
  { name: 'FLOOR', desc: 'Round down to multiple', syntax: 'FLOOR(number, significance)', params: [{ name: 'number', desc: 'Number to round down' }, { name: 'significance', desc: 'Multiple to round to' }] },
  { name: 'MOD', desc: 'Remainder', syntax: 'MOD(number, divisor)', params: [{ name: 'number', desc: 'Dividend' }, { name: 'divisor', desc: 'Divisor' }] },
  { name: 'POWER', desc: 'Power', syntax: 'POWER(base, exponent)', params: [{ name: 'base', desc: 'Base number' }, { name: 'exponent', desc: 'Exponent' }] },
  { name: 'SQRT', desc: 'Square root', syntax: 'SQRT(number)', params: [{ name: 'number', desc: 'Number' }] },
  { name: 'LOG', desc: 'Logarithm', syntax: 'LOG(number, base)', params: [{ name: 'number', desc: 'Positive number' }, { name: 'base', desc: 'Base (default 10)' }] },
  { name: 'LN', desc: 'Natural logarithm', syntax: 'LN(number)', params: [{ name: 'number', desc: 'Positive number' }] },
  { name: 'PI', desc: 'Pi constant', syntax: 'PI()', params: [] },
  { name: 'RAND', desc: 'Random number 0-1', syntax: 'RAND()', params: [] },
  { name: 'RANDBETWEEN', desc: 'Random integer', syntax: 'RANDBETWEEN(low, high)', params: [{ name: 'low', desc: 'Minimum value' }, { name: 'high', desc: 'Maximum value' }] },
  // Date/Time
  { name: 'NOW', desc: 'Current date/time', syntax: 'NOW()', params: [] },
  { name: 'TODAY', desc: 'Current date', syntax: 'TODAY()', params: [] },
  { name: 'DATE', desc: 'Create date', syntax: 'DATE(year, month, day)', params: [{ name: 'year', desc: 'Year' }, { name: 'month', desc: 'Month (1-12)' }, { name: 'day', desc: 'Day (1-31)' }] },
  { name: 'YEAR', desc: 'Year from date', syntax: 'YEAR(date)', params: [{ name: 'date', desc: 'Date value' }] },
  { name: 'MONTH', desc: 'Month from date', syntax: 'MONTH(date)', params: [{ name: 'date', desc: 'Date value' }] },
  { name: 'DAY', desc: 'Day from date', syntax: 'DAY(date)', params: [{ name: 'date', desc: 'Date value' }] },
  { name: 'DATEDIF', desc: 'Difference between dates', syntax: 'DATEDIF(start, end, unit)', params: [{ name: 'start', desc: 'Start date' }, { name: 'end', desc: 'End date' }, { name: 'unit', desc: '"Y","M","D"' }] },
  { name: 'WEEKDAY', desc: 'Day of week', syntax: 'WEEKDAY(date)', params: [{ name: 'date', desc: 'Date value' }] },
  { name: 'EOMONTH', desc: 'End of month', syntax: 'EOMONTH(start, months)', params: [{ name: 'start', desc: 'Start date' }, { name: 'months', desc: 'Months to add' }] },
  // Logic
  { name: 'IF', desc: 'Conditional', syntax: 'IF(condition, true_val, false_val)', params: [{ name: 'condition', desc: 'Logical test' }, { name: 'true_val', desc: 'Value if true' }, { name: 'false_val', desc: 'Value if false' }] },
  { name: 'AND', desc: 'All conditions true', syntax: 'AND(cond1, cond2, ...)', params: [{ name: 'cond1', desc: 'First condition' }, { name: 'cond2', desc: 'Second condition' }] },
  { name: 'OR', desc: 'Any condition true', syntax: 'OR(cond1, cond2, ...)', params: [{ name: 'cond1', desc: 'First condition' }, { name: 'cond2', desc: 'Second condition' }] },
  { name: 'NOT', desc: 'Negate condition', syntax: 'NOT(condition)', params: [{ name: 'condition', desc: 'Logical value' }] },
  { name: 'IFERROR', desc: 'Handle errors', syntax: 'IFERROR(value, error_val)', params: [{ name: 'value', desc: 'Value to check' }, { name: 'error_val', desc: 'Value if error' }] },
  { name: 'ISBLANK', desc: 'Check if blank', syntax: 'ISBLANK(cell)', params: [{ name: 'cell', desc: 'Cell reference' }] },
  { name: 'ISNA', desc: 'Check if N/A', syntax: 'ISNA(value)', params: [{ name: 'value', desc: 'Value to check' }] },
  // Text
  { name: 'CONCATENATE', desc: 'Join text', syntax: 'CONCATENATE(text1, text2, ...)', params: [{ name: 'text1', desc: 'First text' }, { name: 'text2', desc: 'Second text' }] },
  { name: 'LEFT', desc: 'Left characters', syntax: 'LEFT(text, count)', params: [{ name: 'text', desc: 'Text string' }, { name: 'count', desc: 'Number of characters' }] },
  { name: 'RIGHT', desc: 'Right characters', syntax: 'RIGHT(text, count)', params: [{ name: 'text', desc: 'Text string' }, { name: 'count', desc: 'Number of characters' }] },
  { name: 'MID', desc: 'Middle characters', syntax: 'MID(text, start, count)', params: [{ name: 'text', desc: 'Text string' }, { name: 'start', desc: 'Start position' }, { name: 'count', desc: 'Number of characters' }] },
  { name: 'LEN', desc: 'Text length', syntax: 'LEN(text)', params: [{ name: 'text', desc: 'Text string' }] },
  { name: 'TRIM', desc: 'Remove extra spaces', syntax: 'TRIM(text)', params: [{ name: 'text', desc: 'Text string' }] },
  { name: 'UPPER', desc: 'To uppercase', syntax: 'UPPER(text)', params: [{ name: 'text', desc: 'Text string' }] },
  { name: 'LOWER', desc: 'To lowercase', syntax: 'LOWER(text)', params: [{ name: 'text', desc: 'Text string' }] },
  { name: 'PROPER', desc: 'Title case', syntax: 'PROPER(text)', params: [{ name: 'text', desc: 'Text string' }] },
  { name: 'FIND', desc: 'Find text position', syntax: 'FIND(find_text, text, start)', params: [{ name: 'find_text', desc: 'Text to find' }, { name: 'text', desc: 'Text to search in' }, { name: 'start', desc: 'Start position (optional)' }] },
  { name: 'SUBSTITUTE', desc: 'Replace text', syntax: 'SUBSTITUTE(text, old, new, instance)', params: [{ name: 'text', desc: 'Original text' }, { name: 'old', desc: 'Text to replace' }, { name: 'new', desc: 'Replacement text' }, { name: 'instance', desc: 'Which occurrence (optional)' }] },
  { name: 'TEXT', desc: 'Format as text', syntax: 'TEXT(value, format)', params: [{ name: 'value', desc: 'Value to format' }, { name: 'format', desc: 'Format string' }] },
  // Lookup
  { name: 'VLOOKUP', desc: 'Vertical lookup', syntax: 'VLOOKUP(key, range, col, exact)', params: [{ name: 'key', desc: 'Lookup value' }, { name: 'range', desc: 'Table range' }, { name: 'col', desc: 'Column index' }, { name: 'exact', desc: 'Exact match (TRUE/FALSE)' }] },
  { name: 'HLOOKUP', desc: 'Horizontal lookup', syntax: 'HLOOKUP(key, range, row, exact)', params: [{ name: 'key', desc: 'Lookup value' }, { name: 'range', desc: 'Table range' }, { name: 'row', desc: 'Row index' }, { name: 'exact', desc: 'Exact match (TRUE/FALSE)' }] },
  { name: 'INDEX', desc: 'Get value by position', syntax: 'INDEX(range, row, col)', params: [{ name: 'range', desc: 'Cell range' }, { name: 'row', desc: 'Row number' }, { name: 'col', desc: 'Column number' }] },
  { name: 'MATCH', desc: 'Find position', syntax: 'MATCH(value, range, type)', params: [{ name: 'value', desc: 'Lookup value' }, { name: 'range', desc: 'Range to search' }, { name: 'type', desc: 'Match type (0=exact)' }] },
  // Conditional
  { name: 'COUNTIF', desc: 'Count with condition', syntax: 'COUNTIF(range, criteria)', params: [{ name: 'range', desc: 'Range to check' }, { name: 'criteria', desc: 'Condition' }] },
  { name: 'SUMIF', desc: 'Sum with condition', syntax: 'SUMIF(range, criteria, sum_range)', params: [{ name: 'range', desc: 'Range to check' }, { name: 'criteria', desc: 'Condition' }, { name: 'sum_range', desc: 'Range to sum' }] },
  { name: 'AVERAGEIF', desc: 'Average with condition', syntax: 'AVERAGEIF(range, criteria, avg_range)', params: [{ name: 'range', desc: 'Range to check' }, { name: 'criteria', desc: 'Condition' }, { name: 'avg_range', desc: 'Range to average' }] },
  { name: 'COUNTIFS', desc: 'Count with multiple conditions', syntax: 'COUNTIFS(range1, criteria1, ...)', params: [{ name: 'range1', desc: 'First range' }, { name: 'criteria1', desc: 'First condition' }] },
  { name: 'SUMIFS', desc: 'Sum with multiple conditions', syntax: 'SUMIFS(sum_range, range1, criteria1, ...)', params: [{ name: 'sum_range', desc: 'Range to sum' }, { name: 'range1', desc: 'First range' }, { name: 'criteria1', desc: 'First condition' }] },
  // Stats
  { name: 'MEDIAN', desc: 'Median value', syntax: 'MEDIAN(range)', params: [{ name: 'range', desc: 'Range of values' }] },
  { name: 'STDEV', desc: 'Standard deviation', syntax: 'STDEV(range)', params: [{ name: 'range', desc: 'Range of values' }] },
  { name: 'VAR', desc: 'Variance', syntax: 'VAR(range)', params: [{ name: 'range', desc: 'Range of values' }] },
  { name: 'LARGE', desc: 'Kth largest value', syntax: 'LARGE(range, k)', params: [{ name: 'range', desc: 'Range of values' }, { name: 'k', desc: 'Rank position' }] },
  { name: 'SMALL', desc: 'Kth smallest value', syntax: 'SMALL(range, k)', params: [{ name: 'range', desc: 'Range of values' }, { name: 'k', desc: 'Rank position' }] },
  { name: 'RANK', desc: 'Rank of value', syntax: 'RANK(number, range, order)', params: [{ name: 'number', desc: 'Value to rank' }, { name: 'range', desc: 'Range of values' }, { name: 'order', desc: '0=descending, 1=ascending' }] },
  // Special
  { name: 'LATEX', desc: 'LaTeX formula', syntax: 'LATEX(expression)', params: [{ name: 'expression', desc: 'LaTeX math expression' }] },
  { name: 'SPARKLINE', desc: 'Inline chart', syntax: 'SPARKLINE(range, type, color)', params: [{ name: 'range', desc: 'Data range' }, { name: 'type', desc: 'Chart type (line/bar/area)' }, { name: 'color', desc: 'Color' }] },
  // Array functions
  { name: 'ARRAYFORMULA', desc: 'Apply formula across range', syntax: 'ARRAYFORMULA(formula)', params: [{ name: 'formula', desc: 'Formula to apply as array' }] },
  { name: 'UNIQUE', desc: 'Unique values from range', syntax: 'UNIQUE(range)', params: [{ name: 'range', desc: 'Range to deduplicate' }] },
  { name: 'SORT', desc: 'Sort range values', syntax: 'SORT(range, col, ascending)', params: [{ name: 'range', desc: 'Range to sort' }, { name: 'col', desc: 'Column to sort by' }, { name: 'ascending', desc: '1=ascending, 0=descending' }] },
  { name: 'FILTER', desc: 'Filter rows by condition', syntax: 'FILTER(range, cond_range, criteria)', params: [{ name: 'range', desc: 'Data range' }, { name: 'cond_range', desc: 'Condition range' }, { name: 'criteria', desc: 'Filter criteria' }] },
  { name: 'TRANSPOSE', desc: 'Flip rows and columns', syntax: 'TRANSPOSE(range)', params: [{ name: 'range', desc: 'Range to transpose' }] },
  { name: 'FLATTEN', desc: 'Flatten 2D range to 1D', syntax: 'FLATTEN(range)', params: [{ name: 'range', desc: 'Range to flatten' }] },
  { name: 'SEQUENCE', desc: 'Generate number sequence', syntax: 'SEQUENCE(rows, cols, start, step)', params: [{ name: 'rows', desc: 'Number of rows' }, { name: 'cols', desc: 'Number of columns' }, { name: 'start', desc: 'Starting value' }, { name: 'step', desc: 'Step increment' }] },
  { name: 'MAP', desc: 'Apply operation to range', syntax: 'MAP(range, operation)', params: [{ name: 'range', desc: 'Input range' }, { name: 'operation', desc: 'Operation to apply' }] },
  { name: 'REDUCE', desc: 'Reduce range to single value', syntax: 'REDUCE(initial, range, operation)', params: [{ name: 'initial', desc: 'Initial accumulator value' }, { name: 'range', desc: 'Input range' }, { name: 'operation', desc: 'Operation (SUM, PRODUCT, MAX, MIN)' }] },
];

// Fuzzy match: check if all chars of query appear in order in target
function fuzzyMatch(query: string, target: string): { match: boolean; score: number } {
  const q = query.toUpperCase();
  const t = target.toUpperCase();
  if (t.startsWith(q)) return { match: true, score: 100 };
  if (t.includes(q)) return { match: true, score: 80 };
  let qi = 0;
  let score = 0;
  let prevIdx = -1;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += (ti === prevIdx + 1) ? 10 : 5; // consecutive chars score higher
      prevIdx = ti;
      qi++;
    }
  }
  if (qi === q.length) return { match: true, score };
  return { match: false, score: 0 };
}

interface CellAutocompleteProps {
  value: string;
  columnValues: string[];      // existing values in this column
  recentValues?: string[];     // recently used values
  anchorRect: { top: number; left: number; width: number; height: number };
  onSelect: (value: string) => void;
  onDismiss: () => void;
}

export default function CellAutocomplete({ value, columnValues, recentValues = [], anchorRect, onSelect, onDismiss }: CellAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const isFormula = value.startsWith('=');

  const suggestions = useMemo(() => {
    if (isFormula) {
      // Extract the function name being typed after the last ( or = or ,
      const afterEquals = value.slice(1);
      const lastSep = Math.max(afterEquals.lastIndexOf('('), afterEquals.lastIndexOf(','), afterEquals.lastIndexOf('+'), afterEquals.lastIndexOf('-'), afterEquals.lastIndexOf('*'), afterEquals.lastIndexOf('/'));
      const partial = (lastSep >= 0 ? afterEquals.slice(lastSep + 1) : afterEquals).trim().toUpperCase();
      if (!partial) return [];

      // Check if partial looks like a cell ref (letter+digit) — don't suggest functions
      if (/^[A-Z]+\d+$/.test(partial)) return [];

      return ALL_FUNCTIONS
        .map(f => ({ ...f, ...fuzzyMatch(partial, f.name) }))
        .filter(f => f.match)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map(f => ({ type: 'function' as const, label: f.name, detail: f.syntax, desc: f.desc }));
    } else {
      // Value autocomplete
      if (!value) return [];
      const upper = value.toUpperCase();

      // Deduplicate and collect unique matches
      const seen = new Set<string>();
      const results: { type: 'recent' | 'column'; label: string; detail: string; desc: string }[] = [];

      // Recent values first
      for (const rv of recentValues) {
        if (!seen.has(rv) && rv.toUpperCase().includes(upper) && rv !== value) {
          seen.add(rv);
          results.push({ type: 'recent', label: rv, detail: '⏱ Recent', desc: '' });
        }
      }

      // Column values
      for (const cv of columnValues) {
        if (!seen.has(cv) && cv.toUpperCase().includes(upper) && cv !== value) {
          seen.add(cv);
          results.push({ type: 'column', label: cv, detail: '', desc: '' });
        }
      }

      return results.slice(0, 10);
    }
  }, [value, isFormula, columnValues, recentValues]);

  // Reset selection when suggestions change
  useEffect(() => {
    setSelectedIndex(0);
  }, [suggestions.length]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const item = listRef.current.children[selectedIndex] as HTMLElement | undefined;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      setSelectedIndex(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Tab' || e.key === 'Enter') {
      if (suggestions.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        const s = suggestions[selectedIndex];
        if (s.type === 'function') {
          // Insert function: replace partial with function name + opening paren
          const afterEquals = value.slice(1);
          const lastSep = Math.max(afterEquals.lastIndexOf('('), afterEquals.lastIndexOf(','), afterEquals.lastIndexOf('+'), afterEquals.lastIndexOf('-'), afterEquals.lastIndexOf('*'), afterEquals.lastIndexOf('/'));
          const prefix = lastSep >= 0 ? '=' + afterEquals.slice(0, lastSep + 1) : '=';
          onSelect(prefix + s.label + '(');
        } else {
          onSelect(s.label);
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onDismiss();
    }
  }, [suggestions, selectedIndex, value, onSelect, onDismiss]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);

  if (suggestions.length === 0) return null;

  return (
    <div
      className="cell-autocomplete-dropdown"
      style={{
        position: 'absolute',
        top: anchorRect.top + anchorRect.height,
        left: anchorRect.left,
        minWidth: Math.max(anchorRect.width, 250),
        maxHeight: 240,
        overflowY: 'auto',
        background: '#fff',
        border: '1px solid #d0d0d0',
        borderRadius: 4,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 1100,
        fontSize: 12,
      }}
      ref={listRef}
    >
      {suggestions.map((s, i) => (
        <div
          key={`${s.label}-${i}`}
          className={`cell-autocomplete-item ${i === selectedIndex ? 'selected' : ''}`}
          style={{
            padding: '5px 10px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: i === selectedIndex ? '#e8f0fe' : 'transparent',
          }}
          onMouseEnter={() => setSelectedIndex(i)}
          onMouseDown={e => {
            e.preventDefault();
            if (s.type === 'function') {
              const afterEquals = value.slice(1);
              const lastSep = Math.max(afterEquals.lastIndexOf('('), afterEquals.lastIndexOf(','), afterEquals.lastIndexOf('+'), afterEquals.lastIndexOf('-'), afterEquals.lastIndexOf('*'), afterEquals.lastIndexOf('/'));
              const prefix = lastSep >= 0 ? '=' + afterEquals.slice(0, lastSep + 1) : '=';
              onSelect(prefix + s.label + '(');
            } else {
              onSelect(s.label);
            }
          }}
        >
          {s.type === 'function' && <span style={{ color: '#1a73e8', fontWeight: 600, fontFamily: 'monospace' }}>ƒ</span>}
          {s.type === 'recent' && <span style={{ color: '#999' }}>⏱</span>}
          <span style={{ fontWeight: s.type === 'function' ? 600 : 400 }}>{s.label}</span>
          {s.detail && <span style={{ color: '#666', fontSize: 11, marginLeft: 'auto', fontFamily: 'monospace' }}>{s.detail}</span>}
          {s.desc && <span style={{ color: '#999', fontSize: 11 }}>{s.desc}</span>}
        </div>
      ))}
    </div>
  );
}
