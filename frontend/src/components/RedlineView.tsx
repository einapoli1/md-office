import React, { useState, useMemo, useRef } from 'react';
import { X, Printer, Eye, EyeOff, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

export interface RedlineChange {
  id: string;
  type: 'insertion' | 'deletion' | 'formatting' | 'move';
  text: string;
  author: string;
  createdAt: string;
  position: number; // char offset for ordering
}

interface RedlineViewProps {
  documentContent: string;
  changes: RedlineChange[];
  onAcceptAll: () => void;
  onClose: () => void;
}

const AUTHOR_COLORS: Record<string, string> = {};
const COLOR_PALETTE = ['#1a73e8', '#ea4335', '#34a853', '#fbbc04', '#9334e6', '#e8710a', '#e91e63', '#00bcd4'];
let colorIdx = 0;

function getAuthorColor(author: string): string {
  if (!AUTHOR_COLORS[author]) {
    AUTHOR_COLORS[author] = COLOR_PALETTE[colorIdx % COLOR_PALETTE.length];
    colorIdx++;
  }
  return AUTHOR_COLORS[author];
}

const RedlineView: React.FC<RedlineViewProps> = ({
  documentContent, changes, onAcceptAll, onClose,
}) => {
  const [showFormatting, setShowFormatting] = useState(true);
  const [showMoves, setShowMoves] = useState(true);
  const [isClean, setIsClean] = useState(false);
  const [changeIndex, setChangeIndex] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  const filteredChanges = useMemo(() => {
    return changes
      .filter(c => {
        if (!showFormatting && c.type === 'formatting') return false;
        if (!showMoves && c.type === 'move') return false;
        return true;
      })
      .sort((a, b) => a.position - b.position);
  }, [changes, showFormatting, showMoves]);

  const renderedContent = useMemo(() => {
    if (isClean) return [{ type: 'text' as const, content: documentContent }];

    // Build segments: interleave document text with change markers
    const segments: Array<{ type: 'text' | 'insertion' | 'deletion' | 'formatting' | 'move'; content: string; change?: RedlineChange }> = [];
    let lastPos = 0;

    filteredChanges.forEach(change => {
      const pos = Math.min(change.position, documentContent.length);
      if (pos > lastPos) {
        segments.push({ type: 'text', content: documentContent.slice(lastPos, pos) });
      }
      segments.push({ type: change.type, content: change.text, change });
      lastPos = pos;
    });

    if (lastPos < documentContent.length) {
      segments.push({ type: 'text', content: documentContent.slice(lastPos) });
    }

    if (segments.length === 0) {
      segments.push({ type: 'text', content: documentContent });
    }

    return segments;
  }, [documentContent, filteredChanges, isClean]);

  const handleClean = () => {
    setIsClean(true);
    onAcceptAll();
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow || !contentRef.current) return;
    printWindow.document.write(`
      <html><head><title>Redline View</title>
      <style>
        body { font-family: serif; padding: 40px; line-height: 1.8; }
        .insertion { text-decoration: underline; color: green; }
        .deletion { text-decoration: line-through; color: red; }
        .formatting { color: blue; font-style: italic; }
        .move { color: purple; }
        .author-label { font-size: 9px; padding: 1px 3px; border-radius: 2px; color: white; vertical-align: super; }
        .date-stamp { font-size: 8px; color: #888; vertical-align: super; }
      </style></head><body>
      ${contentRef.current.innerHTML}
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const prevChange = () => setChangeIndex(i => Math.max(0, i - 1));
  const nextChange = () => setChangeIndex(i => Math.min(filteredChanges.length - 1, i + 1));

  const formatDate = (d: string) => {
    const date = new Date(d);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--bg-primary, #fff)', borderRadius: 8, width: '80vw', maxWidth: 900,
        height: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid #e0e0e0' }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Redline View</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        {/* Toolbar */}
        <div style={{ padding: '8px 20px', borderBottom: '1px solid #e0e0e0', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => setShowFormatting(v => !v)}
            style={{ fontSize: 12, padding: '4px 10px', borderRadius: 4, border: '1px solid #ccc', background: showFormatting ? '#e8f0fe' : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            {showFormatting ? <Eye size={12} /> : <EyeOff size={12} />} Formatting
          </button>
          <button onClick={() => setShowMoves(v => !v)}
            style={{ fontSize: 12, padding: '4px 10px', borderRadius: 4, border: '1px solid #ccc', background: showMoves ? '#e8f0fe' : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            {showMoves ? <Eye size={12} /> : <EyeOff size={12} />} Moves
          </button>

          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button onClick={prevChange} disabled={changeIndex <= 0} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: changeIndex <= 0 ? 0.3 : 1 }}>
              <ChevronLeft size={14} />
            </button>
            <span style={{ fontSize: 12 }}>
              {filteredChanges.length > 0 ? `${changeIndex + 1}/${filteredChanges.length}` : '0/0'}
            </span>
            <button onClick={nextChange} disabled={changeIndex >= filteredChanges.length - 1} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: changeIndex >= filteredChanges.length - 1 ? 0.3 : 1 }}>
              <ChevronRight size={14} />
            </button>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button onClick={handleClean} disabled={isClean}
              style={{ fontSize: 12, padding: '4px 10px', borderRadius: 4, border: '1px solid #34a853', background: '#e6f4ea', color: '#34a853', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Sparkles size={12} /> Clean
            </button>
            <button onClick={handlePrint}
              style={{ fontSize: 12, padding: '4px 10px', borderRadius: 4, border: '1px solid #ccc', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Printer size={12} /> Print
            </button>
          </div>
        </div>

        {/* Legend */}
        <div style={{ padding: '4px 20px', borderBottom: '1px solid #e0e0e0', display: 'flex', gap: 16, fontSize: 11, color: '#666' }}>
          <span><span style={{ textDecoration: 'underline', color: 'green' }}>Insertions</span></span>
          <span><span style={{ textDecoration: 'line-through', color: 'red' }}>Deletions</span></span>
          <span><span style={{ color: 'blue', fontStyle: 'italic' }}>Formatting</span></span>
          <span><span style={{ color: 'purple' }}>Moves</span></span>
          <span style={{ marginLeft: 'auto' }}>{filteredChanges.length} changes by {new Set(filteredChanges.map(c => c.author)).size} author(s)</span>
        </div>

        {/* Content */}
        <div ref={contentRef} style={{ flex: 1, overflow: 'auto', padding: '24px 40px', lineHeight: 1.8, fontFamily: 'serif', fontSize: 14 }}>
          {renderedContent.map((seg, i) => {
            if (seg.type === 'text') {
              return <span key={i}>{seg.content}</span>;
            }

            const change = seg.change!;
            const color = getAuthorColor(change.author);
            const isActive = filteredChanges.indexOf(change) === changeIndex;

            if (seg.type === 'deletion') {
              return (
                <span key={i} style={{ position: 'relative' }}>
                  <span style={{
                    textDecoration: 'line-through', color: 'red',
                    background: isActive ? '#fce8e6' : 'transparent',
                  }}>
                    {seg.content}
                  </span>
                  <span style={{ fontSize: 8, padding: '0 2px', borderRadius: 2, background: color, color: '#fff', verticalAlign: 'super', marginLeft: 1 }}>
                    {change.author}
                  </span>
                  <span style={{ fontSize: 7, color: '#999', verticalAlign: 'super', marginLeft: 2 }}>
                    {formatDate(change.createdAt)}
                  </span>
                </span>
              );
            }

            if (seg.type === 'insertion') {
              return (
                <span key={i} style={{ position: 'relative' }}>
                  <span style={{
                    textDecoration: 'underline', color: 'green',
                    background: isActive ? '#e6f4ea' : 'transparent',
                  }}>
                    {seg.content}
                  </span>
                  <span style={{ fontSize: 8, padding: '0 2px', borderRadius: 2, background: color, color: '#fff', verticalAlign: 'super', marginLeft: 1 }}>
                    {change.author}
                  </span>
                  <span style={{ fontSize: 7, color: '#999', verticalAlign: 'super', marginLeft: 2 }}>
                    {formatDate(change.createdAt)}
                  </span>
                </span>
              );
            }

            if (seg.type === 'formatting') {
              return (
                <span key={i} style={{
                  color: 'blue', fontStyle: 'italic',
                  background: isActive ? '#e8f0fe' : 'transparent',
                }}>
                  {seg.content}
                  <span style={{ fontSize: 8, padding: '0 2px', borderRadius: 2, background: color, color: '#fff', verticalAlign: 'super', marginLeft: 1 }}>
                    {change.author}
                  </span>
                </span>
              );
            }

            // move
            return (
              <span key={i} style={{
                color: 'purple',
                background: isActive ? '#f3e8fd' : 'transparent',
              }}>
                [{seg.content}]
                <span style={{ fontSize: 8, padding: '0 2px', borderRadius: 2, background: color, color: '#fff', verticalAlign: 'super', marginLeft: 1 }}>
                  {change.author}
                </span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default RedlineView;
