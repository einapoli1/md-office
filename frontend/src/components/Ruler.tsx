import React, { useState, useCallback, useRef, useEffect } from 'react';

interface RulerProps {
  pageWidthPx: number;       // e.g. 816 for Letter
  leftMarginPx: number;      // initial left margin in px
  rightMarginPx: number;     // initial right margin in px
  onMarginsChange: (left: number, right: number) => void;
}

const DPI = 96;
const TICK_EVERY_HALF_INCH = DPI / 2; // 48px

const Ruler: React.FC<RulerProps> = ({ pageWidthPx, leftMarginPx, rightMarginPx, onMarginsChange }) => {
  const [leftMargin, setLeftMargin] = useState(leftMarginPx);
  const [rightMargin, setRightMargin] = useState(rightMarginPx);
  const [dragging, setDragging] = useState<'left' | 'right' | null>(null);
  const rulerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setLeftMargin(leftMarginPx); }, [leftMarginPx]);
  useEffect(() => { setRightMargin(rightMarginPx); }, [rightMarginPx]);

  const handleMouseDown = useCallback((side: 'left' | 'right') => (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(side);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!rulerRef.current) return;
      const rect = rulerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      if (dragging === 'left') {
        const clamped = Math.max(0, Math.min(x, pageWidthPx - rightMargin - 96));
        setLeftMargin(clamped);
        onMarginsChange(clamped, rightMargin);
      } else {
        const fromRight = pageWidthPx - x;
        const clamped = Math.max(0, Math.min(fromRight, pageWidthPx - leftMargin - 96));
        setRightMargin(clamped);
        onMarginsChange(leftMargin, clamped);
      }
    };
    const handleMouseUp = () => setDragging(null);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, leftMargin, rightMargin, pageWidthPx, onMarginsChange]);

  // Build tick marks
  const totalInches = pageWidthPx / DPI;
  const ticks: React.ReactNode[] = [];
  for (let i = 0; i <= totalInches * 2; i++) {
    const px = i * TICK_EVERY_HALF_INCH;
    const isInch = i % 2 === 0;
    const inchNum = i / 2;
    ticks.push(
      <div key={i} className="ruler-tick" style={{ left: px }} data-inch={isInch}>
        <div className={`ruler-tick-mark ${isInch ? 'ruler-tick-inch' : 'ruler-tick-half'}`} />
        {isInch && inchNum > 0 && inchNum < totalInches && (
          <span className="ruler-tick-label">{inchNum}</span>
        )}
      </div>
    );
  }

  return (
    <div className="ruler-container">
      <div className="ruler" ref={rulerRef} style={{ width: pageWidthPx }}>
        {/* Margin shading */}
        <div className="ruler-margin-shade ruler-margin-left" style={{ width: leftMargin }} />
        <div className="ruler-margin-shade ruler-margin-right" style={{ width: rightMargin }} />
        
        {/* Tick marks */}
        {ticks}

        {/* Draggable margin indicators */}
        <div
          className={`ruler-indicator ruler-indicator-left ${dragging === 'left' ? 'dragging' : ''}`}
          style={{ left: leftMargin }}
          onMouseDown={handleMouseDown('left')}
          title="Left margin"
        />
        <div
          className={`ruler-indicator ruler-indicator-right ${dragging === 'right' ? 'dragging' : ''}`}
          style={{ right: rightMargin }}
          onMouseDown={handleMouseDown('right')}
          title="Right margin"
        />
      </div>
    </div>
  );
};

export default Ruler;
