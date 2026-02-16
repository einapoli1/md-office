import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Paintbrush, ChevronDown, X } from 'lucide-react';

interface CopiedFormat {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  fontFamily?: string;
  fontSize?: string;
  color?: string;
  highlight?: string;
  timestamp: number;
  label: string;
}

interface FormatBrushProps {
  editor: any;
}

function describeFormat(fmt: CopiedFormat): string {
  const parts: string[] = [];
  if (fmt.bold) parts.push('Bold');
  if (fmt.italic) parts.push('Italic');
  if (fmt.underline) parts.push('Underline');
  if (fmt.strike) parts.push('Strikethrough');
  if (fmt.fontSize) parts.push(fmt.fontSize);
  if (fmt.fontFamily) parts.push(fmt.fontFamily.split(',')[0]);
  if (fmt.color && fmt.color !== '#000000') parts.push(fmt.color);
  if (fmt.highlight) parts.push(`Highlight: ${fmt.highlight}`);
  return parts.length ? parts.join(', ') : 'No formatting';
}

function captureFormat(editor: any): CopiedFormat {
  const textStyle = editor.getAttributes('textStyle') || {};
  const highlightAttr = editor.getAttributes('highlight') || {};
  const fmt: CopiedFormat = {
    bold: editor.isActive('bold'),
    italic: editor.isActive('italic'),
    underline: editor.isActive('underline'),
    strike: editor.isActive('strike'),
    fontFamily: textStyle.fontFamily || undefined,
    fontSize: textStyle.fontSize || undefined,
    color: textStyle.color || undefined,
    highlight: highlightAttr.color || undefined,
    timestamp: Date.now(),
    label: '',
  };
  fmt.label = describeFormat(fmt);
  return fmt;
}

function applyFormat(editor: any, fmt: CopiedFormat): void {
  const chain = editor.chain().focus();

  // Clear existing marks first
  chain.unsetBold().unsetItalic().unsetUnderline().unsetStrike();

  if (fmt.bold) chain.setBold();
  if (fmt.italic) chain.setItalic();
  if (fmt.underline) chain.setUnderline();
  if (fmt.strike) chain.setStrike();

  if (fmt.fontFamily) chain.setFontFamily(fmt.fontFamily);
  else chain.unsetFontFamily();

  if (fmt.color) chain.setColor(fmt.color);
  else chain.unsetColor();

  if (fmt.highlight) chain.setHighlight({ color: fmt.highlight });
  else chain.unsetHighlight();

  chain.run();
}

const MAX_HISTORY = 5;

