import React, { useState, useRef, useEffect } from 'react';
import { Share2, Settings, Moon, Sun, FileText, Plus, LogIn, LogOut, User, Table2, Presentation, Pencil, Menu, X } from 'lucide-react';
import { FileContent } from '../types';
import type { AppMode } from '../App';
import { useI18n } from '../lib/i18n';

interface MenuBarProps {
  onNewFile: () => void;
  onNewSpreadsheet: () => void;
  onNewPresentation: () => void;
  onNewDrawing?: () => void;
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
  onShareClick?: () => void;
  onVersionHistory?: () => void;
  onBranches?: () => void;
  onCommitHistory?: () => void;
  appMode?: AppMode;
  onShowAbout?: () => void;
  onStartTour?: () => void;
  onShowShortcuts?: () => void;
  onShowAccessibility?: () => void;
  onShowPreferences?: () => void;
}

const MenuBar: React.FC<MenuBarProps> = ({
  onNewFile,
  onNewSpreadsheet,
  onNewPresentation,
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
  onShareClick,
  onVersionHistory,
  onBranches,
  onCommitHistory,
  appMode = 'docs',
  onShowAbout,
  onStartTour,
  onShowShortcuts,
  onShowAccessibility,
  onShowPreferences,
}) => {
  const { t } = useI18n();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
    [t('menu.file._label')]: [
      { label: 'New document', action: onNewFile, shortcut: 'Ctrl+N', icon: FileText },
      { label: 'New spreadsheet', action: onNewSpreadsheet, icon: Table2 },
      { label: 'New presentation', action: onNewPresentation, icon: Presentation },
      { label: 'From template', action: onTemplateSelect },
      { label: 'Templates library', action: () => {
        window.dispatchEvent(new CustomEvent('template-sidebar-toggle'));
      }},
      { label: 'Import Word document (.docx)', action: () => {
        window.dispatchEvent(new CustomEvent('import-docx'));
      }},
      { label: 'divider' },
      { label: 'Download', action: () => {
        window.dispatchEvent(new CustomEvent('export-open'));
      }},
      { label: 'Print', action: onPrint, shortcut: '⌘P' },
      { label: 'Envelopes & Labels', action: () => {
        window.dispatchEvent(new CustomEvent('envelopes-labels-open'));
      }},
      { label: 'Page setup', action: () => {
        window.dispatchEvent(new CustomEvent('page-setup-open'));
      }},
      { label: 'divider' },
      { label: 'Version history', action: onVersionHistory, shortcut: '⌘⇧H' },
      { label: 'Branches...', action: onBranches },
      { label: 'Commit history', action: onCommitHistory },
      { label: 'Export Form Data', action: () => {
        window.dispatchEvent(new CustomEvent('export-form-data'));
      }},
      { label: 'Publish...', action: () => {
        window.dispatchEvent(new CustomEvent('publish-open'));
      }},
      { label: 'Cover Page', action: () => {
        window.dispatchEvent(new CustomEvent('cover-page-open'));
      }},
      { label: 'Preferences', action: onShowPreferences, shortcut: '⌘,' },
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
    [t('menu.edit._label')]: [
      { label: 'Undo', action: () => editor?.chain().focus().undo().run(), shortcut: '⌘Z' },
      { label: 'Redo', action: () => editor?.chain().focus().redo().run(), shortcut: '⌘Y' },
      { label: 'divider' },
      { label: 'Find and replace', action: () => {
        window.dispatchEvent(new CustomEvent('find-replace-open', { detail: { replace: false } }));
      }, shortcut: '⌘F' },
    ],
    [t('menu.view._label')]: [
      { label: 'Show ruler', action: () => {
        window.dispatchEvent(new CustomEvent('ruler-toggle'));
      }},
      { label: 'Document outline', action: () => {
        window.dispatchEvent(new CustomEvent('outline-toggle'));
      }},
      { label: 'Pageless', action: () => {
        window.dispatchEvent(new CustomEvent('pageless-toggle'));
      }},
      { label: 'Full screen', action: () => {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen();
      }, shortcut: 'F11' },
      { label: 'divider' },
      { label: isDarkMode ? 'Light mode' : 'Dark mode', action: onToggleDarkMode, icon: isDarkMode ? Sun : Moon },
      { label: 'divider' },
      { label: 'Form Fill Mode', action: () => {
        window.dispatchEvent(new CustomEvent('form-fill-toggle'));
      }},
      { label: 'divider' },
      { label: 'Focus Mode', action: () => {
        window.dispatchEvent(new CustomEvent('focus-mode-toggle'));
      }, shortcut: '⌘⇧F' },
      { label: 'Reading Mode', action: () => {
        window.dispatchEvent(new CustomEvent('reading-mode-toggle'));
      }, shortcut: '⌘⇧R' },
      { label: 'divider' },
      { label: 'Document Map', action: () => {
        window.dispatchEvent(new CustomEvent('document-map-toggle'));
      }},
      { label: 'divider' },
      { label: 'Chat', action: () => {
        window.dispatchEvent(new CustomEvent('collab-chat-toggle'));
      }},
      { label: 'Edit Activity', action: () => {
        window.dispatchEvent(new CustomEvent('edit-history-toggle'));
      }},
    ],
    [t('menu.insert._label')]: [
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
      { label: 'Equation', action: () => {
        window.dispatchEvent(new CustomEvent('equation-dialog-open'));
      }},
      { label: 'Diagram (Mermaid)', action: () => {
        if (editor) (editor.commands as any).insertMermaidBlock();
      }},
      { label: 'divider' },
      { label: 'Special characters', action: () => {
        window.dispatchEvent(new CustomEvent('special-chars-open'));
      }},
      { label: 'Emoji', action: () => {
        window.dispatchEvent(new CustomEvent('emoji-picker-open'));
      }},
      { label: 'divider' },
      { label: 'Page numbers', action: () => {
        window.dispatchEvent(new CustomEvent('page-number-dialog-open'));
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
      { label: 'People (@mention)', action: () => {
        // Insert @ character to trigger mention suggestion
        if (editor) {
          editor.chain().focus().insertContent('@').run();
        }
      }},
      { label: 'Date chip', action: () => {
        if (editor) {
          (editor.commands as any).insertDateChip();
        }
      }},
      { label: 'divider' },
      { label: 'Form Field: Text Input', action: () => {
        if (editor) (editor.commands as any).insertFormField('text-input');
      }},
      { label: 'Form Field: Dropdown', action: () => {
        if (editor) (editor.commands as any).insertFormField('dropdown');
      }},
      { label: 'Form Field: Checkbox', action: () => {
        if (editor) (editor.commands as any).insertFormField('checkbox');
      }},
      { label: 'Form Field: Date', action: () => {
        if (editor) (editor.commands as any).insertFormField('date-picker');
      }},
      { label: 'Form Field: Signature', action: () => {
        if (editor) (editor.commands as any).insertFormField('signature');
      }},
      { label: 'Drawing', action: () => {
        window.dispatchEvent(new CustomEvent('whiteboard-open'));
      }},
      { label: 'Variable', action: () => {
        const input = prompt('Define variable (e.g. x = 5):');
        if (input && editor) {
          const match = input.match(/^\s*([a-zA-Z_]\w*)\s*=\s*(-?\d+(?:\.\d+)?)\s*$/);
          if (match) {
            (editor.commands as any).insertVariableChip(match[1], parseFloat(match[2]));
          } else {
            alert('Format: name = value (e.g. x = 5)');
          }
        }
      }},
      { label: 'divider' },
      { label: 'Citation', action: () => {
        window.dispatchEvent(new CustomEvent('citation-picker-open'));
      }, shortcut: '⌘⇧C' },
      { label: 'Bibliography', action: () => {
        if (editor) {
          editor.commands.insertBibliography();
        }
      }},
      { label: 'divider' },
      { label: 'Snippets', action: () => {
        window.dispatchEvent(new CustomEvent('snippet-manager-toggle'));
      }},
      { label: 'divider' },
      { label: 'Bookmark', action: () => {
        const name = prompt('Bookmark name:');
        if (name && editor) {
          editor.commands.insertBookmark(name);
        }
      }},
      { label: 'divider' },
      { label: 'Watermark', action: () => {
        window.dispatchEvent(new CustomEvent('watermark-open'));
      }},
      { label: 'divider' },
      { label: 'Callout: Info', action: () => { if (editor) (editor.commands as any).insertCallout('info'); }},
      { label: 'Callout: Warning', action: () => { if (editor) (editor.commands as any).insertCallout('warning'); }},
      { label: 'Callout: Tip', action: () => { if (editor) (editor.commands as any).insertCallout('tip'); }},
      { label: 'Callout: Error', action: () => { if (editor) (editor.commands as any).insertCallout('error'); }},
      { label: 'Callout: Success', action: () => { if (editor) (editor.commands as any).insertCallout('success'); }},
      { label: 'Callout: Note', action: () => { if (editor) (editor.commands as any).insertCallout('note'); }},
      { label: 'divider' },
      { label: 'Caption (Figure)', action: () => { if (editor) (editor.commands as any).insertCaption('figure'); }},
      { label: 'Caption (Table)', action: () => { if (editor) (editor.commands as any).insertCaption('table'); }},
      { label: 'Table of Figures', action: () => { window.dispatchEvent(new CustomEvent('table-of-figures-open')); }},
      { label: 'Index', action: () => { window.dispatchEvent(new CustomEvent('table-of-figures-open', { detail: { type: 'index' } })); }},
      { label: 'Cover Page', action: () => { window.dispatchEvent(new CustomEvent('cover-page-open')); }},
      { label: 'divider' },
      { label: 'Chart from Sheets', action: () => {
        window.dispatchEvent(new CustomEvent('embed-picker-open', { detail: { type: 'chart' } }));
      }},
      { label: 'Table from Sheets', action: () => {
        window.dispatchEvent(new CustomEvent('embed-picker-open', { detail: { type: 'range' } }));
      }},
    ],
    [t('menu.format._label')]: [
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
      { label: 'Text direction: LTR', action: () => {
        window.dispatchEvent(new CustomEvent('set-text-direction', { detail: { dir: 'ltr' } }));
      }},
      { label: 'Text direction: RTL', action: () => {
        window.dispatchEvent(new CustomEvent('set-text-direction', { detail: { dir: 'rtl' } }));
      }},
      { label: 'divider' },
      { label: 'Columns: 1', action: () => editor?.commands.setColumns(1) },
      { label: 'Columns: 2', action: () => editor?.commands.setColumns(2) },
      { label: 'Columns: 3', action: () => editor?.commands.setColumns(3) },
      { label: 'Columns (Advanced)...', action: () => {
        window.dispatchEvent(new CustomEvent('page-columns-open'));
      }},
    ],
    [t('menu.tools._label')]: [
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
      { label: 'Document Statistics', action: () => {
        window.dispatchEvent(new CustomEvent('doc-stats-open'));
      }},
      { label: 'divider' },
      { label: 'Compare documents', action: () => {
        window.dispatchEvent(new CustomEvent('compare-open'));
      }},
      { label: 'divider' },
      { label: 'Mail Merge', action: () => {
        window.dispatchEvent(new CustomEvent('mail-merge-toggle'));
      }},
      { label: 'divider' },
      { label: 'Citation Manager', action: () => {
        window.dispatchEvent(new CustomEvent('citation-manager-toggle'));
      }},
      { label: 'AI Assistant', action: () => {
        window.dispatchEvent(new CustomEvent('ai-assistant-toggle'));
      }},
      { label: 'Writing Assistant', action: () => {
        window.dispatchEvent(new CustomEvent('writing-assistant-toggle'));
      }},
      { label: 'Snippet Manager', action: () => {
        window.dispatchEvent(new CustomEvent('snippet-manager-toggle'));
      }},
      { label: 'Extensions', action: () => {
        window.dispatchEvent(new CustomEvent('plugin-manager-toggle'));
      }},
      { label: 'divider' },
      { label: 'divider' },
      { label: 'Macro Editor', action: () => {
        window.dispatchEvent(new CustomEvent('macro-editor-toggle'));
      }},
      { label: 'Record Macro', action: () => {
        window.dispatchEvent(new CustomEvent('macro-start-recording'));
      }},
      { label: 'Run Macro...', action: () => {
        window.dispatchEvent(new CustomEvent('macro-run-picker'));
      }},
      { label: 'divider' },
      { label: 'Protect Document', action: () => {
        window.dispatchEvent(new CustomEvent('document-protection-open'));
      }},
      { label: 'divider' },
      { label: t('menu.tools.accessibility'), action: onShowAccessibility },
      { label: 'divider' },
      { label: t('menu.tools.preferences'), action: onShowSettings, icon: Settings },
    ],
    ...(appMode === 'sheets' && {
      [t('menu.data._label')]: [
        { label: 'Sort A → Z', action: () => window.dispatchEvent(new CustomEvent('sheet-sort', { detail: { ascending: true } })) },
        { label: 'Sort Z → A', action: () => window.dispatchEvent(new CustomEvent('sheet-sort', { detail: { ascending: false } })) },
        { label: 'divider' },
        { label: 'Create filter', action: () => window.dispatchEvent(new CustomEvent('sheet-toggle-filters')) },
        { label: 'divider' },
        { label: 'Pivot table', action: () => window.dispatchEvent(new CustomEvent('sheet-pivot-table')) },
        { label: 'Data validation', action: () => window.dispatchEvent(new CustomEvent('sheet-data-validation')) },
        { label: 'Protected ranges', action: () => window.dispatchEvent(new CustomEvent('sheet-protected-ranges')) },
      ],
    }),
    ...(appMode === 'slides' && {
      [t('menu.slide._label')]: [
        { label: 'New slide', action: () => window.dispatchEvent(new CustomEvent('slide-add')) },
        { label: 'Duplicate slide', action: () => window.dispatchEvent(new CustomEvent('slide-duplicate')) },
        { label: 'Delete slide', action: () => window.dispatchEvent(new CustomEvent('slide-delete')) },
        { label: 'Skip slide', action: () => window.dispatchEvent(new CustomEvent('slide-skip')) },
        { label: 'divider' },
        { label: 'Change layout', action: () => window.dispatchEvent(new CustomEvent('slide-change-layout')) },
        { label: 'Change transition', action: () => window.dispatchEvent(new CustomEvent('slide-change-transition')) },
        { label: 'divider' },
        { label: 'Present', action: () => window.dispatchEvent(new CustomEvent('slide-present')), shortcut: '⌘⇧P' },
        { label: 'divider' },
        { label: 'Video', action: () => window.dispatchEvent(new CustomEvent('slide-insert-video')) },
        { label: 'Audio Narration', action: () => window.dispatchEvent(new CustomEvent('slide-insert-audio')) },
        { label: 'Interactive Element', action: () => window.dispatchEvent(new CustomEvent('slide-insert-interactive')) },
        { label: 'divider' },
        { label: 'Chart from Sheets', action: () => {
          window.dispatchEvent(new CustomEvent('embed-picker-open', { detail: { type: 'chart' } }));
        }},
        { label: 'Table from Sheets', action: () => {
          window.dispatchEvent(new CustomEvent('embed-picker-open', { detail: { type: 'range' } }));
        }},
        { label: 'Photo Album', action: () => window.dispatchEvent(new CustomEvent('slide-photo-album')) },
        { label: 'divider' },
        { label: 'Slide Size', action: () => window.dispatchEvent(new CustomEvent('slide-size')) },
        { label: 'Slide Sorter', action: () => window.dispatchEvent(new CustomEvent('slide-sorter')) },
        { label: 'Design Ideas', action: () => window.dispatchEvent(new CustomEvent('slide-design-ideas')) },
        { label: 'divider' },
        { label: 'Presenter Coach', action: () => window.dispatchEvent(new CustomEvent('slide-presenter-coach')) },
      ],
    }),
    [t('menu.help._label')]: [
      { label: 'Getting started', action: onStartTour },
      { label: 'Keyboard shortcuts', action: onShowShortcuts, shortcut: '⌘/' },
      { label: 'divider' },
      { label: 'About MD Office', action: onShowAbout },
      { label: 'divider' },
      { label: 'Report a bug', action: () => window.open('https://github.com/md-office/md-office/issues', '_blank') },
    ],
    ...(accountItems.length > 0 && { [t('menu.account._label')]: accountItems })
  };

  const APP_BRANDING: Record<AppMode, { icon: React.FC<any>; name: string; color: string }> = {
    docs: { icon: FileText, name: 'MD Docs', color: '#4285f4' },
    sheets: { icon: Table2, name: 'MD Sheets', color: '#0f9d58' },
    slides: { icon: Presentation, name: 'MD Slides', color: '#f4b400' },
    draw: { icon: Pencil, name: 'MD Draw', color: '#db4437' },
  };
  const branding = APP_BRANDING[appMode];

  const handleMenuClick = (menuName: string) => {
    setActiveMenu(activeMenu === menuName ? null : menuName);
  };

  const handleMenuItemClick = (action?: () => void) => {
    if (action) action();
    setActiveMenu(null);
    setMobileMenuOpen(false);
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
        <div className="app-title" style={{ color: branding.color }}>
          <branding.icon size={20} />
          <span>{branding.name}</span>
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
        
        <button
          className="hamburger-btn"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        {mobileMenuOpen && (
          <div className="mobile-menu-backdrop" onClick={() => { setMobileMenuOpen(false); setActiveMenu(null); }} />
        )}

        <div className={`menu-items${mobileMenuOpen ? ' mobile-menu-open' : ''}`}>
          {Object.entries(menus).map(([menuName, items]) => (
            <div key={menuName} className="menu-item">
              <button
                className={`menu-button ${activeMenu === menuName ? 'active' : ''}`}
                onClick={() => handleMenuClick(menuName)}
                aria-haspopup="true"
                aria-expanded={activeMenu === menuName}
              >
                {menuName}
              </button>
              
              {activeMenu === menuName && (
                <div className="menu-dropdown" role="menu">
                  {items.map((item, index) => {
                    if (item.label === 'divider') {
                      return <div key={index} className="menu-divider" />;
                    }
                    
                    const Icon = item.icon;
                    return (
                      <button
                        key={index}
                        className="menu-dropdown-item"
                        role="menuitem"
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
        
        <button className="share-btn" onClick={() => onShareClick?.()}>
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