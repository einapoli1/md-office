// CellDropdown — In-cell dropdown lists for data validation

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { expandRange } from './formulaEngine';
import type { SheetData } from './sheetModel';
import type { ValidationRule } from './conditionalEval';

// Color palette for dropdown options
const OPTION_COLORS: Record<string, { bg: string; text: string }> = {
  red: { bg: '#fce8e6', text: '#c5221f' },
  orange: { bg: '#fef3e0', text: '#e37400' },
  yellow: { bg: '#fef9e0', text: '#b8860b' },
  green: { bg: '#e6f4ea', text: '#137333' },
  blue: { bg: '#e8f0fe', text: '#1a73e8' },
  purple: { bg: '#f3e8fd', text: '#8430ce' },
  gray: { bg: '#f1f3f4', text: '#5f6368' },
};

export interface DropdownConfig {
  source: 'list' | 'range' | 'namedRange';
  items?: string[];                 // for source='list'
  rangeRef?: string;                // for source='range', e.g., "Sheet1!A1:A10"
  namedRangeName?: string;          // for source='namedRange'
  colorMap?: Record<string, string>; // value -> color name from OPTION_COLORS
}

interface CellDropdownProps {
  currentValue: string;
  config: DropdownConfig;
  sheet: SheetData;
  namedRanges: Record<string, string>;
  anchorStyle: { top: number; left: number; width: number };
  onSelect: (value: string) => void;
  onClose: () => void;
}

export default function CellDropdown({ currentValue, config, sheet, namedRanges, anchorStyle, onSelect, onClose }: CellDropdownProps) {
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [filter, setFilter] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  // Resolve items from config source
  const items = useMemo((): string[] => {
    if (config.source === 'list') return config.items || [];

    if (config.source === 'range' && config.rangeRef) {
      const refs = expandRange(config.rangeRef);
      return refs.map(ref => {
        const cell = sheet.cells[ref];
        return cell ? (cell.computed ?? cell.value) : '';
      }).filter(Boolean);
    }

    if (config.source === 'namedRange' && config.namedRangeName) {
      const rangeStr = namedRanges[config.namedRangeName];
      if (rangeStr) {
        const refs = expandRange(rangeStr);
        return refs.map(ref => {
          const cell = sheet.cells[ref];
          return cell ? (cell.computed ?? cell.value) : '';
        }).filter(Boolean);
      }
    }

    return [];
  }, [config, sheet.cells, namedRanges]);

  const filteredItems = useMemo(() => {
    if (!filter) return items;
    const lower = filter.toLowerCase();
    return items.filter(item => item.toLowerCase().includes(lower));
  }, [items, filter]);

  // Set initial selected index to current value
  useEffect(() => {
    const idx = filteredItems.indexOf(currentValue);
    setSelectedIndex(idx >= 0 ? idx : 0);
  }, [currentValue, filteredItems]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filteredItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < filteredItems.length) {
        onSelect(filteredItems[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }, [filteredItems, selectedIndex, onSelect, onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Scroll selected into view
  useEffect(() => {
    if (listRef.current && selectedIndex >= 0) {
      const item = listRef.current.children[selectedIndex + 1] as HTMLElement | undefined; // +1 for filter input
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (listRef.current && !listRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={listRef}
      className="cell-dropdown-list"
      style={{
        position: 'absolute',
        top: anchorStyle.top + 28,
        left: anchorStyle.left,
        minWidth: Math.max(anchorStyle.width, 150),
        maxHeight: 220,
        overflowY: 'auto',
        background: '#fff',
        border: '1px solid #d0d0d0',
        borderRadius: 4,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 1100,
        fontSize: 13,
      }}
    >
      {items.length > 8 && (
        <input
          className="cell-dropdown-filter"
          style={{
            width: '100%',
            padding: '4px 8px',
            border: 'none',
            borderBottom: '1px solid #eee',
            outline: 'none',
            fontSize: 12,
            boxSizing: 'border-box',
          }}
          placeholder="Filter..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          autoFocus
        />
      )}
      {filteredItems.map((item, i) => {
        const colorName = config.colorMap?.[item];
        const colors = colorName ? OPTION_COLORS[colorName] : undefined;
        return (
          <div
            key={item}
            className={`cell-dropdown-item ${i === selectedIndex ? 'selected' : ''}`}
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
              onSelect(item);
            }}
          >
            {colors && (
              <span style={{
                display: 'inline-block',
                padding: '1px 8px',
                borderRadius: 10,
                background: colors.bg,
                color: colors.text,
                fontSize: 11,
                fontWeight: 500,
              }}>
                {item}
              </span>
            )}
            {!colors && <span>{item}</span>}
            {item === currentValue && <span style={{ marginLeft: 'auto', color: '#1a73e8' }}>✓</span>}
          </div>
        );
      })}
      {filteredItems.length === 0 && (
        <div style={{ padding: '8px 10px', color: '#999', fontSize: 12 }}>No options</div>
      )}
    </div>
  );
}

// Helper: get dropdown config from a validation rule
export function getDropdownConfigFromRule(rule: ValidationRule, _sheet: SheetData, _namedRanges: Record<string, string>): DropdownConfig | null {
  if (rule.rule.type !== 'list') return null;

  if (rule.rule.listItems && rule.rule.listItems.length > 0) {
    return { source: 'list', items: rule.rule.listItems };
  }

  return null;
}

// Helper: render dropdown arrow indicator in a cell
export function CellDropdownArrow({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
  return (
    <span
      className="sheet-dropdown-arrow-btn"
      style={{
        position: 'absolute',
        right: 2,
        top: '50%',
        transform: 'translateY(-50%)',
        cursor: 'pointer',
        color: '#666',
        fontSize: 12,
        lineHeight: 1,
        padding: '2px 3px',
        borderRadius: 2,
      }}
      onClick={e => {
        e.stopPropagation();
        onClick(e);
      }}
      onMouseDown={e => e.preventDefault()}
    >
      ▾
    </span>
  );
}
