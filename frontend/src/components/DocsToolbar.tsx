import React, { useState, useEffect, useRef, memo } from 'react';
import {
  Bold, Italic, Underline, Strikethrough, 
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Link as LinkIcon, Image as ImageIcon,
  Type, Palette, Highlighter, Undo, Redo, CheckSquare,
  ChevronDown, MoreHorizontal, Minus, Quote, Code2,
  RotateCcw, Printer, MessageSquare, PenTool, Smile,
  Paintbrush, Sparkles, Search
} from 'lucide-react';
import EmojiPicker from './EmojiPicker';

interface DocsToolbarProps {
  editor: any;
}

const DocsToolbar: React.FC<DocsToolbarProps> = ({ editor }) => {
  // Only re-render toolbar when active formatting state actually changes
  const lastActiveRef = useRef('');
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      // Build a fingerprint of current active marks/nodes
      const marks = ['bold', 'italic', 'underline', 'strike', 'code', 'highlight', 'superscript', 'subscript'];
      const nodes = ['bulletList', 'orderedList', 'taskList', 'blockquote', 'codeBlock'];
      const alignments = ['left', 'center', 'right', 'justify'];
      let fp = '';
      for (const m of marks) fp += editor.isActive(m) ? '1' : '0';
      for (const n of nodes) fp += editor.isActive(n) ? '1' : '0';
      for (const a of alignments) fp += editor.isActive({ textAlign: a }) ? '1' : '0';
      for (let i = 1; i <= 6; i++) fp += editor.isActive('heading', { level: i }) ? '1' : '0';
      fp += editor.isActive('title') ? '1' : '0';
      fp += editor.isActive('subtitle') ? '1' : '0';
      if (fp !== lastActiveRef.current) {
        lastActiveRef.current = fp;
        setTick(t => t + 1);
      }
    };
    editor.on('selectionUpdate', handler);
    editor.on('transaction', handler);
    return () => {
      editor.off('selectionUpdate', handler);
      editor.off('transaction', handler);
    };
  }, [editor]);

  const [paintFormatActive, setPaintFormatActive] = useState(false);
  const paintClickCountRef = useRef(0);
  const paintClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Listen for paint format state changes
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setPaintFormatActive(detail.active);
    };
    window.addEventListener('paint-format-change', handler);
    return () => window.removeEventListener('paint-format-change', handler);
  }, []);

  const handlePaintFormatClick = () => {
    paintClickCountRef.current++;
    if (paintClickTimerRef.current) clearTimeout(paintClickTimerRef.current);
    
    paintClickTimerRef.current = setTimeout(() => {
      const clicks = paintClickCountRef.current;
      paintClickCountRef.current = 0;
      
      if (paintFormatActive) {
        // Already active — toggle off
        setPaintFormatActive(false);
        window.dispatchEvent(new CustomEvent('paint-format-clear'));
        window.dispatchEvent(new CustomEvent('paint-format-change', { detail: { active: false, persistent: false } }));
      } else {
        const persistent = clicks >= 2;
        setPaintFormatActive(true);
        window.dispatchEvent(new CustomEvent('paint-format-copy', { detail: { persistent } }));
        window.dispatchEvent(new CustomEvent('paint-format-change', { detail: { active: true, persistent } }));
      }
    }, 250);
  };

  const [showFontSize, setShowFontSize] = useState(false);
  const [showFontFamily, setShowFontFamily] = useState(false);
  const [showHeading, setShowHeading] = useState(false);
  const [showTextColor, setShowTextColor] = useState(false);
  const [showHighlightColor, setShowHighlightColor] = useState(false);
  const [showLineSpacing, setShowLineSpacing] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const lineSpacingRef = useRef<HTMLDivElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showLineSpacing) return;
    const handler = (e: MouseEvent) => {
      if (lineSpacingRef.current && !lineSpacingRef.current.contains(e.target as Node)) {
        setShowLineSpacing(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showLineSpacing]);

  if (!editor) return null;

  const fontSizes = ['8', '9', '10', '11', '12', '14', '16', '18', '20', '24', '30', '36'];
  const fontFamilies = [
    { name: 'Arial', value: 'Arial, sans-serif' },
    { name: 'Times New Roman', value: 'Times New Roman, serif' },
    { name: 'Georgia', value: 'Georgia, serif' },
    { name: 'Helvetica', value: 'Helvetica, sans-serif' },
    { name: 'Courier New', value: 'Courier New, monospace' },
    { name: 'Comic Sans MS', value: 'Comic Sans MS, cursive' },
    { name: 'Impact', value: 'Impact, sans-serif' },
    { name: 'Verdana', value: 'Verdana, sans-serif' }
  ];
  const textColors = ['#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff', '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff'];
  const highlightColors = ['transparent', '#ffff00', '#00ff00', '#00ffff', '#ff9900', '#ff00ff', '#0000ff', '#ff0000', '#808080'];

  const getCurrentStyle = () => {
    if (editor.isActive('title')) return 'Title';
    if (editor.isActive('subtitle')) return 'Subtitle';
    if (editor.isActive('heading', { level: 1 })) return 'Heading 1';
    if (editor.isActive('heading', { level: 2 })) return 'Heading 2';
    if (editor.isActive('heading', { level: 3 })) return 'Heading 3';
    if (editor.isActive('heading', { level: 4 })) return 'Heading 4';
    if (editor.isActive('heading', { level: 5 })) return 'Heading 5';
    if (editor.isActive('heading', { level: 6 })) return 'Heading 6';
    return 'Normal text';
  };

  const getCurrentFontFamily = () => {
    // Try to get the current font family from the editor
    const attrs = editor.getAttributes('textStyle');
    if (attrs.fontFamily) {
      const found = fontFamilies.find(f => f.value === attrs.fontFamily);
      return found ? found.name : 'Arial';
    }
    return 'Arial';
  };

  const setParagraphStyle = (style: string) => {
    switch (style) {
      case 'normal':
        editor.chain().focus().clearNodes().run();
        break;
      case 'title':
        (editor.chain().focus() as any).setTitle().run();
        break;
      case 'subtitle':
        (editor.chain().focus() as any).setSubtitle().run();
        break;
      default: {
        const level = parseInt(style.replace('h', ''));
        if (level >= 1 && level <= 6) {
          editor.chain().focus().toggleHeading({ level: level as 1|2|3|4|5|6 }).run();
        }
      }
    }
    setShowHeading(false);
  };

  const setFontFamily = (fontFamily: string) => {
    if (fontFamily === 'default') {
      editor.chain().focus().unsetFontFamily().run();
    } else {
      editor.chain().focus().setFontFamily(fontFamily).run();
    }
    setShowFontFamily(false);
  };

  const setFontSize = (_size: string) => {
    editor.chain().focus().run();
    // Note: TipTap doesn't have built-in font size, we'd need a custom extension
    setShowFontSize(false);
  };

  const clearFormatting = () => {
    editor.chain().focus().clearNodes().unsetAllMarks().run();
  };

  const insertHorizontalRule = () => {
    editor.chain().focus().setHorizontalRule().run();
  };

  const printDocument = () => {
    window.print();
  };

  const setLink = () => {
    window.dispatchEvent(new CustomEvent('insert-link'));
  };

  const addImage = () => {
    window.dispatchEvent(new CustomEvent('insert-image'));
  };

  const setTextColor = (color: string) => {
    if (color === '#000000') {
      editor.chain().focus().unsetColor().run();
    } else {
      editor.chain().focus().setColor(color).run();
    }
    setShowTextColor(false);
  };

  const setHighlightColor = (color: string) => {
    if (color === 'transparent') {
      editor.chain().focus().unsetHighlight().run();
    } else {
      editor.chain().focus().setHighlight({ color }).run();
    }
    setShowHighlightColor(false);
  };

  return (
    <div className="docs-toolbar">
      <div className="toolbar-section">
        {/* Undo/Redo */}
        <button 
          className="toolbar-btn"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
        >
          <Undo size={16} />
        </button>
        <button 
          className="toolbar-btn"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo (Ctrl+Y)"
          aria-label="Redo"
        >
          <Redo size={16} />
        </button>
        
        {/* Print */}
        <button 
          className="toolbar-btn"
          onClick={printDocument}
          title="Print (Ctrl+P)"
          aria-label="Print"
        >
          <Printer size={16} />
        </button>

        {/* Paint Format */}
        <button 
          className={`toolbar-btn ${paintFormatActive ? 'active' : ''}`}
          onClick={handlePaintFormatClick}
          title="Paint format (click to copy, double-click for persistent mode)"
          aria-label="Paint format"
        >
          <Paintbrush size={16} />
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-section">
        {/* Font Family */}
        <div className="dropdown-container">
          <button 
            className="toolbar-dropdown-btn"
            onClick={() => setShowFontFamily(!showFontFamily)}
            style={{ minWidth: '100px' }}
          >
            <span>{getCurrentFontFamily()}</span>
            <ChevronDown size={12} />
          </button>
          {showFontFamily && (
            <div className="toolbar-dropdown">
              {fontFamilies.map(font => (
                <button
                  key={font.name}
                  className="dropdown-item"
                  onClick={() => setFontFamily(font.value)}
                  style={{ fontFamily: font.value }}
                >
                  {font.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Font Size */}
        <div className="dropdown-container">
          <button 
            className="toolbar-dropdown-btn"
            onClick={() => setShowFontSize(!showFontSize)}
          >
            <Type size={14} />
            <span>11</span>
            <ChevronDown size={12} />
          </button>
          {showFontSize && (
            <div className="toolbar-dropdown">
              {fontSizes.map(size => (
                <button
                  key={size}
                  className="dropdown-item"
                  onClick={() => setFontSize(size)}
                >
                  {size}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Paragraph Styles Dropdown */}
        <div className="dropdown-container">
          <button 
            className="toolbar-dropdown-btn paragraph-style-btn"
            onClick={() => setShowHeading(!showHeading)}
          >
            <span>{getCurrentStyle()}</span>
            <ChevronDown size={12} />
          </button>
          {showHeading && (
            <div className="toolbar-dropdown paragraph-styles-dropdown">
              <button className={`dropdown-item ps-normal${getCurrentStyle() === 'Normal text' ? ' ps-active' : ''}`} onClick={() => setParagraphStyle('normal')}>
                Normal text
              </button>
              <button className={`dropdown-item ps-title${getCurrentStyle() === 'Title' ? ' ps-active' : ''}`} onClick={() => setParagraphStyle('title')}>
                Title
              </button>
              <button className={`dropdown-item ps-subtitle${getCurrentStyle() === 'Subtitle' ? ' ps-active' : ''}`} onClick={() => setParagraphStyle('subtitle')}>
                Subtitle
              </button>
              <div className="ps-divider" />
              <button className={`dropdown-item ps-h1${getCurrentStyle() === 'Heading 1' ? ' ps-active' : ''}`} onClick={() => setParagraphStyle('h1')}>
                Heading 1
              </button>
              <button className={`dropdown-item ps-h2${getCurrentStyle() === 'Heading 2' ? ' ps-active' : ''}`} onClick={() => setParagraphStyle('h2')}>
                Heading 2
              </button>
              <button className={`dropdown-item ps-h3${getCurrentStyle() === 'Heading 3' ? ' ps-active' : ''}`} onClick={() => setParagraphStyle('h3')}>
                Heading 3
              </button>
              <button className={`dropdown-item ps-h4${getCurrentStyle() === 'Heading 4' ? ' ps-active' : ''}`} onClick={() => setParagraphStyle('h4')}>
                Heading 4
              </button>
              <button className={`dropdown-item ps-h5${getCurrentStyle() === 'Heading 5' ? ' ps-active' : ''}`} onClick={() => setParagraphStyle('h5')}>
                Heading 5
              </button>
              <button className={`dropdown-item ps-h6${getCurrentStyle() === 'Heading 6' ? ' ps-active' : ''}`} onClick={() => setParagraphStyle('h6')}>
                Heading 6
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-section">
        {/* Text Formatting */}
        <button 
          className={`toolbar-btn ${editor.isActive('bold') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold (Ctrl+B)" aria-label="Bold"
        >
          <Bold size={16} />
        </button>
        <button 
          className={`toolbar-btn ${editor.isActive('italic') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic (Ctrl+I)" aria-label="Italic"
        >
          <Italic size={16} />
        </button>
        <button 
          className={`toolbar-btn ${editor.isActive('underline') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline (Ctrl+U)" aria-label="Underline"
        >
          <Underline size={16} />
        </button>
        <button 
          className={`toolbar-btn ${editor.isActive('strike') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Strikethrough" aria-label="Strikethrough"
        >
          <Strikethrough size={16} />
        </button>

        {/* Text Color */}
        <div className="dropdown-container">
          <button 
            className="toolbar-btn color-btn"
            onClick={() => setShowTextColor(!showTextColor)}
            title="Text color" aria-label="Text color"
          >
            <Palette size={16} />
            <ChevronDown size={10} />
          </button>
          {showTextColor && (
            <div className="color-dropdown">
              <div className="color-grid">
                {textColors.map(color => (
                  <button
                    key={color}
                    className="color-swatch"
                    style={{ backgroundColor: color, border: color === '#ffffff' ? '1px solid #ccc' : 'none' }}
                    onClick={() => setTextColor(color)}
                    title={color}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Highlight Color */}
        <div className="dropdown-container">
          <button 
            className="toolbar-btn color-btn"
            onClick={() => setShowHighlightColor(!showHighlightColor)}
            title="Highlight color" aria-label="Highlight color"
          >
            <Highlighter size={16} />
            <ChevronDown size={10} />
          </button>
          {showHighlightColor && (
            <div className="color-dropdown">
              <div className="color-grid">
                {highlightColors.map(color => (
                  <button
                    key={color}
                    className="color-swatch"
                    style={{ 
                      backgroundColor: color === 'transparent' ? '#fff' : color,
                      border: '1px solid #ccc',
                      position: 'relative'
                    }}
                    onClick={() => setHighlightColor(color)}
                    title={color === 'transparent' ? 'No highlight' : color}
                  >
                    {color === 'transparent' && (
                      <span style={{ 
                        position: 'absolute', 
                        top: '50%', 
                        left: '50%', 
                        transform: 'translate(-50%, -50%)',
                        fontSize: '12px',
                        color: '#666'
                      }}>
                        ×
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Superscript / Subscript */}
        <button 
          className={`toolbar-btn ${editor.isActive('superscript') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleSuperscript().run()}
          title="Superscript" aria-label="Superscript"
        >
          <span style={{ fontSize: '12px', fontWeight: 'bold' }}>x²</span>
        </button>
        <button 
          className={`toolbar-btn ${editor.isActive('subscript') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleSubscript().run()}
          title="Subscript" aria-label="Subscript"
        >
          <span style={{ fontSize: '12px', fontWeight: 'bold' }}>x₂</span>
        </button>

        {/* Clear Formatting */}
        <button 
          className="toolbar-btn"
          onClick={clearFormatting}
          title="Clear formatting" aria-label="Clear formatting"
        >
          <RotateCcw size={16} />
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-section">
        {/* Alignment */}
        <button 
          className={`toolbar-btn ${editor.isActive({ textAlign: 'left' }) ? 'active' : ''}`}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          title="Align left (Ctrl+Shift+L)" aria-label="Align left"
        >
          <AlignLeft size={16} />
        </button>
        <button 
          className={`toolbar-btn ${editor.isActive({ textAlign: 'center' }) ? 'active' : ''}`}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          title="Align center (Ctrl+Shift+E)" aria-label="Align center"
        >
          <AlignCenter size={16} />
        </button>
        <button 
          className={`toolbar-btn ${editor.isActive({ textAlign: 'right' }) ? 'active' : ''}`}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          title="Align right (Ctrl+Shift+R)" aria-label="Align right"
        >
          <AlignRight size={16} />
        </button>
        <button 
          className={`toolbar-btn ${editor.isActive({ textAlign: 'justify' }) ? 'active' : ''}`}
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          title="Justify (Ctrl+Shift+J)" aria-label="Justify"
        >
          <AlignJustify size={16} />
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-section">
        {/* Lists */}
        <button 
          className={`toolbar-btn ${editor.isActive('bulletList') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet list (Ctrl+Shift+8)" aria-label="Bullet list"
        >
          <List size={16} />
        </button>
        <button 
          className={`toolbar-btn ${editor.isActive('orderedList') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Numbered list (Ctrl+Shift+7)" aria-label="Numbered list"
        >
          <ListOrdered size={16} />
        </button>

        {/* Task List / Checklist */}
        <button 
          className={`toolbar-btn ${editor.isActive('taskList') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          title="Checklist" aria-label="Checklist"
        >
          <CheckSquare size={16} />
        </button>

        {/* Indent/Outdent */}
        <button 
          className="toolbar-btn"
          onClick={() => editor.chain().focus().liftListItem('listItem').run()}
          title="Decrease indent (Ctrl+[)" aria-label="Decrease indent"
        >
          <span style={{ fontSize: '14px', fontWeight: 'bold' }}>⇤</span>
        </button>
        <button 
          className="toolbar-btn"
          onClick={() => editor.chain().focus().sinkListItem('listItem').run()}
          title="Increase indent (Ctrl+])" aria-label="Increase indent"
        >
          <span style={{ fontSize: '14px', fontWeight: 'bold' }}>⇥</span>
        </button>

        {/* Line Spacing */}
        <div ref={lineSpacingRef} style={{ position: 'relative' }}>
          <button
            className="toolbar-btn"
            onClick={() => setShowLineSpacing(!showLineSpacing)}
            title="Line spacing" aria-label="Line spacing"
          >
            <AlignJustify size={16} />
            <ChevronDown size={10} />
          </button>
          {showLineSpacing && (
            <div className="line-spacing-dropdown" onMouseDown={(e) => e.preventDefault()}>
              {['1', '1.15', '1.5', '2', '2.5', '3'].map((val) => {
                const current = editor.getAttributes('paragraph').lineHeight;
                const isActive = current === val || (!current && val === '1.15');
                return (
                  <button
                    key={val}
                    className={`line-spacing-option${isActive ? ' active' : ''}`}
                    onClick={() => {
                      (editor.chain().focus() as any).setLineHeight(val).run();
                      setShowLineSpacing(false);
                    }}
                  >
                    {isActive && <span style={{ marginRight: 8 }}>✓</span>}
                    {val}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-section">
        {/* Block Elements */}
        <button 
          className={`toolbar-btn ${editor.isActive('blockquote') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Quote" aria-label="Block quote"
        >
          <Quote size={16} />
        </button>
        
        <button 
          className={`toolbar-btn ${editor.isActive('codeBlock') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          title="Code block" aria-label="Code block"
        >
          <Code2 size={16} />
        </button>

        {/* Horizontal Rule */}
        <button 
          className="toolbar-btn"
          onClick={insertHorizontalRule}
          title="Insert horizontal rule" aria-label="Insert horizontal rule"
        >
          <Minus size={16} />
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-section">
        {/* Insert */}
        <button 
          className="toolbar-btn"
          onClick={setLink}
          title="Insert link (Ctrl+K)" aria-label="Insert link"
        >
          <LinkIcon size={16} />
        </button>
        <button 
          className="toolbar-btn"
          onClick={addImage}
          title="Insert image" aria-label="Insert image"
        >
          <ImageIcon size={16} />
        </button>

        {/* Suggestion Mode Toggle */}
        <button
          className={`toolbar-btn ${editor.isActive('suggestion') ? 'active' : ''}`}
          onClick={() => {
            editor.chain().focus().toggleSuggestionMode().run();
            window.dispatchEvent(new CustomEvent('suggestion-mode-toggle'));
          }}
          title="Suggesting mode (track changes)" aria-label="Suggesting mode"
        >
          <PenTool size={16} />
        </button>

        {/* Comment */}
        <button
          className="toolbar-btn"
          onClick={() => {
            const { from, to } = editor.state.selection;
            if (from === to) return; // Need selected text
            const commentId = `c-${Date.now()}`;
            editor.chain().focus().setComment(commentId).run();
            const selectedText = editor.state.doc.textBetween(from, to, ' ');
            window.dispatchEvent(new CustomEvent('comment-add', { detail: { commentId, quotedText: selectedText } }));
          }}
          title="Add comment (select text first)" aria-label="Add comment"
        >
          <MessageSquare size={16} />
        </button>

        {/* Table */}
        <button
          className="toolbar-btn"
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          title="Insert table" aria-label="Insert table"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
        </button>

        {/* Emoji Picker */}
        <div ref={emojiRef} style={{ position: 'relative' }}>
          <button
            className="toolbar-btn"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            title="Insert emoji" aria-label="Insert emoji"
          >
            <Smile size={16} />
          </button>
          {showEmojiPicker && (
            <EmojiPicker
              onSelect={(emoji) => {
                editor.chain().focus().insertContent(emoji).run();
                setShowEmojiPicker(false);
              }}
              onClose={() => setShowEmojiPicker(false)}
            />
          )}
        </div>

        {/* Global Search */}
        <button
          className="toolbar-btn"
          onClick={() => window.dispatchEvent(new CustomEvent('global-search-toggle'))}
          title="Search across all documents (⌘⇧F)" aria-label="Global search"
        >
          <Search size={16} />
        </button>

        {/* AI Assistant */}
        <button
          className="toolbar-btn"
          onClick={() => window.dispatchEvent(new CustomEvent('ai-assistant-toggle'))}
          title="AI Writing Assistant" aria-label="AI Assistant"
          style={{ color: '#f4b400' }}
        >
          <Sparkles size={16} />
        </button>

        <div className="toolbar-divider" />

        {/* More options */}
        <button 
          className="toolbar-btn"
          title="More options" aria-label="More options"
        >
          <MoreHorizontal size={16} />
        </button>
      </div>
    </div>
  );
};

export default memo(DocsToolbar, (prev, next) => {
  // Only re-render when the editor instance itself changes
  // The toolbar reads active state from editor on render, but we don't need
  // to re-render on every transaction — only when editor ref changes
  return prev.editor === next.editor;
});