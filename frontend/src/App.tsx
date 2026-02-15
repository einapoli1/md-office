import { useState, useEffect, useRef, useCallback } from 'react';
import DocumentSidebar from './components/DocumentSidebar';
import DocumentEditor from './components/DocumentEditor';
import MenuBar from './components/MenuBar';
import StatusBar from './components/StatusBar';
import TemplateSelector from './components/TemplateSelector';
import Login from './components/Login';
import DocsToolbar from './components/DocsToolbar';
import { FileSystemItem, FileContent } from './types';
import { fileAPI } from './utils/api';
import { localFileAPI, initializeLocalStorage } from './utils/localApi';
import { Template } from './utils/templates';
import CommentsSidebar, { Comment } from './components/CommentsSidebar';
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
    saveTimeoutRef.current = setTimeout(async () => {
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
        
        // Update recent files
        updateRecentFiles(activeFile.path);
      } catch (error) {
        console.error('Auto-save failed:', error);
        setSaveStatus('error');
        
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

  const handleExportPDF = async () => {
    if (!activeFile) return;
    
    try {
      const response = await fetch(`/api/export/pdf/${encodeURIComponent(activeFile.path)}`, {
        method: 'GET',
      });
      
      if (!response.ok) {
        throw new Error('Export failed');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `${activeFile.path.replace('.md', '')}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export PDF:', error);
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

    window.addEventListener('suggestion-mode-toggle', handleToggle);
    window.addEventListener('suggestions-accept-all', handleAcceptAll);
    window.addEventListener('suggestions-reject-all', handleRejectAll);
    return () => {
      window.removeEventListener('suggestion-mode-toggle', handleToggle);
      window.removeEventListener('suggestions-accept-all', handleAcceptAll);
      window.removeEventListener('suggestions-reject-all', handleRejectAll);
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
      // Prompt for comment text
      const text = prompt('Add a comment:');
      if (!text) {
        // Remove the mark if user cancels
        if (editorRef) editorRef.chain().focus().unsetComment().run();
        return;
      }
      newComment.text = text;
      setComments(prev => [...prev, newComment]);
      setActiveCommentId(commentId);
      setShowComments(true);
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
    <div className="app">
      <MenuBar
        onNewFile={handleNewFile}
        onTemplateSelect={handleNewFromTemplate}
        onExportPDF={handleExportPDF}
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

        <div className="main-editor">
          {loading ? (
            <div className="editor-loading">Loading document...</div>
          ) : (
            <DocumentEditor
              activeFile={activeFile}
              content={content}
              onChange={handleContentChange}
              onTitleChange={handleTitleChange}
              onEditorReady={setEditorRef}
            />
          )}
        </div>

        {showComments && (
          <CommentsSidebar
            comments={comments}
            activeCommentId={activeCommentId}
            onAddReply={handleAddReply}
            onResolve={handleResolveComment}
            onDelete={handleDeleteComment}
            onSelectComment={setActiveCommentId}
            onClose={() => setShowComments(false)}
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
      />

      {/* Template Selector Modal */}
      <TemplateSelector
        isVisible={showTemplateSelector}
        onClose={() => setShowTemplateSelector(false)}
        onSelect={handleTemplateSelect}
      />
    </div>
  );
}

export default App;