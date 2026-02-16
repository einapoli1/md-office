import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { SheetData } from './sheetModel';
import { expandRange, parseCellRef, cellId } from './formulaEngine';

export interface TimelineConfig {
  id: string;
  sourceRange: string;
  sourceSheet: number;
  taskCol: string;
  startCol: string;
  endCol: string;
  categoryCol: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

type ZoomLevel = 'day' | 'week' | 'month';

interface TimelineTask {
  name: string;
  start: Date;
  end: Date;
  category: string;
}

const CATEGORY_COLORS = ['#4285F4', '#EA4335', '#FBBC04', '#34A853', '#FF6D01', '#46BDC6', '#7B1FA2', '#C2185B'];

function parseDate(s: string): Date | null {
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function getColumnIndex(sheet: SheetData, range: string, colName: string): number {
  const refs = expandRange(range);
  if (refs.length === 0) return -1;
  const parsed = refs.map(r => parseCellRef(r)!).filter(Boolean);
  const minRow = Math.min(...parsed.map(p => p.row));
  const minCol = Math.min(...parsed.map(p => p.col));
  const maxCol = Math.max(...parsed.map(p => p.col));
  for (let c = minCol; c <= maxCol; c++) {
    const cell = sheet.cells[cellId(c, minRow)];
    if (cell && (cell.computed ?? cell.value) === colName) return c;
  }
  return -1;
}

function extractTasks(sheet: SheetData, config: TimelineConfig): TimelineTask[] {
  const refs = expandRange(config.sourceRange);
  if (refs.length === 0) return [];
  const parsed = refs.map(r => parseCellRef(r)!).filter(Boolean);
  const minRow = Math.min(...parsed.map(p => p.row));
  const maxRow = Math.max(...parsed.map(p => p.row));

  const taskIdx = getColumnIndex(sheet, config.sourceRange, config.taskCol);
  const startIdx = getColumnIndex(sheet, config.sourceRange, config.startCol);
  const endIdx = getColumnIndex(sheet, config.sourceRange, config.endCol);
  const catIdx = config.categoryCol ? getColumnIndex(sheet, config.sourceRange, config.categoryCol) : -1;

  if (taskIdx === -1 || startIdx === -1 || endIdx === -1) return [];

  const tasks: TimelineTask[] = [];
  for (let r = minRow + 1; r <= maxRow; r++) {
    const nameCell = sheet.cells[cellId(taskIdx, r)];
    const startCell = sheet.cells[cellId(startIdx, r)];
    const endCell = sheet.cells[cellId(endIdx, r)];
    const catCell = catIdx >= 0 ? sheet.cells[cellId(catIdx, r)] : null;

    const name = nameCell ? (nameCell.computed ?? nameCell.value) : '';
    const start = startCell ? parseDate(startCell.computed ?? startCell.value) : null;
    const end = endCell ? parseDate(endCell.computed ?? endCell.value) : null;
    const category = catCell ? (catCell.computed ?? catCell.value) : '';

    if (name && start && end) tasks.push({ name, start, end, category });
  }
  return tasks;
}

interface TimelineOverlayProps {
  config: TimelineConfig;
  sheet: SheetData;
  onMove: (id: string, x: number, y: number) => void;
  onResize: (id: string, w: number, h: number) => void;
  onDelete: (id: string) => void;
}

export function TimelineOverlay({ config, sheet, onMove, onResize, onDelete }: TimelineOverlayProps) {
  const [zoom, setZoom] = useState<ZoomLevel>('week');
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, cx: 0, cy: 0 });

  const tasks = useMemo(() => extractTasks(sheet, config), [sheet, config]);

