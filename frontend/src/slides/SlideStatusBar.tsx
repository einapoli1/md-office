import React, { useState, useCallback } from 'react';
import { Minus, Plus } from 'lucide-react';

interface SlideStatusBarProps {
  currentSlide: number;
  totalSlides: number;
  layoutName: string;
  notesCharCount: number;
  collaborationStatus?: 'disconnected' | 'connecting' | 'connected';
  connectedUsers?: number;
  onZoomChange?: (zoom: number) => void;
}

const SlideStatusBar: React.FC<SlideStatusBarProps> = ({
  currentSlide,
  totalSlides,
  layoutName,
  notesCharCount,
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

  return (
    <div className="slide-status-bar">
      <div className="slide-status-bar-left">
        <span className="slide-status-slide-count">
          Slide {currentSlide} of {totalSlides}
        </span>
        <span className="slide-status-divider" />
        <span className="slide-status-layout" title="Slide layout">{layoutName}</span>
        <span className="slide-status-divider" />
        <span className="slide-status-notes" title="Speaker notes character count">
          Notes: {notesCharCount} chars
        </span>
        {collaborationStatus === 'connected' && (
          <>
            <span className="slide-status-divider" />
            <span className="slide-status-collab">
              <span className="slide-status-collab-dot" />
              {connectedUsers > 1 ? `${connectedUsers} editing` : 'Connected'}
            </span>
          </>
        )}
        {collaborationStatus === 'connecting' && (
          <>
            <span className="slide-status-divider" />
            <span className="slide-status-collab connecting">Connecting…</span>
          </>
        )}
      </div>

      <div className="slide-status-bar-right">
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

export default SlideStatusBar;
