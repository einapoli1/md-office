import React from 'react';
import { DrawToolType } from './drawModel';

interface DrawStatusBarProps {
  zoom: number;
  canvasWidth: number;
  canvasHeight: number;
  currentTool: DrawToolType;
  activeLayer: number;
  objectCount: number;
}

const TOOL_LABELS: Record<DrawToolType, string> = {
  select: 'Select',
  pen: 'Pen',
  highlighter: 'Highlighter',
  eraser: 'Eraser',
  line: 'Line',
  rectangle: 'Rectangle',
  circle: 'Circle',
  arrow: 'Arrow',
  text: 'Text',
};

const DrawStatusBar: React.FC<DrawStatusBarProps> = ({
  zoom, canvasWidth, canvasHeight, currentTool, activeLayer, objectCount,
}) => {
  return (
    <div className="draw-status-bar">
      <span className="draw-status-item">🔧 {TOOL_LABELS[currentTool]}</span>
      <span className="draw-status-item">🔍 {Math.round(zoom * 100)}%</span>
      <span className="draw-status-item">📐 {canvasWidth} × {canvasHeight}</span>
      <span className="draw-status-item">📑 Layer {activeLayer}</span>
      <span className="draw-status-item">{objectCount} object{objectCount !== 1 ? 's' : ''}</span>
    </div>
  );
};

export default DrawStatusBar;
