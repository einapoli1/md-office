import React, { useState } from 'react';
import {
  Bold, Italic, Underline, Strikethrough, 
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Link as LinkIcon, Image as ImageIcon,
  Type, Palette, Highlighter, Undo, Redo, CheckSquare,
  ChevronDown, MoreHorizontal, Minus, Quote, Code2,
  RotateCcw, Printer, MessageSquare, PenTool
} from 'lucide-react';

interface DocsToolbarProps {
  editor: any;
}

const DocsToolbar: React.FC<DocsToolbarProps> = ({ editor }) => {
  const [showFontSize, setShowFontSize] = useState(false);
  const [showFontFamily, setShowFontFamily] = useState(false);
  const [showHeading, setShowHeading] = useState(false);
  const [showTextColor, setShowTextColor] = useState(false);
  const [showHighlightColor, setShowHighlightColor] = useState(false);

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

  const getCurrentHeading = () => {
    if (editor.isActive('heading', { level: 1 })) return 'Heading 1';
    if (editor.isActive('heading', { level: 2 })) return 'Heading 2';
    if (editor.isActive('heading', { level: 3 })) return 'Heading 3';
    if (editor.isActive('heading', { level: 4 })) return 'Heading 4';
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

  const setHeading = (level: number | null) => {
    if (level === null) {
      editor.chain().focus().clearNodes().run();
    } else {
      editor.chain().focus().toggleHeading({ level }).run();
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
    const url = window.prompt('Enter URL:', 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
  };

  const addImage = () => {
    const url = window.prompt('Enter image URL:');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
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
        >
          <Undo size={16} />
        </button>
        <button 
          className="toolbar-btn"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo (Ctrl+Y)"
        >
          <Redo size={16} />
        </button>
        
        {/* Print */}
        <button 
          className="toolbar-btn"
          onClick={printDocument}
          title="Print (Ctrl+P)"
        >
          <Printer size={16} />
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

        {/* Heading Dropdown */}
        <div className="dropdown-container">
          <button 
            className="toolbar-dropdown-btn heading-btn"
            onClick={() => setShowHeading(!showHeading)}
          >
            <span>{getCurrentHeading()}</span>
            <ChevronDown size={12} />
          </button>
          {showHeading && (
            <div className="toolbar-dropdown">
              <button
                className="dropdown-item"
                onClick={() => setHeading(null)}
              >
                Normal text
              </button>
              <button
                className="dropdown-item heading-1"
                onClick={() => setHeading(1)}
              >
                Heading 1
              </button>
              <button
                className="dropdown-item heading-2"
                onClick={() => setHeading(2)}
              >
                Heading 2
              </button>
              <button
                className="dropdown-item heading-3"
                onClick={() => setHeading(3)}
              >
                Heading 3
              </button>
              <button
                className="dropdown-item heading-4"
                onClick={() => setHeading(4)}
              >
                Heading 4
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
          title="Bold (Ctrl+B)"
        >
          <Bold size={16} />
        </button>
        <button 
          className={`toolbar-btn ${editor.isActive('italic') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic (Ctrl+I)"
        >
          <Italic size={16} />
        </button>
        <button 
          className={`toolbar-btn ${editor.isActive('underline') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline (Ctrl+U)"
        >
          <Underline size={16} />
        </button>
        <button 
          className={`toolbar-btn ${editor.isActive('strike') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Strikethrough"
        >
          <Strikethrough size={16} />
        </button>

        {/* Text Color */}
        <div className="dropdown-container">
          <button 
            className="toolbar-btn color-btn"
            onClick={() => setShowTextColor(!showTextColor)}
            title="Text color"
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
            title="Highlight color"
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
          title="Superscript"
        >
          <span style={{ fontSize: '12px', fontWeight: 'bold' }}>x²</span>
        </button>
        <button 
          className={`toolbar-btn ${editor.isActive('subscript') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleSubscript().run()}
          title="Subscript"
        >
          <span style={{ fontSize: '12px', fontWeight: 'bold' }}>x₂</span>
        </button>

        {/* Clear Formatting */}
        <button 
          className="toolbar-btn"
          onClick={clearFormatting}
          title="Clear formatting"
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
          title="Align left (Ctrl+Shift+L)"
        >
          <AlignLeft size={16} />
        </button>
        <button 
          className={`toolbar-btn ${editor.isActive({ textAlign: 'center' }) ? 'active' : ''}`}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          title="Align center (Ctrl+Shift+E)"
        >
          <AlignCenter size={16} />
        </button>
        <button 
          className={`toolbar-btn ${editor.isActive({ textAlign: 'right' }) ? 'active' : ''}`}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          title="Align right (Ctrl+Shift+R)"
        >
          <AlignRight size={16} />
        </button>
        <button 
          className={`toolbar-btn ${editor.isActive({ textAlign: 'justify' }) ? 'active' : ''}`}
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          title="Justify (Ctrl+Shift+J)"
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
          title="Bullet list (Ctrl+Shift+8)"
        >
          <List size={16} />
        </button>
        <button 
          className={`toolbar-btn ${editor.isActive('orderedList') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Numbered list (Ctrl+Shift+7)"
        >
          <ListOrdered size={16} />
        </button>

        {/* Task List / Checklist */}
        <button 
          className={`toolbar-btn ${editor.isActive('taskList') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          title="Checklist"
        >
          <CheckSquare size={16} />
        </button>

        {/* Indent/Outdent */}
        <button 
          className="toolbar-btn"
          onClick={() => editor.chain().focus().liftListItem('listItem').run()}
          title="Decrease indent (Ctrl+[)"
        >
          <span style={{ fontSize: '14px', fontWeight: 'bold' }}>⇤</span>
        </button>
        <button 
          className="toolbar-btn"
          onClick={() => editor.chain().focus().sinkListItem('listItem').run()}
          title="Increase indent (Ctrl+])"
        >
          <span style={{ fontSize: '14px', fontWeight: 'bold' }}>⇥</span>
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-section">
        {/* Block Elements */}
        <button 
          className={`toolbar-btn ${editor.isActive('blockquote') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Quote"
        >
          <Quote size={16} />
        </button>
        
        <button 
          className={`toolbar-btn ${editor.isActive('codeBlock') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          title="Code block"
        >
          <Code2 size={16} />
        </button>

        {/* Horizontal Rule */}
        <button 
          className="toolbar-btn"
          onClick={insertHorizontalRule}
          title="Insert horizontal rule"
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
          title="Insert link (Ctrl+K)"
        >
          <LinkIcon size={16} />
        </button>
        <button 
          className="toolbar-btn"
          onClick={addImage}
          title="Insert image"
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
          title="Suggesting mode (track changes)"
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
          title="Add comment (select text first)"
        >
          <MessageSquare size={16} />
        </button>

        {/* Table */}
        <button
          className="toolbar-btn"
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          title="Insert table"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
        </button>

        {/* More options */}
        <button 
          className="toolbar-btn"
          title="More options"
        >
          <MoreHorizontal size={16} />
        </button>
      </div>
    </div>
  );
};

export default DocsToolbar;