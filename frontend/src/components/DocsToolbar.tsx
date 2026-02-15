import React, { useState } from 'react';
import {
  Bold, Italic, Underline, Strikethrough, 
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Link as LinkIcon, Image as ImageIcon,
  Type, Palette, Highlighter, Undo, Redo,
  ChevronDown, MoreHorizontal
} from 'lucide-react';

interface DocsToolbarProps {
  editor: any;
}

const DocsToolbar: React.FC<DocsToolbarProps> = ({ editor }) => {
  const [showFontSize, setShowFontSize] = useState(false);
  const [showHeading, setShowHeading] = useState(false);
  const [showTextColor, setShowTextColor] = useState(false);
  const [showHighlightColor, setShowHighlightColor] = useState(false);

  if (!editor) return null;

  const fontSizes = ['8', '9', '10', '11', '12', '14', '16', '18', '20', '24', '30', '36'];
  const textColors = ['#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff', '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff'];
  const highlightColors = ['transparent', '#ffff00', '#00ff00', '#00ffff', '#ff9900', '#ff00ff', '#0000ff', '#ff0000', '#808080'];

  const getCurrentHeading = () => {
    if (editor.isActive('heading', { level: 1 })) return 'Heading 1';
    if (editor.isActive('heading', { level: 2 })) return 'Heading 2';
    if (editor.isActive('heading', { level: 3 })) return 'Heading 3';
    if (editor.isActive('heading', { level: 4 })) return 'Heading 4';
    return 'Normal text';
  };

  const setHeading = (level: number | null) => {
    if (level === null) {
      editor.chain().focus().clearNodes().run();
    } else {
      editor.chain().focus().toggleHeading({ level }).run();
    }
    setShowHeading(false);
  };

  const setFontSize = (_size: string) => {
    editor.chain().focus().run();
    // Note: TipTap doesn't have built-in font size, we'd need a custom extension
    setShowFontSize(false);
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
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-section">
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