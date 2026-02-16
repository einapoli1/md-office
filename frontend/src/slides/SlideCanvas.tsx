import { useState, useRef, useEffect, useCallback } from 'react';
import { Slide } from './slideModel';
import { SlideTheme, applyThemeVars } from './slideThemes';

/** Simple markdown → HTML (reuses pattern from utils/markdown but self-contained) */
function mdToHtml(md: string): string {
  let html = md;
  // Remove slide layout comment
  html = html.replace(/<!--\s*slide:\s*\S+\s*-->\s*\n?/, '');
  // Two-column blocks
  html = html.replace(/::::\s*left\s*\n([\s\S]*?)::::/g, '<div class="col-left">$1</div>');
  html = html.replace(/::::\s*right\s*\n([\s\S]*?)::::/g, '<div class="col-right">$1</div>');
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
  // Paragraphs for remaining text
  html = html.replace(/\n{2,}/g, '\n<br/>\n');
  return html;
}

interface SlideCanvasProps {
  slide: Slide;
  theme: SlideTheme;
  editable?: boolean;
  onContentChange?: (content: string) => void;
  scale?: number;
  className?: string;
}

export default function SlideCanvas({ slide, theme, editable = false, onContentChange, scale, className = '' }: SlideCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const editRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (containerRef.current) applyThemeVars(containerRef.current, theme);
  }, [theme]);

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
        <div className="slide-content-render" dangerouslySetInnerHTML={{ __html: mdToHtml(slide.content) }} />
      )}
    </div>
  );
}
