import React, { useState, useEffect, useCallback } from 'react';
import { X, List } from 'lucide-react';

interface TocItem {
  id: string;
  level: number;
  text: string;
  pos: number;
}

interface TableOfContentsProps {
  editor: any;
  onClose: () => void;
}

const TableOfContents: React.FC<TableOfContentsProps> = ({ editor, onClose }) => {
  const [items, setItems] = useState<TocItem[]>([]);

  const scanHeadings = useCallback(() => {
    if (!editor) return;
    const { doc } = editor.state;
    const found: TocItem[] = [];

    doc.descendants((node: any, pos: number) => {
      if (node.type.name === 'heading') {
        found.push({
          id: `heading-${pos}`,
          level: node.attrs.level,
          text: node.textContent,
          pos,
        });
      }
    });

    setItems(found);
  }, [editor]);

  useEffect(() => {
    scanHeadings();
    if (editor) {
      const handler = () => scanHeadings();
      editor.on('transaction', handler);
      return () => editor.off('transaction', handler);
    }
  }, [editor, scanHeadings]);

  const scrollTo = (pos: number) => {
    if (!editor) return;
    editor.commands.focus();
    editor.commands.setTextSelection(pos + 1);
    editor.commands.scrollIntoView();
  };

  return (
    <div className="toc-sidebar">
      <div className="toc-header">
        <div className="toc-title">
          <List size={16} />
          <span>Outline</span>
        </div>
        <button className="toc-close-btn" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <div className="toc-list">
        {items.length === 0 ? (
          <div className="toc-empty">
            <p>No headings found</p>
            <p className="toc-empty-hint">Add headings to create an outline</p>
          </div>
        ) : (
          items.map(item => (
            <button
              key={item.id}
              className={`toc-item toc-level-${item.level}`}
              onClick={() => scrollTo(item.pos)}
            >
              {item.text}
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default TableOfContents;