  const { minDate, maxDate, categories } = useMemo(() => {
    if (tasks.length === 0) return { minDate: new Date(), maxDate: new Date(), categories: new Map<string, number>() };
    const allDates = tasks.flatMap(t => [t.start.getTime(), t.end.getTime()]);
    const cats = new Map<string, number>();
    let ci = 0;
    tasks.forEach(t => { if (t.category && !cats.has(t.category)) cats.set(t.category, ci++); });
    return { minDate: new Date(Math.min(...allDates)), maxDate: new Date(Math.max(...allDates)), categories: cats };
  }, [tasks]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, select')) return;
    e.stopPropagation();
    e.preventDefault();
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, cx: config.x, cy: config.y };
  }, [config.x, config.y]);

  const handleResizeDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setResizing(true);
    dragStart.current = { x: e.clientX, y: e.clientY, cx: config.width, cy: config.height };
  }, [config.width, config.height]);

  useEffect(() => {
    if (!dragging && !resizing) return;
    const handleMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      if (dragging) onMove(config.id, dragStart.current.cx + dx, dragStart.current.cy + dy);
      if (resizing) onResize(config.id, Math.max(300, dragStart.current.cx + dx), Math.max(200, dragStart.current.cy + dy));
    };
    const handleUp = () => { setDragging(false); setResizing(false); };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp); };
  }, [dragging, resizing, config.id, onMove, onResize]);

  const ROW_HEIGHT = 28;
  const HEADER_HEIGHT = 50;
  const LEFT_MARGIN = 120;
  const totalMs = maxDate.getTime() - minDate.getTime() || 1;
  const chartWidth = config.width - LEFT_MARGIN - 20;

  const today = new Date();
  const todayX = LEFT_MARGIN + ((today.getTime() - minDate.getTime()) / totalMs) * chartWidth;

  // Generate time axis labels
  const timeLabels = useMemo(() => {
    const labels: { x: number; label: string }[] = [];
    const step = zoom === 'day' ? 86400000 : zoom === 'week' ? 604800000 : 2592000000;
    let t = new Date(minDate);
    t.setHours(0, 0, 0, 0);
    while (t.getTime() <= maxDate.getTime() + step) {
      const x = LEFT_MARGIN + ((t.getTime() - minDate.getTime()) / totalMs) * chartWidth;
      if (zoom === 'day') labels.push({ x, label: `${t.getMonth() + 1}/${t.getDate()}` });
      else if (zoom === 'week') labels.push({ x, label: `${t.getMonth() + 1}/${t.getDate()}` });
      else labels.push({ x, label: `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}` });
      t = new Date(t.getTime() + step);
    }
    return labels;
  }, [minDate, maxDate, totalMs, chartWidth, zoom]);

  return (
    <div
      style={{
        position: 'absolute', left: config.x, top: config.y, width: config.width, height: config.height,
        background: '#fff', border: '1px solid #dadce0', borderRadius: 6,
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)', zIndex: 15, overflow: 'hidden',
        cursor: dragging ? 'grabbing' : 'default',
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div style={{ padding: '6px 10px', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8f9fa', cursor: 'grab' }}>
        <span style={{ fontWeight: 600, fontSize: 12 }}>📅 Timeline</span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <select value={zoom} onChange={e => setZoom(e.target.value as ZoomLevel)} style={{ fontSize: 10, padding: '1px 4px' }}>
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
          <button onClick={() => onDelete(config.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#999' }}>✕</button>
        </div>
      </div>

      {/* Chart area */}
      <svg width={config.width} height={config.height - 36} style={{ display: 'block' }}>
        {/* Time axis */}
        {timeLabels.map((tl, i) => (
          <g key={i}>
            <line x1={tl.x} y1={HEADER_HEIGHT - 20} x2={tl.x} y2={config.height - 36} stroke="#f0f0f0" strokeWidth={1} />
            <text x={tl.x} y={HEADER_HEIGHT - 24} fontSize={9} fill="#888" textAnchor="middle">{tl.label}</text>
          </g>
        ))}

        {/* Today line */}
        {todayX >= LEFT_MARGIN && todayX <= config.width - 20 && (
          <>
            <line x1={todayX} y1={HEADER_HEIGHT - 20} x2={todayX} y2={config.height - 36} stroke="#EA4335" strokeWidth={1.5} strokeDasharray="4,2" />
            <text x={todayX} y={HEADER_HEIGHT - 6} fontSize={8} fill="#EA4335" textAnchor="middle">Today</text>
          </>
        )}

        {/* Tasks */}
        {tasks.map((task, i) => {
          const y = HEADER_HEIGHT + i * ROW_HEIGHT;
          const x1 = LEFT_MARGIN + ((task.start.getTime() - minDate.getTime()) / totalMs) * chartWidth;
          const x2 = LEFT_MARGIN + ((task.end.getTime() - minDate.getTime()) / totalMs) * chartWidth;
          const barW = Math.max(4, x2 - x1);
          const colorIdx = categories.has(task.category) ? categories.get(task.category)! : 0;
          const color = CATEGORY_COLORS[colorIdx % CATEGORY_COLORS.length];

          return (
            <g key={i}>
              <text x={4} y={y + ROW_HEIGHT / 2 + 4} fontSize={10} fill="#333" style={{ overflow: 'hidden' }}>
                {task.name.length > 14 ? task.name.slice(0, 14) + '…' : task.name}
              </text>
              <rect x={x1} y={y + 4} width={barW} height={ROW_HEIGHT - 8} rx={3} fill={color} opacity={0.85} />
            </g>
          );
        })}

        {tasks.length === 0 && (
          <text x={config.width / 2} y={config.height / 2} textAnchor="middle" fontSize={12} fill="#999">No timeline data</text>
        )}
      </svg>

      {/* Resize handle */}
      <div
        style={{ position: 'absolute', right: 0, bottom: 0, width: 12, height: 12, cursor: 'nwse-resize', background: 'linear-gradient(135deg, transparent 50%, #999 50%)' }}
        onMouseDown={handleResizeDown}
      />
    </div>
  );
}

// Insert dialog
interface InsertTimelineDialogProps {
  sheet: SheetData;
  sourceRange: string;
  onInsert: (config: Omit<TimelineConfig, 'id' | 'x' | 'y' | 'width' | 'height'>) => void;
  onClose: () => void;
}

export function InsertTimelineDialog({ sheet, sourceRange, onInsert, onClose }: InsertTimelineDialogProps) {
  const [range, setRange] = useState(sourceRange || 'A1:Z100');
  const [taskCol, setTaskCol] = useState('');
  const [startCol, setStartCol] = useState('');
  const [endCol, setEndCol] = useState('');
  const [categoryCol, setCategoryCol] = useState('');

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

  const valid = taskCol && startCol && endCol;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
      <div style={{ background: '#fff', borderRadius: 8, padding: 24, minWidth: 360, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
        <h3 style={{ margin: '0 0 16px' }}>Insert Timeline Chart</h3>
        <label style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
          Data Range:
          <input value={range} onChange={e => setRange(e.target.value.toUpperCase())} style={{ marginLeft: 8, width: 140 }} />
        </label>
        {[
          { label: 'Task Name Column', value: taskCol, set: setTaskCol, required: true },
          { label: 'Start Date Column', value: startCol, set: setStartCol, required: true },
          { label: 'End Date Column', value: endCol, set: setEndCol, required: true },
          { label: 'Category Column (optional)', value: categoryCol, set: setCategoryCol, required: false },
        ].map(({ label, value, set, required }) => (
          <label key={label} style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
            {label}:
            <select value={value} onChange={e => set(e.target.value)} style={{ marginLeft: 8 }}>
              <option value="">{required ? 'Select...' : 'None'}</option>
              {headers.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </label>
        ))}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose}>Cancel</button>
          <button
            onClick={() => { if (valid) onInsert({ sourceRange: range.toUpperCase(), sourceSheet: 0, taskCol, startCol, endCol, categoryCol }); }}
            disabled={!valid}
            style={{ background: '#4285F4', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: 4, cursor: valid ? 'pointer' : 'default', opacity: valid ? 1 : 0.5 }}
          >Insert</button>
        </div>
      </div>
    </div>
  );
}
