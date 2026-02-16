import React from 'react';
import {
  Pencil, Highlighter, Eraser, Minus, Square, Circle, ArrowRight,
  Type, MousePointer2, Undo2, Redo2, Trash2, Download, Image,
} from 'lucide-react';
import { DrawToolType, BackgroundStyle } from './drawModel';

const PRESET_COLORS = [
  '#000000', '#ffffff', '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280',
];

const WIDTHS: { label: string; value: number }[] = [
  { label: 'Thin', value: 2 },
  { label: 'Medium', value: 5 },
  { label: 'Thick', value: 10 },
];

interface DrawToolbarProps {
  activeTool: DrawToolType;
  onToolChange: (tool: DrawToolType) => void;
  color: string;
  onColorChange: (color: string) => void;
  strokeWidth: number;
  onStrokeWidthChange: (w: number) => void;
  opacity: number;
  onOpacityChange: (o: number) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onExportPng: () => void;
  onExportSvg: () => void;
  background: BackgroundStyle;
  onBackgroundChange: (bg: BackgroundStyle) => void;
}

const TOOLS: { type: DrawToolType; icon: React.FC<any>; label: string }[] = [
  { type: 'select', icon: MousePointer2, label: 'Select' },
  { type: 'pen', icon: Pencil, label: 'Pen' },
  { type: 'highlighter', icon: Highlighter, label: 'Highlighter' },
  { type: 'eraser', icon: Eraser, label: 'Eraser' },
  { type: 'line', icon: Minus, label: 'Line' },
  { type: 'rectangle', icon: Square, label: 'Rectangle' },
  { type: 'circle', icon: Circle, label: 'Circle' },
  { type: 'arrow', icon: ArrowRight, label: 'Arrow' },
  { type: 'text', icon: Type, label: 'Text' },
];

const DrawToolbar: React.FC<DrawToolbarProps> = ({
  activeTool, onToolChange, color, onColorChange,
  strokeWidth, onStrokeWidthChange, opacity, onOpacityChange,
  canUndo, canRedo, onUndo, onRedo, onClear,
  onExportPng, onExportSvg, background, onBackgroundChange,
}) => {
  return (
    <div className="draw-toolbar">
      {/* Tool buttons */}
      <div className="draw-toolbar-section">
        {TOOLS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.type}
              className={`draw-tool-btn ${activeTool === t.type ? 'active' : ''}`}
              onClick={() => onToolChange(t.type)}
              title={t.label}
            >
              <Icon size={18} />
            </button>
          );
        })}
      </div>

      <div className="draw-toolbar-divider" />

      {/* Colors */}
      <div className="draw-toolbar-section draw-colors">
        {PRESET_COLORS.map(c => (
          <button
            key={c}
            className={`draw-color-swatch ${color === c ? 'active' : ''}`}
            style={{ background: c, border: c === '#ffffff' ? '1px solid #ccc' : 'none' }}
            onClick={() => onColorChange(c)}
            title={c}
          />
        ))}
        <input
          type="color"
          value={color}
          onChange={e => onColorChange(e.target.value)}
          className="draw-color-custom"
          title="Custom color"
        />
      </div>

      <div className="draw-toolbar-divider" />

      {/* Stroke width */}
      <div className="draw-toolbar-section">
        {WIDTHS.map(w => (
          <button
            key={w.value}
            className={`draw-tool-btn ${strokeWidth === w.value ? 'active' : ''}`}
            onClick={() => onStrokeWidthChange(w.value)}
            title={w.label}
          >
            <span
              className="draw-width-preview"
              style={{ width: w.value * 2 + 6, height: w.value * 2 + 6 }}
            />
          </button>
        ))}
      </div>

      <div className="draw-toolbar-divider" />

      {/* Opacity */}
      <div className="draw-toolbar-section draw-opacity-section">
        <label className="draw-opacity-label" title="Opacity">
          <span style={{ opacity: opacity }}>●</span>
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.1}
            value={opacity}
            onChange={e => onOpacityChange(parseFloat(e.target.value))}
            className="draw-opacity-slider"
          />
        </label>
      </div>

      <div className="draw-toolbar-divider" />

      {/* Background */}
      <div className="draw-toolbar-section">
        <select
          value={background}
          onChange={e => onBackgroundChange(e.target.value as BackgroundStyle)}
          className="draw-bg-select"
          title="Background style"
        >
          <option value="none">No grid</option>
          <option value="grid">Grid</option>
          <option value="dots">Dots</option>
        </select>
      </div>

      <div className="draw-toolbar-divider" />

      {/* Undo / Redo */}
      <div className="draw-toolbar-section">
        <button className="draw-tool-btn" onClick={onUndo} disabled={!canUndo} title="Undo">
          <Undo2 size={18} />
        </button>
        <button className="draw-tool-btn" onClick={onRedo} disabled={!canRedo} title="Redo">
          <Redo2 size={18} />
        </button>
      </div>

      <div className="draw-toolbar-divider" />

      {/* Actions */}
      <div className="draw-toolbar-section">
        <button className="draw-tool-btn" onClick={onClear} title="Clear canvas">
          <Trash2 size={18} />
        </button>
        <button className="draw-tool-btn" onClick={onExportPng} title="Export PNG">
          <Image size={18} />
        </button>
        <button className="draw-tool-btn" onClick={onExportSvg} title="Export SVG">
          <Download size={18} />
        </button>
      </div>
    </div>
  );
};

export default DrawToolbar;
