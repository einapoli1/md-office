import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { SheetData } from './sheetModel';
import { expandRange, parseCellRef, cellId } from './formulaEngine';

export interface SlicerConfig {
  id: string;
  column: string;       // column header name
  sourceRange: string;  // data range
  sourceSheet: number;
  selectedValues: Set<string>;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SlicerProps {
  slicer: SlicerConfig;
  sheet: SheetData;
  onSelectionChange: (id: string, selected: Set<string>) => void;
  onMove: (id: string, x: number, y: number) => void;
  onResize: (id: string, w: number, h: number) => void;
  onDelete: (id: string) => void;
}

export function SlicerOverlay({ slicer, sheet, onSelectionChange, onMove, onResize, onDelete }: SlicerProps) {
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, cx: 0, cy: 0 });

  // Extract unique values from the column
  const uniqueValues = useMemo(() => {
    const refs = expandRange(slicer.sourceRange);
    if (refs.length === 0) return [];
    const parsed = refs.map(r => parseCellRef(r)!).filter(Boolean);
    const minRow = Math.min(...parsed.map(p => p.row));
    const maxRow = Math.max(...parsed.map(p => p.row));
    const minCol = Math.min(...parsed.map(p => p.col));
    const maxCol = Math.max(...parsed.map(p => p.col));

    // Find column index by header name
    let colIdx = -1;
    for (let c = minCol; c <= maxCol; c++) {
      const cell = sheet.cells[cellId(c, minRow)];
      const val = cell ? (cell.computed ?? cell.value) : '';
      if (val === slicer.column) { colIdx = c; break; }
    }
    if (colIdx === -1) return [];

    const values = new Set<string>();
    for (let r = minRow + 1; r <= maxRow; r++) {
      const cell = sheet.cells[cellId(colIdx, r)];
      const val = cell ? (cell.computed ?? cell.value) : '';
      if (val) values.add(val);
    }
    return Array.from(values).sort();
  }, [sheet, slicer.sourceRange, slicer.column]);

  const toggleValue = useCallback((val: string) => {
    const next = new Set(slicer.selectedValues);
    if (next.has(val)) next.delete(val); else next.add(val);
    onSelectionChange(slicer.id, next);
  }, [slicer, onSelectionChange]);

  const selectAll = useCallback(() => {
    onSelectionChange(slicer.id, new Set(uniqueValues));
  }, [slicer.id, uniqueValues, onSelectionChange]);

  const clearAll = useCallback(() => {
    onSelectionChange(slicer.id, new Set());
  }, [slicer.id, onSelectionChange]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, .slicer-body')) return;
    e.stopPropagation();
    e.preventDefault();
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, cx: slicer.x, cy: slicer.y };
  }, [slicer.x, slicer.y]);

  const handleResizeDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setResizing(true);
    dragStart.current = { x: e.clientX, y: e.clientY, cx: slicer.width, cy: slicer.height };
  }, [slicer.width, slicer.height]);

  useEffect(() => {
    if (!dragging && !resizing) return;
    const handleMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      if (dragging) onMove(slicer.id, dragStart.current.cx + dx, dragStart.current.cy + dy);
      if (resizing) onResize(slicer.id, Math.max(150, dragStart.current.cx + dx), Math.max(120, dragStart.current.cy + dy));
    };
    const handleUp = () => { setDragging(false); setResizing(false); };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp); };
  }, [dragging, resizing, slicer.id, onMove, onResize]);

  const allSelected = slicer.selectedValues.size === uniqueValues.length;

  return (
    <div
      style={{
        position: 'absolute', left: slicer.x, top: slicer.y, width: slicer.width, height: slicer.height,
        background: '#fff', border: '1px solid #dadce0', borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)', zIndex: 15, display: 'flex', flexDirection: 'column',
        cursor: dragging ? 'grabbing' : 'default',
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'grab', background: '#f8f9fa', borderRadius: '8px 8px 0 0' }}>
        <span style={{ fontWeight: 600, fontSize: 12, color: '#333' }}>🔽 {slicer.column}</span>
        <button onClick={() => onDelete(slicer.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#999' }}>✕</button>
      </div>
      {/* Controls */}
      <div style={{ padding: '4px 8px', display: 'flex', gap: 4, borderBottom: '1px solid #f0f0f0' }}>
        <button onClick={selectAll} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 3, border: '1px solid #ccc', background: allSelected ? '#e8f0fe' : '#fff', cursor: 'pointer' }}>Select All</button>
        <button onClick={clearAll} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 3, border: '1px solid #ccc', background: '#fff', cursor: 'pointer' }}>Clear</button>
      </div>
      {/* Values */}
      <div className="slicer-body" style={{ flex: 1, overflow: 'auto', padding: 6, display: 'flex', flexWrap: 'wrap', gap: 4, alignContent: 'flex-start' }}>
        {uniqueValues.map(val => {
          const selected = slicer.selectedValues.has(val);
          return (
            <button
              key={val}
              onClick={() => toggleValue(val)}
              style={{
                padding: '3px 10px', borderRadius: 12, fontSize: 11,
                border: selected ? '1px solid #4285F4' : '1px solid #dadce0',
                background: selected ? '#e8f0fe' : '#fff',
                color: selected ? '#1a73e8' : '#555',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {val}
            </button>
          );
        })}
        {uniqueValues.length === 0 && <div style={{ color: '#999', fontSize: 11 }}>No values found</div>}
      </div>
      {/* Resize handle */}
      <div
        style={{ position: 'absolute', right: 0, bottom: 0, width: 12, height: 12, cursor: 'nwse-resize', background: 'linear-gradient(135deg, transparent 50%, #999 50%)', borderRadius: '0 0 8px 0' }}
        onMouseDown={handleResizeDown}
      />
    </div>
  );
}

