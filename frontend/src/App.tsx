import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import DocumentSidebar from './components/DocumentSidebar';
import DocumentEditor from './components/DocumentEditor';
import MenuBar from './components/MenuBar';
import StatusBar from './components/StatusBar';
import Login from './components/Login';
import DocsToolbar from './components/DocsToolbar';
import Ruler from './components/Ruler';
import { FileSystemItem, FileContent } from './types';
import { fileAPI, gitAPI } from './utils/api';
import { parseFrontmatter, getPageStyles } from './utils/frontmatter';
import { localFileAPI, initializeLocalStorage } from './utils/localApi';
import { Template } from './utils/templates';
import VersionHistory from './components/VersionHistory';
import CommentsSidebar, { Comment } from './components/CommentsSidebar';
import SuggestionPopup from './components/SuggestionPopup';
import SuggestionsSidebar from './components/SuggestionsSidebar';
import FindReplace from './components/FindReplace';
import InputDialog from './components/InputDialog';
import LinkDialog from './components/LinkDialog';
import ToastProvider from './components/ToastProvider';
import ShareDialog from './components/ShareDialog';
import { toast } from './components/Toast';

// Lazy load dialogs — only rendered when opened
const TemplateSelector = lazy(() => import('./components/TemplateSelector'));
const WordCountDialog = lazy(() => import('./components/WordCountDialog'));
const ExportDialog = lazy(() => import('./components/ExportDialog'));
const KeyboardShortcutsDialog = lazy(() => import('./components/KeyboardShortcutsDialog'));
const SpecialChars = lazy(() => import('./components/SpecialChars'));
import TableOfContents from './components/TableOfContents';
import { HeaderFooterEditor, HeaderFooterContent, defaultContent as defaultHFContent } from './components/HeaderFooter';
import './comments-styles.css';

