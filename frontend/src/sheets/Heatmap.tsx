import { useState, useMemo, useCallback } from 'react';
import type { SheetData } from './sheetModel';
import { expandRange } from './formulaEngine';

export interface HeatmapConfig {
  id: string;
  range: string;
  minColor: string;  // hex
  maxColor: string;  // hex
  midColor: string;  // hex
  showLegend: boolean;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(c => Math.round(c).toString(16).padStart(2, '0')).join('');
}

function interpolateColor(color1: string, color2: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(color1);
  const [r2, g2, b2] = hexToRgb(color2);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

export function getHeatmapColor(value: number, min: number, max: number, config: HeatmapConfig): string {
  if (max === min) return config.midColor;
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  if (t < 0.5) return interpolateColor(config.minColor, config.midColor, t * 2);
  return interpolateColor(config.midColor, config.maxColor, (t - 0.5) * 2);
}

// Apply heatmap colors to cells (returns map of cellId -> background color)
export function computeHeatmapColors(sheet: SheetData, config: HeatmapConfig): Map<string, string> {
  const colors = new Map<string, string>();
  const refs = expandRange(config.range);
  const numericCells: { id: string; value: number }[] = [];

  for (const ref of refs) {
    const cell = sheet.cells[ref];
    if (!cell) continue;
    const val = parseFloat(cell.computed ?? cell.value);
    if (!isNaN(val)) numericCells.push({ id: ref, value: val });
  }

  if (numericCells.length === 0) return colors;
  const min = Math.min(...numericCells.map(c => c.value));
  const max = Math.max(...numericCells.map(c => c.value));

  for (const { id, value } of numericCells) {
    colors.set(id, getHeatmapColor(value, min, max, config));
  }
  return colors;
}

// Legend component
interface HeatmapLegendProps {
  config: HeatmapConfig;
  min: number;
  max: number;
  x: number;
  y: number;
  onDelete: (id: string) => void;
}

export function HeatmapLegend({ config, min, max, x, y, onDelete }: HeatmapLegendProps) {
  const gradientStops = useMemo(() => {
    const stops: string[] = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const color = t < 0.5
        ? interpolateColor(config.minColor, config.midColor, t * 2)
        : interpolateColor(config.midColor, config.maxColor, (t - 0.5) * 2);
      stops.push(color);
    }
    return stops;
  }, [config]);

  return (
    <div style={{
      position: 'absolute', left: x, top: y, background: '#fff', border: '1px solid #dadce0',
      borderRadius: 6, padding: '8px 12px', zIndex: 15, boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: '#555' }}>Heatmap Legend</span>
        <button onClick={() => onDelete(config.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#999' }}>✕</button>
      </div>
      <div style={{
        width: 180, height: 16, borderRadius: 3,
        background: `linear-gradient(to right, ${gradientStops.join(', ')})`,
      }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#888', marginTop: 2 }}>
        <span>{min.toFixed(1)}</span>
        <span>{((min + max) / 2).toFixed(1)}</span>
        <span>{max.toFixed(1)}</span>
      </div>
    </div>
  );
}

// Dialog
interface CreateHeatmapDialogProps {
  selectionRange: string;
  onInsert: (config: Omit<HeatmapConfig, 'id'>) => void;
  onClose: () => void;
}

export function CreateHeatmapDialog({ selectionRange, onInsert, onClose }: CreateHeatmapDialogProps) {
  const [range, setRange] = useState(selectionRange);
  const [preset, setPreset] = useState<'gyr' | 'bwr'>('gyr');
  const [showLegend, setShowLegend] = useState(true);

  const presets = {
    gyr: { minColor: '#34A853', midColor: '#FBBC04', maxColor: '#EA4335' },
    bwr: { minColor: '#4285F4', midColor: '#FFFFFF', maxColor: '#EA4335' },
  };

  const handleInsert = useCallback(() => {
    if (!range) return;
    onInsert({ range: range.toUpperCase(), ...presets[preset], showLegend });
  }, [range, preset, showLegend, onInsert]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
      <div style={{ background: '#fff', borderRadius: 8, padding: 24, minWidth: 320, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
        <h3 style={{ margin: '0 0 16px' }}>Create Heatmap</h3>
        <label style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
          Range:
          <input value={range} onChange={e => setRange(e.target.value.toUpperCase())} style={{ marginLeft: 8, width: 140 }} />
        </label>
        <label style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
          Color Scale:
          <select value={preset} onChange={e => setPreset(e.target.value as 'gyr' | 'bwr')} style={{ marginLeft: 8 }}>
            <option value="gyr">Green → Yellow → Red</option>
            <option value="bwr">Blue → White → Red</option>
          </select>
        </label>
        <div style={{ marginBottom: 8, height: 16, borderRadius: 3, background: `linear-gradient(to right, ${presets[preset].minColor}, ${presets[preset].midColor}, ${presets[preset].maxColor})` }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, fontSize: 12 }}>
          <input type="checkbox" checked={showLegend} onChange={e => setShowLegend(e.target.checked)} />
          Show legend
        </label>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose}>Cancel</button>
          <button onClick={handleInsert} style={{ background: '#4285F4', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: 4, cursor: 'pointer' }}>Create</button>
        </div>
      </div>
    </div>
  );
}