// Dialog to insert a slicer
interface InsertSlicerDialogProps {
  sheet: SheetData;
  sourceRange: string;
  onInsert: (column: string, sourceRange: string) => void;
  onClose: () => void;
}

export function InsertSlicerDialog({ sheet, sourceRange, onInsert, onClose }: InsertSlicerDialogProps) {
  const [range, setRange] = useState(sourceRange || 'A1:Z100');
  const [selectedCol, setSelectedCol] = useState('');

  const headers = useMemo(() => {
    const refs = expandRange(range);
    if (refs.length === 0) return [];
    const parsed = refs.map(r => parseCellRef(r)!).filter(Boolean);
    const minRow = Math.min(...parsed.map(p => p.row));
    const minCol = Math.min(...parsed.map(p => p.col));
    const maxCol = Math.max(...parsed.map(p => p.col));
    const hdrs: string[] = [];
    for (let c = minCol; c <= maxCol; c++) {
      const cell = sheet.cells[cellId(c, minRow)];
      const val = cell ? (cell.computed ?? cell.value) : '';
      if (val) hdrs.push(val);
    }
    return hdrs;
  }, [sheet, range]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
      <div style={{ background: '#fff', borderRadius: 8, padding: 24, minWidth: 320, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
        <h3 style={{ margin: '0 0 16px' }}>Insert Slicer</h3>
        <label style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
          Data Range:
          <input value={range} onChange={e => setRange(e.target.value.toUpperCase())} style={{ marginLeft: 8, width: 140 }} />
        </label>
        <label style={{ display: 'block', marginBottom: 16, fontSize: 12 }}>
          Column:
          <select value={selectedCol} onChange={e => setSelectedCol(e.target.value)} style={{ marginLeft: 8 }}>
            <option value="">Select column...</option>
            {headers.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
        </label>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose}>Cancel</button>
          <button
            onClick={() => { if (selectedCol) onInsert(selectedCol, range); }}
            disabled={!selectedCol}
            style={{ background: '#4285F4', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: 4, cursor: selectedCol ? 'pointer' : 'default', opacity: selectedCol ? 1 : 0.5 }}
          >Insert</button>
        </div>
      </div>
    </div>
  );
}
