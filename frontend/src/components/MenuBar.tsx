import React, { useState, useRef, useEffect } from 'react';
import { Share2, Settings, Moon, Sun, FileText, Plus, LogIn, LogOut, User } from 'lucide-react';
import { FileContent } from '../types';

interface MenuBarProps {
  onNewFile: () => void;
  onTemplateSelect: () => void;
  onExportPDF: () => void;
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
  onExportPDF,
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
      { label: 'Export as PDF', action: onExportPDF, shortcut: 'Ctrl+P' },
      { label: 'Print', action: onPrint, shortcut: 'Ctrl+P' },
      { label: 'divider' },
      { label: 'Share', action: () => console.log('Share'), icon: Share2 },
    ],
    Edit: [
      { label: 'Undo', action: () => console.log('Undo'), shortcut: 'Ctrl+Z' },
      { label: 'Redo', action: () => console.log('Redo'), shortcut: 'Ctrl+Y' },
      { label: 'divider' },
      { label: 'Undo', action: () => editor?.chain().focus().undo().run(), shortcut: 'Ctrl+Z' },
      { label: 'Redo', action: () => editor?.chain().focus().redo().run(), shortcut: 'Ctrl+Y' },
      { label: 'divider' },
      { label: 'Find and replace', action: () => console.log('Find'), shortcut: 'Ctrl+F' },
    ],
    View: [
      { label: 'Show preview', action: () => console.log('Preview') },
      { label: 'Full screen', action: () => console.log('Full screen'), shortcut: 'F11' },
      { label: 'divider' },
      { label: isDarkMode ? 'Light mode' : 'Dark mode', action: onToggleDarkMode, icon: isDarkMode ? Sun : Moon },
    ],
    Insert: [
      { label: 'Image', action: () => {
        const url = prompt('Image URL:');
        if (url && editor) editor.chain().focus().setImage({ src: url }).run();
      }},
      { label: 'Link', action: () => {
        const url = prompt('Link URL:');
        if (url && editor) editor.chain().focus().setLink({ href: url }).run();
      }, shortcut: 'Ctrl+K' },
      { label: 'Table', action: () => {
        if (editor) editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
      }},
      { label: 'divider' },
      { label: 'Horizontal rule', action: () => {
        if (editor) editor.chain().focus().setHorizontalRule().run();
      }},
      { label: 'Equation', action: () => console.log('Insert equation') },
    ],
    Format: [
      { label: 'Bold', action: () => editor?.chain().focus().toggleBold().run(), shortcut: 'Ctrl+B' },
      { label: 'Italic', action: () => editor?.chain().focus().toggleItalic().run(), shortcut: 'Ctrl+I' },
      { label: 'Underline', action: () => editor?.chain().focus().toggleUnderline().run(), shortcut: 'Ctrl+U' },
      { label: 'Strikethrough', action: () => editor?.chain().focus().toggleStrike().run() },
      { label: 'divider' },
      { label: 'Clear formatting', action: () => editor?.chain().focus().clearNodes().unsetAllMarks().run() },
    ],
    Tools: [
      { label: 'Word count', action: () => console.log('Word count') },
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
        
        <button className="share-btn">
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