const FormatBrush: React.FC<FormatBrushProps> = ({ editor }) => {
  const [active, setActive] = useState(false);
  const [persistent, setPersistent] = useState(false);
  const [copiedFormat, setCopiedFormat] = useState<CopiedFormat | null>(null);
  const [history, setHistory] = useState<CopiedFormat[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const clickCountRef = useRef(0);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyRef = useRef<HTMLDivElement>(null);

  const deactivate = useCallback(() => {
    setActive(false);
    setPersistent(false);
    setCopiedFormat(null);
    setTooltipPos(null);
    window.dispatchEvent(new CustomEvent('paint-format-change', { detail: { active: false, persistent: false } }));
  }, []);

  const handleClick = useCallback(() => {
    if (!editor) return;
    clickCountRef.current++;
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);

    clickTimerRef.current = setTimeout(() => {
      const clicks = clickCountRef.current;
      clickCountRef.current = 0;

      if (active) {
        deactivate();
      } else {
        const fmt = captureFormat(editor);
        setCopiedFormat(fmt);
        setHistory(prev => [fmt, ...prev.slice(0, MAX_HISTORY - 1)]);
        const isPersistent = clicks >= 2;
        setPersistent(isPersistent);
        setActive(true);
        window.dispatchEvent(new CustomEvent('paint-format-change', { detail: { active: true, persistent: isPersistent } }));
      }
    }, 250);
  }, [editor, active, deactivate]);

  // Track mouse for tooltip
  useEffect(() => {
    if (!active || !copiedFormat) return;
    const handler = (e: MouseEvent) => {
      setTooltipPos({ x: e.clientX + 12, y: e.clientY + 12 });
    };
    document.addEventListener('mousemove', handler);
    return () => document.removeEventListener('mousemove', handler);
  }, [active, copiedFormat]);

  // Listen for paste events (click on document while active)
  useEffect(() => {
    if (!active || !copiedFormat || !editor) return;

    const handler = () => {
      const { from, to } = editor.state.selection;
      if (from === to) return; // need selection
      applyFormat(editor, copiedFormat);
      if (!persistent) {
        deactivate();
      }
    };

    // Listen for selection changes as proxy for "pasting"
    editor.on('selectionUpdate', handler);
    return () => editor.off('selectionUpdate', handler);
  }, [active, copiedFormat, persistent, editor, deactivate]);

  // Escape key to exit
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') deactivate();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [active, deactivate]);

  // External events (from DocsToolbar)
  useEffect(() => {
    const onCopy = (e: Event) => {
      if (!editor) return;
      const detail = (e as CustomEvent).detail;
      const fmt = captureFormat(editor);
      setCopiedFormat(fmt);
      setHistory(prev => [fmt, ...prev.slice(0, MAX_HISTORY - 1)]);
      setPersistent(detail?.persistent || false);
      setActive(true);
    };
    const onClear = () => deactivate();

    window.addEventListener('paint-format-copy', onCopy);
    window.addEventListener('paint-format-clear', onClear);
    return () => {
      window.removeEventListener('paint-format-copy', onCopy);
      window.removeEventListener('paint-format-clear', onClear);
    };
  }, [editor, deactivate]);

  // Close history on outside click
  useEffect(() => {
    if (!showHistory) return;
    const handler = (e: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setShowHistory(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showHistory]);

  const handleHistoryApply = useCallback((fmt: CopiedFormat) => {
    if (!editor) return;
    setCopiedFormat(fmt);
    setActive(true);
    setPersistent(false);
    setShowHistory(false);
    window.dispatchEvent(new CustomEvent('paint-format-change', { detail: { active: true, persistent: false } }));
  }, [editor]);

  return (
    <>
      <div className="format-brush-container" style={{ display: 'flex', alignItems: 'center' }}>
        <button
          className={`toolbar-btn ${active ? 'active' : ''}`}
          onClick={handleClick}
          title="Paint format (click to copy, double-click for persistent mode)"
          aria-label="Paint format"
        >
          <Paintbrush size={16} />
        </button>
        {history.length > 0 && (
          <div ref={historyRef} style={{ position: 'relative' }}>
            <button
              className="toolbar-btn"
              onClick={() => setShowHistory(!showHistory)}
              title="Format history"
              style={{ padding: '2px' }}
            >
              <ChevronDown size={12} />
            </button>
            {showHistory && (
              <div className="format-history-dropdown">
                <div className="format-history-header">
                  <span>Recent Formats</span>
                  <button className="toolbar-btn" onClick={() => { setHistory([]); setShowHistory(false); }}><X size={12} /></button>
                </div>
                {history.map((fmt, i) => (
                  <button
                    key={fmt.timestamp}
                    className="format-history-item"
                    onClick={() => handleHistoryApply(fmt)}
                    title={fmt.label}
                  >
                    <span className="format-history-number">{i + 1}</span>
                    <span className="format-history-label">{fmt.label || 'No formatting'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating tooltip */}
      {active && copiedFormat && tooltipPos && (
        <div
          className="format-brush-tooltip"
          style={{
            position: 'fixed',
            left: tooltipPos.x,
            top: tooltipPos.y,
            zIndex: 10000,
            background: '#333',
            color: '#fff',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            maxWidth: '300px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          Format: {copiedFormat.label}
          {persistent && ' (locked)'}
        </div>
      )}
    </>
  );
};

export default FormatBrush;
