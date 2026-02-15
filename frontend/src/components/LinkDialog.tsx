import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Bookmark, Trash2 } from 'lucide-react';

interface BookmarkItem {
  id: string;
  name: string;
}

interface LinkDialogProps {
  editor: any;
  isOpen: boolean;
  onClose: () => void;
}

const LinkDialog: React.FC<LinkDialogProps> = ({ editor, isOpen, onClose }) => {
  const [url, setUrl] = useState('');
  const [displayText, setDisplayText] = useState('');
  const [openInNewTab, setOpenInNewTab] = useState(false);
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const urlInputRef = useRef<HTMLInputElement>(null);

  // Gather bookmarks from the document
  const gatherBookmarks = useCallback(() => {
    if (!editor) return [];
    const items: BookmarkItem[] = [];
    editor.state.doc.descendants((node: any) => {
      if (node.type.name === 'bookmark' && node.attrs.name) {
        items.push({ id: node.attrs.id, name: node.attrs.name });
      }
    });
    return items;
  }, [editor]);

  useEffect(() => {
    if (!isOpen || !editor) return;

    setBookmarks(gatherBookmarks());

    // Check if cursor is on an existing link
    const { from, to } = editor.state.selection;
    const linkMark = editor.getAttributes('link');

    if (linkMark.href) {
      setUrl(linkMark.href);
      setOpenInNewTab(linkMark.target === '_blank');
      setIsEditing(true);
      // Get selected text or link text
      const text = editor.state.doc.textBetween(from, to, ' ');
      setDisplayText(text);
    } else {
      setUrl('');
      setOpenInNewTab(false);
      setIsEditing(false);
      const text = editor.state.doc.textBetween(from, to, ' ');
      setDisplayText(text);
    }

    // Focus URL input after render
    setTimeout(() => urlInputRef.current?.focus(), 50);
  }, [isOpen, editor, gatherBookmarks]);

  if (!isOpen) return null;

  const handleApply = () => {
    if (!editor || !url) return;

    const { from, to } = editor.state.selection;
    const hasSelection = from !== to;

    const attrs: any = { href: url };
    if (openInNewTab) attrs.target = '_blank';

    if (displayText && (!hasSelection || displayText !== editor.state.doc.textBetween(from, to, ' '))) {
      // Insert new text with link
      editor
        .chain()
        .focus()
        .deleteSelection()
        .insertContent(`<a href="${url}"${openInNewTab ? ' target="_blank"' : ''}>${displayText}</a>`)
        .run();
    } else {
      // Apply link to selection
      editor.chain().focus().setLink(attrs).run();
    }

    onClose();
  };

  const handleRemove = () => {
    if (!editor) return;
    editor.chain().focus().unsetLink().run();
    onClose();
  };

  const handleBookmarkClick = (bookmark: BookmarkItem) => {
    setUrl(`#${bookmark.id}`);
    if (!displayText) setDisplayText(bookmark.name);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleApply();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="link-dialog-overlay" onClick={onClose}>
      <div className="link-dialog" onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        {/* Header */}
        <div className="link-dialog-header">
          <h3>{isEditing ? 'Edit link' : 'Insert link'}</h3>
          <button className="link-dialog-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="link-dialog-body">
          <div className="link-dialog-field">
            <label>Text</label>
            <input
              type="text"
              value={displayText}
              onChange={(e) => setDisplayText(e.target.value)}
              placeholder="Text to display"
            />
          </div>

          <div className="link-dialog-field">
            <label>Link</label>
            <input
              ref={urlInputRef}
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste or type a link"
            />
          </div>

          <div className="link-dialog-checkbox">
            <label>
              <input
                type="checkbox"
                checked={openInNewTab}
                onChange={(e) => setOpenInNewTab(e.target.checked)}
              />
              <span>Open in new tab</span>
            </label>
          </div>

          {/* Bookmarks section */}
          {bookmarks.length > 0 && (
            <div className="link-dialog-bookmarks">
              <div className="link-dialog-bookmarks-title">
                <Bookmark size={14} />
                <span>Bookmarks in this document</span>
              </div>
              <div className="link-dialog-bookmarks-list">
                {bookmarks.map((bm) => (
                  <button
                    key={bm.id}
                    className={`link-dialog-bookmark-item ${url === `#${bm.id}` ? 'active' : ''}`}
                    onClick={() => handleBookmarkClick(bm)}
                  >
                    <Bookmark size={12} />
                    <span>{bm.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="link-dialog-footer">
          {isEditing && (
            <button className="link-dialog-remove-btn" onClick={handleRemove}>
              <Trash2 size={14} />
              <span>Remove</span>
            </button>
          )}
          <div className="link-dialog-footer-right">
            <button className="link-dialog-cancel-btn" onClick={onClose}>
              Cancel
            </button>
            <button
              className="link-dialog-apply-btn"
              onClick={handleApply}
              disabled={!url}
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LinkDialog;
