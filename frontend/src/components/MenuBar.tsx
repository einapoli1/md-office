import React, { useState } from 'react';
import { Share2, Settings, Moon, Sun, FileText, Plus } from 'lucide-react';

interface MenuBarProps {
  onNewFile: () => void;
  onTemplateSelect: () => void;
  onExportPDF: () => void;
  onPrint: () => void;
  onShowSettings?: () => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  saveStatus: 'saved' | 'saving' | 'unsaved' | 'error';
}

const MenuBar: React.FC<MenuBarProps> = ({
  onNewFile,
  onTemplateSelect,
  onExportPDF,
  onPrint,
  onShowSettings,
  isDarkMode = false,
  onToggleDarkMode,
  saveStatus
}) => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  interface MenuItem {
    label: string;
    action?: () => void;
    shortcut?: string;
    icon?: any; // Using any to avoid LucideIcon type issues
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
      { label: 'Find and replace', action: () => console.log('Find'), shortcut: 'Ctrl+F' },
    ],
    View: [
      { label: 'Show preview', action: () => console.log('Preview') },
      { label: 'Full screen', action: () => console.log('Full screen'), shortcut: 'F11' },
      { label: 'divider' },
      { label: isDarkMode ? 'Light mode' : 'Dark mode', action: onToggleDarkMode, icon: isDarkMode ? Sun : Moon },
    ],
    Insert: [
      { label: 'Image', action: () => console.log('Insert image') },
      { label: 'Link', action: () => console.log('Insert link'), shortcut: 'Ctrl+K' },
      { label: 'Table', action: () => console.log('Insert table') },
      { label: 'divider' },
      { label: 'Equation', action: () => console.log('Insert equation') },
    ],
    Format: [
      { label: 'Bold', action: () => console.log('Bold'), shortcut: 'Ctrl+B' },
      { label: 'Italic', action: () => console.log('Italic'), shortcut: 'Ctrl+I' },
      { label: 'Underline', action: () => console.log('Underline'), shortcut: 'Ctrl+U' },
      { label: 'divider' },
      { label: 'Clear formatting', action: () => console.log('Clear formatting') },
    ],
    Tools: [
      { label: 'Word count', action: () => console.log('Word count') },
      { label: 'Preferences', action: onShowSettings, icon: Settings },
    ],
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
        </div>
        
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
        <div className="save-status-indicator">
          <span className="save-icon">{getSaveStatusIcon()}</span>
          <span className="save-text">{getSaveStatusText()}</span>
        </div>
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