function App() {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  
  // App state
  const [files, setFiles] = useState<FileSystemItem[]>([]);
  const [activeFile, setActiveFile] = useState<FileContent | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | 'error'>('saved');
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [recentFiles, setRecentFiles] = useState<string[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Check localStorage first, then system preference
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) return JSON.parse(saved);
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [lastSaved, setLastSaved] = useState<Date | undefined>();
  const [editorRef, setEditorRef] = useState<any>(null);

  // Comments state
  const [comments, setComments] = useState<Comment[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [suggestionMode, setSuggestionMode] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findReplaceMode, setFindReplaceMode] = useState(false); // true = show replace
  const [showWordCount, setShowWordCount] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showOutline, setShowOutline] = useState(false);
  const [showSpecialChars, setShowSpecialChars] = useState(false);
  const [hfEditType, setHfEditType] = useState<'header' | 'footer' | null>(null);
  const [hfContent, setHfContent] = useState<HeaderFooterContent>(defaultHFContent);
  const [showRuler, setShowRuler] = useState(true);
  const [pageless, setPageless] = useState(() => {
    return localStorage.getItem('md-office-pageless') === 'true';
  });
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [rulerMargins, setRulerMargins] = useState<{ left: number; right: number } | null>(null);
  const [inputDialog, setInputDialog] = useState<{
    title: string;
    fields: { key: string; label: string; placeholder?: string; defaultValue?: string }[];
    onSubmit: (values: Record<string, string>) => void;
  } | null>(null);
  const [collabStatus, setCollabStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [collabUsers, setCollabUsers] = useState(0);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [vhCommits, setVhCommits] = useState<import('./types').GitCommit[]>([]);
  const [vhSelectedCommit, setVhSelectedCommit] = useState<import('./types').GitCommit | null>(null);
  const [vhPreviewContent, setVhPreviewContent] = useState<string | null>(null);
  const [vhLoading, setVhLoading] = useState(false);

  // Auto-save functionality
  const saveTimeoutRef = useRef<number>();
  const originalContentRef = useRef<string>('');

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('token');
      const user = localStorage.getItem('user');
      
      if (token && user) {
        setIsAuthenticated(true);
        setIsGuestMode(false);
      } else {
        // Start in guest mode
        setIsAuthenticated(false);
        setIsGuestMode(true);
        initializeLocalStorage();
      }
      setAuthLoading(false);
    };
    
    checkAuth();
  }, []);

  // Load file tree on mount
  useEffect(() => {
    if (!authLoading) {
      loadFiles();
      loadRecentFiles();
    }
  }, [authLoading, isAuthenticated, isGuestMode]);

  // Apply dark mode class to body
  useEffect(() => {
    document.body.className = isDarkMode ? 'dark' : '';
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  // Load git history when active file changes
  useEffect(() => {
    if (activeFile) {
      originalContentRef.current = activeFile.content;
    }
  }, [activeFile]);

  // Auto-save functionality with debouncing
  const debouncedSave = useCallback(async (newContent: string) => {
    if (!activeFile) return;
    
    // Clear any existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set status to unsaved if content has changed
    if (newContent !== originalContentRef.current) {
      setSaveStatus('unsaved');
    }

    // Set up debounced save (1 second after last keystroke)
    saveTimeoutRef.current = window.setTimeout(async () => {
      if (newContent === originalContentRef.current) {
        setSaveStatus('saved');
        return;
      }

      try {
        setSaveStatus('saving');
        const currentAPI = isGuestMode ? localFileAPI : fileAPI;
        await currentAPI.saveFile(activeFile.path, newContent);
        originalContentRef.current = newContent;
        setSaveStatus('saved');
        setLastSaved(new Date());
        toast('Document saved', 'success');
        
        // Update recent files
        updateRecentFiles(activeFile.path);
      } catch (error) {
        console.error('Auto-save failed:', error);
        setSaveStatus('error');
        toast('Failed to save document', 'error');
        
        // Retry after 5 seconds
        setTimeout(() => {
          debouncedSave(newContent);
        }, 5000);
      }
    }, 1000);
  }, [activeFile]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const loadFiles = async () => {
    try {
      const currentAPI = isGuestMode ? localFileAPI : fileAPI;
      const fileData = await currentAPI.getFiles();
      setFiles(fileData);
    } catch (error) {
      console.error('Failed to load files:', error);
      // If authenticated API fails, fallback to guest mode
      if (isAuthenticated && !isGuestMode) {
        console.log('Falling back to guest mode...');
        setIsAuthenticated(false);
        setIsGuestMode(true);
        initializeLocalStorage();
      }
    }
  };

  const loadRecentFiles = () => {
    const recent = localStorage.getItem('recentFiles');
    if (recent) {
      setRecentFiles(JSON.parse(recent));
    }
  };

  const updateRecentFiles = (filePath: string) => {
    setRecentFiles(prev => {
      const filtered = prev.filter(f => f !== filePath);
      const updated = [filePath, ...filtered].slice(0, 10); // Keep last 10
      localStorage.setItem('recentFiles', JSON.stringify(updated));
      return updated;
    });
  };

  const handleFileSelect = async (file: FileSystemItem) => {
    if (file.isDirectory) return;
    
    try {
      setLoading(true);
      const currentAPI = isGuestMode ? localFileAPI : fileAPI;
      const fileContent = await currentAPI.getFile(file.path);
      setActiveFile(fileContent);
      setContent(fileContent.content);
      setRulerMargins(null);
      setSaveStatus('saved');
      setLastSaved(undefined);
      originalContentRef.current = fileContent.content;
      updateRecentFiles(file.path);
    } catch (error) {
      console.error('Failed to load file:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    debouncedSave(newContent);
  };

  const handleTitleChange = async (newPath: string) => {
    if (!activeFile) return;

    try {
      // This would need to be implemented in the backend API
      // For now, we'll just update the local state
      setActiveFile({ ...activeFile, path: newPath });
      await loadFiles();
    } catch (error) {
      console.error('Failed to rename file:', error);
    }
  };

  const handleCreateFile = async (name: string, isDirectory: boolean) => {
    try {
      const currentAPI = isGuestMode ? localFileAPI : fileAPI;
      if (isDirectory) {
        await currentAPI.createDirectory(name);
      } else {
        await currentAPI.createFile(name);
        // Auto-open new files
        const newFile: FileContent = { 
          path: name, 
          content: '',
          lastModified: new Date().toISOString()
        };
        setActiveFile(newFile);
        setContent('');
        setSaveStatus('saved');
        originalContentRef.current = '';
      }
      await loadFiles();
    } catch (error) {
      console.error('Failed to create item:', error);
    }
  };

  const handleCreateFromTemplate = async (name: string, template: Template) => {
    try {
      const currentAPI = isGuestMode ? localFileAPI : fileAPI;
      await currentAPI.createFile(name, template.content);
      if (template.content && !isGuestMode) {
        await currentAPI.saveFile(name, template.content);
      }
      await loadFiles();
      
      // Auto-open the new file
      const newFile: FileContent = { 
        path: name, 
        content: template.content || '',
        lastModified: new Date().toISOString()
      };
      setActiveFile(newFile);
      setContent(template.content || '');
      setSaveStatus('saved');
      originalContentRef.current = template.content || '';
      updateRecentFiles(name);
    } catch (error) {
      console.error('Failed to create file from template:', error);
    }
  };

  const handleDelete = async (path: string) => {
    try {
      const currentAPI = isGuestMode ? localFileAPI : fileAPI;
      await currentAPI.deleteItem(path);
      if (activeFile?.path === path) {
        setActiveFile(null);
        setContent('');
        setSaveStatus('saved');
      }
      await loadFiles();
      
      // Remove from recent files
      setRecentFiles(prev => {
        const updated = prev.filter(f => f !== path);
        localStorage.setItem('recentFiles', JSON.stringify(updated));
        return updated;
      });
    } catch (error) {
      console.error('Failed to delete item:', error);
    }
  };

  // Version history
  const openVersionHistory = async () => {
    setShowVersionHistory(true);
    setVhSelectedCommit(null);
    setVhPreviewContent(null);
    if (!isGuestMode) {
      try {
        const history = await gitAPI.getHistory(activeFile?.path);
        setVhCommits(history.commits || []);
      } catch (e) {
        console.error('Failed to load version history:', e);
        setVhCommits([]);
      }
    }
  };

  const handleVhPreview = async (commit: import('./types').GitCommit) => {
    setVhSelectedCommit(commit);
    setVhLoading(true);
    try {
      // Fetch file content at this commit via the backend
      const resp = await fetch(`/api/git/file-at?hash=${commit.hash}&path=${encodeURIComponent(activeFile?.path || '')}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const json = await resp.json();
      if (json.data) {
        setVhPreviewContent(json.data);
      } else {
        setVhPreviewContent(null);
      }
    } catch {
      setVhPreviewContent(null);
    } finally {
      setVhLoading(false);
    }
  };

  const handleVhRevert = async (commit: import('./types').GitCommit) => {
    if (!isGuestMode) {
      try {
        await gitAPI.revertToCommit(commit.hash);
        // Reload the file
        if (activeFile) {
          const currentAPI = fileAPI;
          const fileContent = await currentAPI.getFile(activeFile.path);
          setActiveFile(fileContent);
          setContent(fileContent.content);
          originalContentRef.current = fileContent.content;
          setSaveStatus('saved');
        }
        setShowVersionHistory(false);
        toast('Version restored', 'success');
      } catch (e) {
        console.error('Failed to revert:', e);
        toast('Failed to restore version', 'error');
      }
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleNewFile = () => {
    // Generate a unique filename automatically
    const now = new Date();
    const timestamp = now.toISOString().split('T')[0]; // YYYY-MM-DD format
    const baseFileName = `Untitled Document ${timestamp}`;
    
    // Find a unique name
    let counter = 1;
    let fileName = `${baseFileName}.md`;
    
    while (files.some(f => f.path === fileName)) {
      fileName = `${baseFileName} ${counter}.md`;
      counter++;
    }
    
    handleCreateFile(fileName, false);
  };

  const handleNewFromTemplate = () => {
    setShowTemplateSelector(true);
  };

  const handleTemplateSelect = (template: Template) => {
    const fileName = window.prompt('Enter file name (include .md extension):');
    if (fileName) {
      handleCreateFromTemplate(fileName, template);
    }
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  // Authentication handlers
  const handleAuthSuccess = (_token: string) => {
    setIsAuthenticated(true);
    setIsGuestMode(false);
    setShowLogin(false);
    // Reload files from server
    loadFiles();
  };

  const handleSwitchToGuest = () => {
    setIsAuthenticated(false);
    setIsGuestMode(true);
    setShowLogin(false);
    initializeLocalStorage();
    loadFiles();
  };

  const handleShowLogin = () => {
    setShowLogin(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setIsGuestMode(true);
    setActiveFile(null);
    setContent('');
    initializeLocalStorage();
    loadFiles();
  };

  // Collab status listener
  useEffect(() => {
    const onStatus = (e: Event) => setCollabStatus((e as CustomEvent).detail.status);
    const onUsers = (e: Event) => {
      const newCount = (e as CustomEvent).detail.count;
      setCollabUsers(prev => {
        if (newCount > prev && prev > 0) toast('A user joined the document', 'info');
        else if (newCount < prev && prev > 1) toast('A user left the document', 'info');
        return newCount;
      });
    };
    window.addEventListener('collab-status', onStatus);
    window.addEventListener('collab-users', onUsers);
    return () => {
      window.removeEventListener('collab-status', onStatus);
      window.removeEventListener('collab-users', onUsers);
    };
  }, []);

  // Suggestion mode toggle + bulk actions
  useEffect(() => {
    const handleToggle = () => setSuggestionMode(prev => !prev);
    
    const handleAcceptAll = () => {
      if (!editorRef) return;
      const { doc, tr } = editorRef.state;
      const markType = editorRef.schema.marks.suggestion;
      // Collect in reverse order to avoid position shifts
      const ops: { pos: number; size: number; type: string }[] = [];
      doc.descendants((node: any, pos: number) => {
        node.marks?.forEach((mark: any) => {
          if (mark.type === markType) {
            ops.push({ pos, size: node.nodeSize, type: mark.attrs.suggestionType });
          }
        });
      });
      // Process in reverse
      ops.reverse().forEach(op => {
        if (op.type === 'insert') {
          tr.removeMark(op.pos, op.pos + op.size, markType);
        } else {
          tr.delete(op.pos, op.pos + op.size);
        }
      });
      editorRef.view.dispatch(tr);
    };

    const handleRejectAll = () => {
      if (!editorRef) return;
      const { doc, tr } = editorRef.state;
      const markType = editorRef.schema.marks.suggestion;
      const ops: { pos: number; size: number; type: string }[] = [];
      doc.descendants((node: any, pos: number) => {
        node.marks?.forEach((mark: any) => {
          if (mark.type === markType) {
            ops.push({ pos, size: node.nodeSize, type: mark.attrs.suggestionType });
          }
        });
      });
      ops.reverse().forEach(op => {
        if (op.type === 'insert') {
          tr.delete(op.pos, op.pos + op.size);
        } else {
          tr.removeMark(op.pos, op.pos + op.size, markType);
        }
      });
      editorRef.view.dispatch(tr);
    };

    const handlePanelToggle = () => setShowSuggestions(prev => !prev);

    window.addEventListener('suggestion-mode-toggle', handleToggle);
    window.addEventListener('suggestions-accept-all', handleAcceptAll);
    window.addEventListener('suggestions-reject-all', handleRejectAll);
    window.addEventListener('suggestions-panel-toggle', handlePanelToggle);
    return () => {
      window.removeEventListener('suggestion-mode-toggle', handleToggle);
      window.removeEventListener('suggestions-accept-all', handleAcceptAll);
      window.removeEventListener('suggestions-reject-all', handleRejectAll);
      window.removeEventListener('suggestions-panel-toggle', handlePanelToggle);
    };
  }, [editorRef]);

  // Comment handlers
  useEffect(() => {
    const handleCommentAdd = (e: Event) => {
      const { commentId, quotedText } = (e as CustomEvent).detail;
      const newComment: Comment = {
        id: commentId,
        text: '',
        author: isGuestMode ? 'Guest' : 'You',
        createdAt: new Date().toISOString(),
        resolved: false,
        replies: [],
        quotedText,
      };
      // Open sidebar with empty comment — user types inline
      newComment.text = '';
      setComments(prev => [...prev, newComment]);
      setActiveCommentId(commentId);
      setShowComments(true);
      // Mark as pending input so sidebar focuses the input
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('comment-focus-input', { detail: { commentId } }));
      }, 100);
    };

    const handleCommentClick = (e: Event) => {
      const { commentId } = (e as CustomEvent).detail;
      setActiveCommentId(commentId);
      setShowComments(true);
    };

    window.addEventListener('comment-add', handleCommentAdd);
    window.addEventListener('comment-click', handleCommentClick);
    return () => {
      window.removeEventListener('comment-add', handleCommentAdd);
      window.removeEventListener('comment-click', handleCommentClick);
    };
  }, [editorRef, isGuestMode]);

  const handleAddReply = (commentId: string, text: string) => {
    setComments(prev => prev.map(c => {
      if (c.id !== commentId) return c;
      return {
        ...c,
        replies: [...c.replies, {
          id: `r-${Date.now()}`,
          text,
          author: isGuestMode ? 'Guest' : 'You',
          createdAt: new Date().toISOString(),
        }],
      };
    }));
  };

  const handleResolveComment = (commentId: string) => {
    setComments(prev => prev.map(c =>
      c.id === commentId ? { ...c, resolved: true } : c
    ));
  };

  const handleUpdateComment = (commentId: string, text: string) => {
    setComments(prev => prev.map(c => c.id === commentId ? { ...c, text } : c));
  };

  const handleDeleteComment = (commentId: string) => {
    setComments(prev => prev.filter(c => c.id !== commentId));
    // Remove the highlight mark from the editor
    if (editorRef) {
      // Find and remove the comment mark with this ID
      const { doc } = editorRef.state;
      const tr = editorRef.state.tr;
      doc.descendants((node: any, pos: number) => {
        node.marks?.forEach((mark: any) => {
          if (mark.type.name === 'comment' && mark.attrs.commentId === commentId) {
            tr.removeMark(pos, pos + node.nodeSize, mark.type);
          }
        });
      });
      editorRef.view.dispatch(tr);
    }
  };

  // Find/Replace keyboard shortcuts + event
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setShowFindReplace(true);
        setFindReplaceMode(false);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'h') {
        e.preventDefault();
        setShowFindReplace(true);
        setFindReplaceMode(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setShowShortcuts(prev => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'h' || e.key === 'H')) {
        e.preventDefault();
        openVersionHistory();
      }
    };
    const handleEvent = (e: Event) => {
      const { replace } = (e as CustomEvent).detail || {};
      setShowFindReplace(true);
      setFindReplaceMode(!!replace);
    };
    window.addEventListener('keydown', handleKeyDown);
    const handleWordCount = () => setShowWordCount(true);
    const handleExport = () => setShowExport(true);
    const handleOutline = () => setShowOutline(prev => !prev);
    const handleInsertLink = () => {
      setShowLinkDialog(true);
    };
    const handleInsertImage = () => {
      setInputDialog({
        title: 'Insert image',
        fields: [
          { key: 'url', label: 'Image URL', placeholder: 'https://example.com/image.png' },
          { key: 'alt', label: 'Alt text (optional)', placeholder: 'Description' },
        ],
        onSubmit: (vals) => {
          if (editorRef && vals.url) {
            editorRef.chain().focus().setImage({ src: vals.url, alt: vals.alt || '' }).run();
          }
          setInputDialog(null);
        },
      });
    };
    const handleSpecialChars = () => setShowSpecialChars(true);
    const handleHfEdit = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setHfEditType(detail?.type || 'footer');
    };
    window.addEventListener('insert-link', handleInsertLink);
    window.addEventListener('insert-image', handleInsertImage);
    window.addEventListener('special-chars-open', handleSpecialChars);
    window.addEventListener('edit-header-footer', handleHfEdit);
    window.addEventListener('find-replace-open', handleEvent);
    window.addEventListener('word-count-open', handleWordCount);
    window.addEventListener('export-open', handleExport);
    const handleRulerToggle = () => setShowRuler(prev => !prev);
    const handlePagelessToggle = () => setPageless(prev => {
      const next = !prev;
      localStorage.setItem('md-office-pageless', String(next));
      return next;
    });
    window.addEventListener('outline-toggle', handleOutline);
    window.addEventListener('ruler-toggle', handleRulerToggle);
    window.addEventListener('pageless-toggle', handlePagelessToggle);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('find-replace-open', handleEvent);
      window.removeEventListener('word-count-open', handleWordCount);
      window.removeEventListener('export-open', handleExport);
      window.removeEventListener('outline-toggle', handleOutline);
      window.removeEventListener('ruler-toggle', handleRulerToggle);
      window.removeEventListener('pageless-toggle', handlePagelessToggle);
      window.removeEventListener('insert-link', handleInsertLink);
      window.removeEventListener('insert-image', handleInsertImage);
      window.removeEventListener('special-chars-open', handleSpecialChars);
      window.removeEventListener('edit-header-footer', handleHfEdit);
    };
  }, []);

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading MD Office...</p>
        </div>
      </div>
    );
  }

  // Show login modal if requested
  if (showLogin) {
    return (
      <div className="app">
        <div className="login-overlay">
          <div className="login-modal">
            <button 
              className="close-login-btn"
              onClick={() => setShowLogin(false)}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer'
              }}
            >
              ×
            </button>
            <Login onAuthSuccess={handleAuthSuccess} />
          </div>
        </div>
      </div>
    );
  }

  // Main app interface
  return (
    <ToastProvider>
    <div className="app">
      <MenuBar
        onNewFile={handleNewFile}
        onTemplateSelect={handleNewFromTemplate}
        onPrint={handlePrint}
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleDarkMode}
        saveStatus={saveStatus}
        isGuestMode={isGuestMode}
        isAuthenticated={isAuthenticated}
        onLogin={handleShowLogin}
        onLogout={handleLogout}
        onSwitchToGuest={handleSwitchToGuest}
        activeFile={activeFile}
        onTitleChange={handleTitleChange}
        editor={editorRef}
        onShareClick={() => setShowShareDialog(true)}
        onVersionHistory={openVersionHistory}
      />

      {/* Formatting Toolbar - Google Docs style */}
      <DocsToolbar editor={editorRef} />

      <div className="app-content">
        <DocumentSidebar
          files={files}
          activeFile={activeFile?.path || null}
          onFileSelect={handleFileSelect}
          onDelete={handleDelete}
          onNewFile={handleNewFile}
          onNewFromTemplate={handleNewFromTemplate}
          recentFiles={recentFiles}
          isGuestMode={isGuestMode}
        />

        {showOutline && editorRef && (
          <TableOfContents editor={editorRef} onClose={() => setShowOutline(false)} />
        )}

        <div className="main-editor">
          {showRuler && !pageless && activeFile && (() => {
            const parsed = parseFrontmatter(content);
            const ps = getPageStyles(parsed.metadata);
            const pageW = parseInt(ps.maxWidth) || 816;
            const defaultPad = parseInt(ps.padding) || 72;
            const lm = rulerMargins?.left ?? defaultPad;
            const rm = rulerMargins?.right ?? defaultPad;
            return (
              <Ruler
                pageWidthPx={pageW}
                leftMarginPx={lm}
                rightMarginPx={rm}
                onMarginsChange={(left, right) => setRulerMargins({ left, right })}
              />
            );
          })()}
          {loading ? (
            <div className="editor-loading">Loading document...</div>
          ) : (
            <DocumentEditor
              activeFile={activeFile}
              content={content}
              onChange={handleContentChange}
              onTitleChange={handleTitleChange}
              onEditorReady={setEditorRef}
              marginOverride={rulerMargins}
              pageless={pageless}
            />
          )}
        </div>

        {/* Find & Replace */}
        {showFindReplace && editorRef && (
          <FindReplace
            editor={editorRef}
            onClose={() => setShowFindReplace(false)}
            showReplace={findReplaceMode}
          />
        )}

        {/* Suggestion accept/reject popup */}
        {editorRef && <SuggestionPopup editor={editorRef} />}

        {showComments && (
          <CommentsSidebar
            comments={comments}
            activeCommentId={activeCommentId}
            onAddReply={handleAddReply}
            onResolve={handleResolveComment}
            onDelete={handleDeleteComment}
            onUpdateComment={handleUpdateComment}
            onSelectComment={setActiveCommentId}
            onClose={() => setShowComments(false)}
          />
        )}

        {showSuggestions && editorRef && (
          <SuggestionsSidebar
            editor={editorRef}
            onClose={() => setShowSuggestions(false)}
          />
        )}

        {showVersionHistory && (
          <VersionHistory
            commits={vhCommits}
            onRevert={handleVhRevert}
            onPreview={handleVhPreview}
            onClose={() => setShowVersionHistory(false)}
            selectedCommit={vhSelectedCommit}
            previewContent={vhPreviewContent}
            currentContent={content}
            isLoading={vhLoading}
          />
        )}
      </div>

      <StatusBar
        content={content}
        activeFile={activeFile?.path}
        saveStatus={saveStatus}
        lastSaved={lastSaved}
        isGuestMode={isGuestMode}
        suggestionMode={suggestionMode}
        collaborationStatus={collabStatus}
        connectedUsers={collabUsers}
      />

      {/* Word Count Dialog */}
      {showWordCount && (
        <Suspense fallback={null}>
          <WordCountDialog content={content} onClose={() => setShowWordCount(false)} />
        </Suspense>
      )}

      {/* Export Dialog */}
      {showExport && (
        <Suspense fallback={null}>
          <ExportDialog
            content={content}
            htmlContent={editorRef?.getHTML() || ''}
            fileName={activeFile?.path || 'untitled.md'}
            onClose={() => setShowExport(false)}
          />
        </Suspense>
      )}

      {/* Link Dialog */}
      <LinkDialog
        editor={editorRef}
        isOpen={showLinkDialog}
        onClose={() => setShowLinkDialog(false)}
      />

      {/* Input Dialog (for image insert) */}
      {inputDialog && (
        <InputDialog
          title={inputDialog.title}
          fields={inputDialog.fields}
          onSubmit={inputDialog.onSubmit}
          onClose={() => setInputDialog(null)}
        />
      )}

      {/* Special Characters */}
      {showSpecialChars && (
        <Suspense fallback={null}>
          <div className="special-chars-overlay">
            <SpecialChars
              onSelect={(char) => {
                if (editorRef) {
                  editorRef.chain().focus().insertContent(char).run();
                }
              }}
              onClose={() => setShowSpecialChars(false)}
            />
          </div>
        </Suspense>
      )}

      {/* Keyboard Shortcuts */}
      {showShortcuts && (
        <Suspense fallback={null}>
          <KeyboardShortcutsDialog onClose={() => setShowShortcuts(false)} />
        </Suspense>
      )}

      {/* Header/Footer Editor */}
      {hfEditType && (
        <HeaderFooterEditor
          type={hfEditType}
          content={hfContent}
          onChange={setHfContent}
          onClose={() => setHfEditType(null)}
          documentTitle={activeFile?.path?.split('/').pop()?.replace(/\.\w+$/, '') || 'Untitled'}
        />
      )}

      {/* Template Selector Modal */}
      {showTemplateSelector && (
        <Suspense fallback={null}>
          <TemplateSelector
            isVisible={showTemplateSelector}
            onClose={() => setShowTemplateSelector(false)}
            onSelect={handleTemplateSelect}
          />
        </Suspense>
      )}

      {/* Share Dialog */}
      <ShareDialog
        isOpen={showShareDialog}
        onClose={() => setShowShareDialog(false)}
        documentName={activeFile?.path?.split('/').pop()?.replace(/\.\w+$/, '') || 'Untitled Document'}
      />
    </div>
    </ToastProvider>
  );
}

export default App;