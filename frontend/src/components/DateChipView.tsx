import React, { useState, useRef, useEffect } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import DatePicker from './DatePicker';

const DateChipView: React.FC<any> = ({ node, updateAttributes }) => {
  const [showPicker, setShowPicker] = useState(false);
  const chipRef = useRef<HTMLSpanElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const dateStr = node.attrs.date;
  const formatted = formatDate(dateStr);

  function formatDate(iso: string): string {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  useEffect(() => {
    if (!showPicker) return;
    const handleClick = (e: MouseEvent) => {
      if (
        chipRef.current && !chipRef.current.contains(e.target as Node) &&
        pickerRef.current && !pickerRef.current.contains(e.target as Node)
      ) {
        setShowPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showPicker]);

  return (
    <NodeViewWrapper as="span" className="date-chip-wrapper">
      <span
        ref={chipRef}
        className="date-chip"
        onClick={() => setShowPicker(!showPicker)}
        contentEditable={false}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        {formatted}
      </span>
      {showPicker && (
        <div ref={pickerRef} className="date-picker-popup" contentEditable={false}>
          <DatePicker
            value={dateStr}
            onChange={(newDate) => {
              updateAttributes({ date: newDate });
              setShowPicker(false);
            }}
          />
        </div>
      )}
    </NodeViewWrapper>
  );
};

export default DateChipView;
