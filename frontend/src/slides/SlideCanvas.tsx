import { useState, useRef, useEffect, useCallback } from 'react';
import { Slide, SlideShape } from './slideModel';
import { SlideTheme, applyThemeVars } from './slideThemes';
import { ShapeOverlay, ShapePropertyEditor } from './ShapeTools';
import type { ShapeType } from './ShapeTools';
import mermaid from 'mermaid';
import katex from 'katex';

mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' });

/** Simple markdown → HTML (self-contained) */
function mdToHtml(md: string): string {
  let html = md;
  // Remove slide layout comment
  html = html.replace(/<!--\s*slide:\s*\S+\s*-->\s*\n?/, '');
  // Fragment comments → data attributes on next element
  let fragIdx = 0;
  html = html.replace(/<!--\s*fragment(?:\s*:\s*(\S+))?\s*-->\s*\n?/g, (_m, type) => {
    return `<span class="slide-fragment" data-fragment="${fragIdx++}" data-frag-type="${type || 'fade-in'}"></span>`;
  });
  // Two-column blocks
  html = html.replace(/::::\s*left\s*\n([\s\S]*?)::::/g, '<div class="col-left">$1</div>');
  html = html.replace(/::::\s*right\s*\n([\s\S]*?)::::/g, '<div class="col-right">$1</div>');
  // Mermaid code blocks (render placeholder, will be replaced in useEffect)
  html = html.replace(/```mermaid\n([\s\S]*?)```/g, (_m, code) => {
    const encoded = encodeURIComponent(code.trim());
    return `<div class="slide-mermaid" data-mermaid-code="${encoded}"></div>`;
  });
  // Math: block $$...$$ then inline $...$
  html = html.replace(/\$\$([\s\S]*?)\$\$/g, (_m, tex) => {
    try { return `<div class="katex-display">${katex.renderToString(tex.trim(), { displayMode: true, throwOnError: false })}</div>`; }
    catch { return `<div class="katex-display">${tex}</div>`; }
  });
  html = html.replace(/\$([^$\n]+)\$/g, (_m, tex) => {
    try { return katex.renderToString(tex.trim(), { displayMode: false, throwOnError: false }); }
    catch { return tex; }
  });
  // Code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="lang-$1">$2</code></pre>');
  // Headers
  html = html.replace(/^#### (.*$)/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');
  // Bold / italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');
  // Links
  html = html.replace(/\[([^\]]*)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  // Unordered lists
  html = html.replace(/^- (.*$)/gm, '<li>$1</li>');
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');
  // Inline code
  html = html.replace(/`(.+?)`/g, '<code>$1</code>');
  // Paragraphs
  html = html.replace(/\n{2,}/g, '\n<br/>\n');
  return html;
}

/** Apply fragment visibility classes after render */
function applyFragments(container: HTMLElement, fragmentIndex: number) {
  const markers = container.querySelectorAll('.slide-fragment');
  markers.forEach((marker) => {
    const el = marker as HTMLElement;
    const idx = parseInt(el.dataset.fragment || '-1', 10);
    const type = el.dataset.fragType || 'fade-in';
    // The fragment marker and all siblings until next fragment marker
    let sibling = el.nextElementSibling;
    const targets: HTMLElement[] = [];
    while (sibling && !sibling.classList.contains('slide-fragment')) {
      targets.push(sibling as HTMLElement);
      sibling = sibling.nextElementSibling;
    }
    const visible = idx <= fragmentIndex;
    targets.forEach(t => {
      t.classList.toggle('frag-visible', visible);
      t.classList.toggle('frag-hidden', !visible);
      t.dataset.fragType = type;
    });
    // Also hide the marker itself
    el.style.display = 'none';
  });
}

interface SlideCanvasProps {
  slide: Slide;
  theme: SlideTheme;
  editable?: boolean;
  onContentChange?: (content: string) => void;
  scale?: number;
  className?: string;
  fragmentIndex?: number;
  // Shape editing
  drawingTool?: ShapeType | null;
  onShapesChange?: (shapes: SlideShape[]) => void;
  onDrawEnd?: () => void;
}

export default function SlideCanvas({
  slide, theme, editable = false, onContentChange, scale, className = '',
  fragmentIndex, drawingTool, onShapesChange, onDrawEnd,
}: SlideCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);

  useEffect(() => {
    if (containerRef.current) applyThemeVars(containerRef.current, theme);
  }, [theme]);

  // Render mermaid diagrams in slides
  useEffect(() => {
    if (!contentRef.current) return;
    const els = contentRef.current.querySelectorAll('.slide-mermaid[data-mermaid-code]');
    let counter = 0;
    els.forEach(async (el) => {
      const code = decodeURIComponent(el.getAttribute('data-mermaid-code') || '');
      if (!code) return;
      try {
        const id = `slide-mermaid-${Date.now()}-${counter++}`;
        const { svg } = await mermaid.render(id, code);
        el.innerHTML = svg;
      } catch { el.innerHTML = '<em>Mermaid syntax error</em>'; }
    });
  }, [slide.content]);

  // Apply fragment visibility
  useEffect(() => {
    if (contentRef.current && fragmentIndex !== undefined) {
      applyFragments(contentRef.current, fragmentIndex);
    }
  }, [fragmentIndex, slide.content]);

  const handleDoubleClick = useCallback(() => {
    if (editable) setEditing(true);
  }, [editable]);

  useEffect(() => {
    if (editing && editRef.current) {
      editRef.current.focus();
      editRef.current.value = slide.content;
    }
  }, [editing, slide.content]);

  const finishEdit = () => {
    if (editRef.current && onContentChange) {
      onContentChange(editRef.current.value);
    }
    setEditing(false);
  };

  const handleShapesUpdate = useCallback((shapes: SlideShape[]) => {
    onShapesChange?.(shapes);
  }, [onShapesChange]);

  const handleShapePropertyUpdate = useCallback((updated: SlideShape) => {
    if (!slide.shapes) return;
    onShapesChange?.(slide.shapes.map(s => s.id === updated.id ? updated : s));
  }, [slide.shapes, onShapesChange]);

  const selectedShape = slide.shapes?.find(s => s.id === selectedShapeId) || null;

  const layoutClass = `slide-layout-${slide.layout}`;
  const st = scale ? { transform: `scale(${scale})`, transformOrigin: 'top left' } : {};

  return (
    <div
      ref={containerRef}
      className={`slide-canvas ${layoutClass} ${className}`}
      style={st}
      onDoubleClick={handleDoubleClick}
    >
      {editing ? (
        <textarea
          ref={editRef}
          className="slide-edit-textarea"
          defaultValue={slide.content}
          onBlur={finishEdit}
          onKeyDown={e => { if (e.key === 'Escape') finishEdit(); }}
        />
      ) : (
        <div ref={contentRef} className="slide-content-render" dangerouslySetInnerHTML={{ __html: mdToHtml(slide.content) }} />
      )}

      {/* Shape overlay */}
      {(slide.shapes?.length > 0 || drawingTool) && (
        <ShapeOverlay
          shapes={slide.shapes || []}
          selectedId={selectedShapeId}
          onSelect={setSelectedShapeId}
          onUpdate={handleShapesUpdate}
          drawingTool={drawingTool || null}
          onDrawEnd={onDrawEnd || (() => {})}
        />
      )}

      {/* Shape property editor (inline, only in edit mode) */}
      {editable && selectedShape && (
        <ShapePropertyEditor shape={selectedShape} onUpdate={handleShapePropertyUpdate} />
      )}
    </div>
  );
}
