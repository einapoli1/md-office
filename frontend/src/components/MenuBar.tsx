import React, { useState, useRef, useEffect } from 'react';
import { Share2, Settings, Moon, Sun, FileText, Plus, LogIn, LogOut, User } from 'lucide-react';
import { FileContent } from '../types';

interface MenuBarProps {
  onNewFile: () => void;
  onTemplateSelect: () => void;
  onPrint: () => void;
  onShowSettings?: () => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  saveStatus: 'saved' | 'saving' | 'unsaved' | 'error';
  isGuestMode?: boolean;
  isAuthenticated?: boolean;
  onLogin?: () => void;
  onLogout?: () => void;
  onSwitchToGuest?: () => void;
  activeFile?: FileContent | null;
  onTitleChange?: (newPath: string) => void;
  editor?: any;
}

const MenuBar: React.FC<MenuBarProps> = ({
  onNewFile,
  onTemplateSelect,
  onPrint,
  onShowSettings,
  isDarkMode = false,
  onToggleDarkMode,
  saveStatus,
  isGuestMode = false,
  isAuthenticated = false,
  onLogin,
  onLogout,
  onSwitchToGuest,
  activeFile,
  onTitleChange,
  editor,
}) => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [documentTitle, setDocumentTitle] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Update document title when active file changes
  useEffect(() => {
    if (activeFile) {
      const title = activeFile.path.replace(/\.md$/, '').replace(/.*\//, '');
      setDocumentTitle(title);
    } else {
      setDocumentTitle('');
    }
  }, [activeFile]);

  interface MenuItem {
    label: string;
    action?: () => void;
    shortcut?: string;
    icon?: any; // Using any to avoid LucideIcon type issues
  }

  // Build account menu based on authentication state
  const accountItems: MenuItem[] = [];
  if (isGuestMode && !isAuthenticated) {
    accountItems.push(
      { label: 'Sign in', action: onLogin, icon: LogIn },
      { label: 'Create account', action: onLogin, icon: User }
    );
  } else if (isAuthenticated) {
    accountItems.push(
      { label: 'Sign out', action: onLogout, icon: LogOut },
      { label: 'Switch to guest mode', action: onSwitchToGuest, icon: User }
    );
  }

  const menus: Record<string, MenuItem[]> = {
    File: [
      { label: 'New', action: onNewFile, shortcut: 'Ctrl+N' },
      { label: 'From template', action: onTemplateSelect },
      { label: 'divider' },
      { label: 'Download', action: () => {
        window.dispatchEvent(new CustomEvent('export-open'));
      }},
      { label: 'Print', action: onPrint, shortcut: '⌘P' },
      { label: 'divider' },
      { label: 'Share', action: () => {
        const url = new URL(window.location.href);
        url.searchParams.set('collab', '1');
        navigator.clipboard.writeText(url.toString()).then(() => {
          alert('Collaboration link copied to clipboard! Share it with others to edit together.\n\n' + url.toString());
        }).catch(() => {
          prompt('Share this link for collaboration:', url.toString());
        });
        // Enable collab mode if not already
        if (!url.searchParams.has('collab')) {
          window.location.href = url.toString();
        }
      }, icon: Share2 },
    ],
    Edit: [
      { label: 'Undo', action: () => editor?.chain().focus().undo().run(), shortcut: '⌘Z' },
      { label: 'Redo', action: () => editor?.chain().focus().redo().run(), shortcut: '⌘Y' },
      { label: 'divider' },
      { label: 'Find and replace', action: () => {
        window.dispatchEvent(new CustomEvent('find-replace-open', { detail: { replace: false } }));
      }, shortcut: '⌘F' },
    ],
    View: [
      { label: 'Show ruler', action: () => {
        window.dispatchEvent(new CustomEvent('ruler-toggle'));
      }},
      { label: 'Document outline', action: () => {
        window.dispatchEvent(new CustomEvent('outline-toggle'));
      }},
      { label: 'Full screen', action: () => {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen();
      }, shortcut: 'F11' },
      { label: 'divider' },
      { label: isDarkMode ? 'Light mode' : 'Dark mode', action: onToggleDarkMode, icon: isDarkMode ? Sun : Moon },
    ],
    Insert: [
      { label: 'Image', action: () => {
        window.dispatchEvent(new CustomEvent('insert-image'));
      }},
      { label: 'Link', action: () => {
        window.dispatchEvent(new CustomEvent('insert-link'));
      }, shortcut: '⌘K' },
      { label: 'Table', action: () => {
        if (editor) editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
      }},
      { label: 'divider' },
      { label: 'Horizontal rule', action: () => {
        if (editor) editor.chain().focus().setHorizontalRule().run();
      }},
      { label: 'Equation', action: () => console.log('Insert equation') },
      { label: 'divider' },
      { label: 'Special characters', action: () => {
        window.dispatchEvent(new CustomEvent('special-chars-open'));
      }},
      { label: 'Emoji', action: () => {
        window.dispatchEvent(new CustomEvent('emoji-picker-open'));
      }},
      { label: 'divider' },
      { label: 'Page numbers', action: () => {
        window.dispatchEvent(new CustomEvent('edit-header-footer', { detail: { type: 'footer' } }));
      }},
      { label: 'Header', action: () => {
        window.dispatchEvent(new CustomEvent('edit-header-footer', { detail: { type: 'header' } }));
      }},
      { label: 'Footer', action: () => {
        window.dispatchEvent(new CustomEvent('edit-header-footer', { detail: { type: 'footer' } }));
      }},
      { label: 'divider' },
      { label: 'Footnote', action: () => {
        const content = prompt('Footnote text:');
        if (content && editor) {
          editor.commands.setFootnote(content);
        }
      }, shortcut: '⌘⇧F' },
      { label: 'Table of contents', action: () => {
        if (editor) {
          editor.commands.insertTableOfContents();
        }
      }},
      { label: 'divider' },
      { label: 'Bookmark', action: () => {
        const name = prompt('Bookmark name:');
        if (name && editor) {
          editor.commands.insertBookmark(name);
        }
      }},
    ],
    Format: [
      { label: 'Bold', action: () => editor?.chain().focus().toggleBold().run(), shortcut: 'Ctrl+B' },
      { label: 'Italic', action: () => editor?.chain().focus().toggleItalic().run(), shortcut: 'Ctrl+I' },
      { label: 'Underline', action: () => editor?.chain().focus().toggleUnderline().run(), shortcut: 'Ctrl+U' },
      { label: 'Strikethrough', action: () => editor?.chain().focus().toggleStrike().run() },
      { label: 'divider' },
      { label: 'Clear formatting', action: () => editor?.chain().focus().clearNodes().unsetAllMarks().run() },
      { label: 'divider' },
      { label: 'Line spacing: 1.0', action: () => (editor?.chain().focus() as any).setLineHeight('1').run() },
      { label: 'Line spacing: 1.15', action: () => (editor?.chain().focus() as any).setLineHeight('1.15').run() },
      { label: 'Line spacing: 1.5', action: () => (editor?.chain().focus() as any).setLineHeight('1.5').run() },
      { label: 'Line spacing: 2.0', action: () => (editor?.chain().focus() as any).setLineHeight('2').run() },
      { label: 'divider' },
      { label: 'Columns: 1', action: () => editor?.commands.setColumns(1) },
      { label: 'Columns: 2', action: () => editor?.commands.setColumns(2) },
      { label: 'Columns: 3', action: () => editor?.commands.setColumns(3) },
    ],
    Tools: [
      { label: 'Spelling & Grammar', action: () => {
        window.dispatchEvent(new CustomEvent('spellcheck-toggle'));
      }},
      { label: 'divider' },
      { label: 'Suggestion mode', action: () => {
        if (editor) {
          editor.chain().focus().toggleSuggestionMode().run();
          window.dispatchEvent(new CustomEvent('suggestion-mode-toggle'));
        }
      }},
      { label: 'Accept all suggestions', action: () => {
        window.dispatchEvent(new CustomEvent('suggestions-accept-all'));
      }},
      { label: 'Reject all suggestions', action: () => {
        window.dispatchEvent(new CustomEvent('suggestions-reject-all'));
      }},
      { label: 'Review suggestions', action: () => {
        window.dispatchEvent(new CustomEvent('suggestions-panel-toggle'));
      }},
      { label: 'divider' },
      { label: 'Word count', action: () => {
        window.dispatchEvent(new CustomEvent('word-count-open'));
      }},
      { label: 'Preferences', action: onShowSettings, icon: Settings },
    ],
    ...(accountItems.length > 0 && { Account: accountItems })
  };

  const handleMenuClick = (menuName: string) => {
    setActiveMenu(activeMenu === menuName ? null : menuName);
  };

  const handleMenuItemClick = (action?: () => void) => {
    if (action) action();
    setActiveMenu(null);
  };

  const getSaveStatusText = () => {
    switch (saveStatus) {
      case 'saving':
        return 'Saving...';
      case 'unsaved':
        return 'Unsaved changes';
      case 'error':
        return 'Save failed';
      default:
        return 'All changes saved';
    }
  };

  const handleTitleClick = () => {
    if (activeFile) {
      setIsEditingTitle(true);
    }
  };

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (documentTitle.trim() && activeFile && onTitleChange) {
      const newPath = activeFile.path.replace(/[^\/]*\.md$/, `${documentTitle.trim()}.md`);
      onTitleChange(newPath);
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSubmit();
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false);
      // Reset title to original
      if (activeFile) {
        const originalTitle = activeFile.path.replace(/\.md$/, '').replace(/.*\//, '');
        setDocumentTitle(originalTitle);
      }
    }
  };

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  const getSaveStatusIcon = () => {
    switch (saveStatus) {
      case 'saving':
        return '⏳';
      case 'unsaved':
        return '●';
      case 'error':
        return '⚠️';
      default:
        return '✅';
    }
  };

  return (
    <div className="menu-bar">
      <div className="menu-bar-left">
        <div className="app-title">
          <FileText size={20} />
          <span>MD Office</span>
          {isGuestMode && (
            <span className="mode-indicator" title="Guest mode - documents stored locally">
              Guest
            </span>
          )}
        </div>
        
        {/* Document title moved to left side */}
        {activeFile && (
          <div className="document-title-header-left">
            {isEditingTitle ? (
              <input
                ref={titleInputRef}
                type="text"
                value={documentTitle}
                onChange={(e) => setDocumentTitle(e.target.value)}
                onBlur={handleTitleSubmit}
                onKeyDown={handleTitleKeyDown}
                className="document-title-input-header-left"
              />
            ) : (
              <span
                className="document-title-header-text-left"
                onClick={handleTitleClick}
                title="Click to rename document"
              >
                {documentTitle || 'Untitled Document'}
              </span>
            )}
            <div className="save-status-indicator-small">
              <span className="save-icon">{getSaveStatusIcon()}</span>
            </div>
          </div>
        )}
        
        <div className="menu-items">
          {Object.entries(menus).map(([menuName, items]) => (
            <div key={menuName} className="menu-item">
              <button
                className={`menu-button ${activeMenu === menuName ? 'active' : ''}`}
                onClick={() => handleMenuClick(menuName)}
              >
                {menuName}
              </button>
              
              {activeMenu === menuName && (
                <div className="menu-dropdown">
                  {items.map((item, index) => {
                    if (item.label === 'divider') {
                      return <div key={index} className="menu-divider" />;
                    }
                    
                    const Icon = item.icon;
                    return (
                      <button
                        key={index}
                        className="menu-dropdown-item"
                        onClick={() => handleMenuItemClick(item.action)}
                      >
                        <div className="menu-item-content">
                          {Icon && <Icon size={14} />}
                          <span>{item.label}</span>
                        </div>
                        {item.shortcut && (
                          <span className="menu-shortcut">{item.shortcut}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="menu-bar-center">
        {!activeFile && (
          <div className="save-status-indicator">
            <span className="save-icon">{getSaveStatusIcon()}</span>
            <span className="save-text">{getSaveStatusText()}</span>
          </div>
        )}
      </div>

      <div className="menu-bar-right">
        <button className="quick-action-btn" onClick={onNewFile} title="New document">
          <Plus size={16} />
        </button>
        
        <button className="share-btn" onClick={() => {
          const url = new URL(window.location.href);
          url.searchParams.set('collab', '1');
          navigator.clipboard.writeText(url.toString()).then(() => {
            alert('Collaboration link copied!\n\n' + url.toString());
          }).catch(() => {
            prompt('Share this link:', url.toString());
          });
          if (!window.location.search.includes('collab')) {
            window.location.href = url.toString();
          }
        }}>
          <Share2 size={16} />
          <span>Share</span>
        </button>
      </div>

      {/* Click outside to close menu */}
      {activeMenu && (
        <div 
          className="menu-overlay" 
          onClick={() => setActiveMenu(null)}
        />
      )}
    </div>
  );
};

export default MenuBar;