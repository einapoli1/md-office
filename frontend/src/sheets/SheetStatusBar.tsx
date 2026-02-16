import React, { useMemo, useState, useCallback } from 'react';
import { Minus, Plus } from 'lucide-react';

interface SheetStatusBarProps {
  cellRef: string;
  selectedValues: number[];
  sheetIndex: number;
  sheetCount: number;
  collaborationStatus?: 'disconnected' | 'connecting' | 'connected';
  connectedUsers?: number;
  onZoomChange?: (zoom: number) => void;
}

const SheetStatusBar: React.FC<SheetStatusBarProps> = ({
  cellRef,
  selectedValues,
  sheetIndex,
  sheetCount,
  collaborationStatus,
  connectedUsers = 0,
  onZoomChange,
}) => {
  const [zoom, setZoom] = useState(100);
  const zoomLevels = [50, 75, 90, 100, 110, 125, 150, 175, 200];

  const handleZoomChange = useCallback((newZoom: number) => {
    const clamped = Math.max(50, Math.min(200, newZoom));
    setZoom(clamped);
    onZoomChange?.(clamped);
  }, [onZoomChange]);

  const zoomIn = () => {
    const nextLevel = zoomLevels.find(z => z > zoom) || 200;
    handleZoomChange(nextLevel);
  };

  const zoomOut = () => {
    const prevLevel = [...zoomLevels].reverse().find(z => z < zoom) || 50;
    handleZoomChange(prevLevel);
  };

  const stats = useMemo(() => {
    if (selectedValues.length === 0) return null;
    const sum = selectedValues.reduce((a, b) => a + b, 0);
    return {
      sum,
      average: sum / selectedValues.length,
      count: selectedValues.length,
      min: Math.min(...selectedValues),
      max: Math.max(...selectedValues),
    };
  }, [selectedValues]);

  return (
    <div className="sheet-status-bar">
      <div className="sheet-status-bar-left">
        <span className="sheet-status-cell-ref" title="Current cell">{cellRef}</span>
        <span className="sheet-status-divider" />
        <span className="sheet-status-sheet-count">
          Sheet {sheetIndex + 1} of {sheetCount}
        </span>
        {collaborationStatus === 'connected' && (
          <>
            <span className="sheet-status-divider" />
            <span className="sheet-status-collab">
              <span className="sheet-status-collab-dot" />
              {connectedUsers > 1 ? `${connectedUsers} editing` : 'Connected'}
            </span>
          </>
        )}
        {collaborationStatus === 'connecting' && (
          <>
            <span className="sheet-status-divider" />
            <span className="sheet-status-collab connecting">Connecting…</span>
          </>
        )}
      </div>

      <div className="sheet-status-bar-center">
        {stats && (
          <div className="sheet-status-calculations">
            <span className="sheet-status-calc" title="Sum">SUM: {stats.sum.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
            <span className="sheet-status-calc" title="Average">AVG: {stats.average.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
            <span className="sheet-status-calc" title="Count">COUNT: {stats.count}</span>
            <span className="sheet-status-calc" title="Min">MIN: {stats.min.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
            <span className="sheet-status-calc" title="Max">MAX: {stats.max.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
          </div>
        )}
      </div>

      <div className="sheet-status-bar-right">
        <div className="zoom-control">
          <button className="zoom-btn" onClick={zoomOut} title="Zoom out">
            <Minus size={12} />
          </button>
          <select
            className="zoom-select"
            value={zoom}
            onChange={e => handleZoomChange(Number(e.target.value))}
            title="Zoom level"
          >
            {zoomLevels.map(z => (
              <option key={z} value={z}>{z}%</option>
            ))}
          </select>
          <button className="zoom-btn" onClick={zoomIn} title="Zoom in">
            <Plus size={12} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SheetStatusBar;
