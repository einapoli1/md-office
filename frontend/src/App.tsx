import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingSpinner from './components/LoadingSpinner';
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
import BranchManager from './components/BranchManager';
import CommitHistory from './components/CommitHistory';
import CommentsSidebar, { Comment } from './components/CommentsSidebar';
import SuggestionPopup from './components/SuggestionPopup';
import SuggestionsSidebar from './components/SuggestionsSidebar';
import FindReplace from './components/FindReplace';
import InputDialog from './components/InputDialog';
import LinkDialog from './components/LinkDialog';
import ToastProvider from './components/ToastProvider';
import OfflineIndicator from './components/OfflineIndicator';
import ShareDialog from './components/ShareDialog';
import { toast } from './components/Toast';
import { importDocx } from './utils/docxIO';
import RecentDocs, { RecentDocEntry, loadRecentDocs, touchRecentDoc, removeRecentDoc } from './components/RecentDocs';
import _GlobalSearch from './components/GlobalSearch';
import _AIAssistant from './components/AIAssistant';
import AboutDialog from './components/AboutDialog';
import TemplatePanel from './components/TemplatePanel';
import TemplateSidebar from './components/TemplateSidebar';
import OnboardingTour, { STORAGE_KEY as ONBOARDING_KEY } from './components/OnboardingTour';
import MacroEditor from './components/MacroEditor';
import MacroRecorder, { useMacroRecorder } from './components/MacroRecorder';
import AccessibilitySettings from './components/AccessibilitySettings';
import LanguagePicker from './components/LanguagePicker';
import CitationPanel from './components/CitationPanel';
import CitationPicker from './components/CitationPicker';
import { Citation, CitationStyle } from './lib/citationEngine';
import { runMacro, loadSavedMacros, saveMacro, MacroContext } from './lib/macroEngine';
import SpreadsheetEditor from './sheets/SpreadsheetEditor';
import SlidesEditor from './slides/SlidesEditor';
import _DrawingEditor from './draw/DrawingEditor';
import NotificationCenter from './components/NotificationCenter';
import UserPreferences from './components/UserPreferences';
import FocusMode from './components/FocusMode';
import ReadingMode from './components/ReadingMode';
import DocumentStats from './components/DocumentStats';

export type AppMode = 'docs' | 'sheets' | 'slides' | 'draw';

/** Detect app mode from file extension */
function detectAppMode(filePath: string): AppMode {
  if (/\.draw\.json$/i.test(filePath)) return 'draw';
  if (/\.slides\.md$/i.test(filePath)) return 'slides';
  if (/\.(sheet\.md|mds|tsv)$/i.test(filePath)) return 'sheets';
  return 'docs';
}

// Lazy load dialogs — only rendered when opened
const TemplateSelector = lazy(() => import('./components/TemplateSelector'));
const WordCountDialog = lazy(() => import('./components/WordCountDialog'));
const ExportDialog = lazy(() => import('./components/ExportDialog'));
const KeyboardShortcutsDialog = lazy(() => import('./components/KeyboardShortcutsDialog'));
const SpecialChars = lazy(() => import('./components/SpecialChars'));
const EquationDialog = lazy(() => import('./components/EquationDialog'));
const Whiteboard = lazy(() => import('./components/Whiteboard'));
const PageColumns = lazy(() => import('./components/PageColumns'));
const CoverPage = lazy(() => import('./components/CoverPage'));
const TableOfFigures = lazy(() => import('./components/TableOfFigures'));
const PublishDialog = lazy(() => import('./components/PublishDialog'));
import _TableOfContents from './components/TableOfContents';
import OutlineView from './components/OutlineView';
import WritingPrompts from './components/WritingPrompts';
import DocumentMap from './components/DocumentMap';
import SnippetManager from './components/SnippetManager';
import { HeaderFooterEditor, HeaderFooterContent, defaultContent as defaultHFContent } from './components/HeaderFooter';
import './comments-styles.css';

function App() {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  
  // App mode
  const [appMode, setAppMode] = useState<AppMode>('docs');
  const [landingMode, setLandingMode] = useState<AppMode>('docs');

  // App state
  const [files, setFiles] = useState<FileSystemItem[]>([]);
  const [activeFile, setActiveFile] = useState<FileContent | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | 'error'>('saved');
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [recentFiles, setRecentFiles] = useState<string[]>([]);
  const [recentDocs, setRecentDocs] = useState<RecentDocEntry[]>(() => loadRecentDocs());
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
  const [showEquationDialog, setShowEquationDialog] = useState(false);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
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
  const [showAbout, setShowAbout] = useState(false);
  const [showA11y, setShowA11y] = useState(false);
  const [runTour, setRunTour] = useState(() => !localStorage.getItem(ONBOARDING_KEY));
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showBranchManager, setShowBranchManager] = useState(false);
  const [showCommitHistory, setShowCommitHistory] = useState(false);
  const [currentBranchName, setCurrentBranchName] = useState('main');
  const [showMailMerge, setShowMailMerge] = useState(false);
  const [showTemplateSidebar, setShowTemplateSidebar] = useState(false);
  const [showCitationPanel, setShowCitationPanel] = useState(false);
  const [showCitationPicker, setShowCitationPicker] = useState(false);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [citationStyle, setCitationStyle] = useState<CitationStyle>('apa');
  const [showMacroEditor, setShowMacroEditor] = useState(false);
  const [showPageColumns, setShowPageColumns] = useState(false);
  const [showCoverPage, setShowCoverPage] = useState(false);
  const [showTableOfFigures, setShowTableOfFigures] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [showFocusMode, setShowFocusMode] = useState(false);
  const [showReadingMode, setShowReadingMode] = useState(false);
  const [showDocStats, setShowDocStats] = useState(false);
  const [showWritingPrompts, setShowWritingPrompts] = useState(false);
  const [showDocumentMap, setShowDocumentMap] = useState(false);
  const [showSnippetManager, setShowSnippetManager] = useState(false);
  const { recording: macroRecording, startRecording: startMacroRecording, stopRecording: stopMacroRecording } = useMacroRecorder();
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

  // Refresh enriched recent docs when updated (e.g. star toggled)
  useEffect(() => {
    const refresh = () => setRecentDocs(loadRecentDocs());
    window.addEventListener('recent-docs-updated', refresh);
    return () => window.removeEventListener('recent-docs-updated', refresh);
  }, []);

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
        updateRecentFiles(activeFile.path, newContent);
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

  const updateRecentFiles = (filePath: string, fileContent?: string) => {
    setRecentFiles(prev => {
      const filtered = prev.filter(f => f !== filePath);
      const updated = [filePath, ...filtered].slice(0, 10);
      localStorage.setItem('recentFiles', JSON.stringify(updated));
      return updated;
    });
    // Update enriched recent docs
    const updated = touchRecentDoc(filePath, fileContent ?? '');
    setRecentDocs(updated);
  };

  const handleFileSelect = async (file: FileSystemItem) => {
    if (file.isDirectory) return;
    
    try {
      setLoading(true);
      const currentAPI = isGuestMode ? localFileAPI : fileAPI;
      const fileContent = await currentAPI.getFile(file.path);
      setActiveFile(fileContent);
      setContent(fileContent.content);
      setAppMode(detectAppMode(file.path));
      setRulerMargins(null);
      setSaveStatus('saved');
      setLastSaved(undefined);
      originalContentRef.current = fileContent.content;
      updateRecentFiles(file.path, fileContent.content);
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
      setRecentDocs(removeRecentDoc(path));
    } catch (error) {
      console.error('Failed to delete item:', error);
    }
  };

  // Version history
  // Load current branch name
  const loadCurrentBranch = useCallback(async () => {
    if (isGuestMode) return;
    try {
      const branches = await gitAPI.getBranches();
      const current = branches.find(b => b.isCurrent);
      if (current) setCurrentBranchName(current.name);
    } catch { /* ignore */ }
  }, [isGuestMode]);

  useEffect(() => { loadCurrentBranch(); }, [loadCurrentBranch]);

  const handleAutoSave = useCallback(async (_commitMessage?: string) => {
    // Trigger a normal save — the auto-save component handles commit messages
    if (activeFile && !isGuestMode) {
      try {
        setSaveStatus('saving');
        const currentAPI = fileAPI;
        await currentAPI.saveFile(activeFile.path, content);
        setSaveStatus('saved');
        setLastSaved(new Date());
      } catch {
        setSaveStatus('error');
      }
    }
  }, [activeFile, isGuestMode, content]);

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

  const handleOpenByPath = async (filePath: string) => {
    try {
      setLoading(true);
      const currentAPI = isGuestMode ? localFileAPI : fileAPI;
      const fileContent = await currentAPI.getFile(filePath);
      setActiveFile(fileContent);
      setContent(fileContent.content);
      setAppMode(detectAppMode(filePath));
      setRulerMargins(null);
      setSaveStatus('saved');
      setLastSaved(undefined);
      originalContentRef.current = fileContent.content;
      updateRecentFiles(filePath, fileContent.content);
    } catch (error) {
      console.error('Failed to open document:', error);
      toast('Failed to open document', 'error');
    } finally {
      setLoading(false);
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

  const handleNewSpreadsheet = () => {
    const now = new Date();
    const timestamp = now.toISOString().split('T')[0];
    let fileName = `Untitled Spreadsheet ${timestamp}.sheet.md`;
    let counter = 1;
    while (files.some(f => f.path === fileName)) {
      fileName = `Untitled Spreadsheet ${timestamp} ${counter}.sheet.md`;
      counter++;
    }
    handleCreateFile(fileName, false);
    setAppMode('sheets');
  };

  const handleNewPresentation = () => {
    const now = new Date();
    const timestamp = now.toISOString().split('T')[0];
    let fileName = `Untitled Presentation ${timestamp}.slides.md`;
    let counter = 1;
    while (files.some(f => f.path === fileName)) {
      fileName = `Untitled Presentation ${timestamp} ${counter}.slides.md`;
      counter++;
    }
    handleCreateFile(fileName, false);
    setAppMode('slides');
  };

  const handleNewDrawing = () => {
    const now = new Date();
    const timestamp = now.toISOString().split('T')[0];
    let fileName = `Untitled Drawing ${timestamp}.draw.json`;
    let counter = 1;
    while (files.some(f => f.path === fileName)) {
      fileName = `Untitled Drawing ${timestamp} ${counter}.draw.json`;
      counter++;
    }
    handleCreateFile(fileName, false);
    setAppMode('draw');
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
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        setShowPreferences(prev => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'h' || e.key === 'H')) {
        e.preventDefault();
        openVersionHistory();
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'c' || e.key === 'C')) {
        // Only trigger citation picker if not copying (Cmd+C without shift is copy)
        e.preventDefault();
        setShowCitationPicker(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        setShowFocusMode(prev => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        setShowReadingMode(prev => !prev);
      }
    };
    const handleEvent = (e: Event) => {
      const { replace } = (e as CustomEvent).detail || {};
      setShowFindReplace(true);
      setFindReplaceMode(!!replace);
    };
    window.addEventListener('keydown', handleKeyDown);
    const handleWordCount = () => setShowWordCount(true);
    const handleDocStats = () => setShowDocStats(true);
    const handleFocusMode = () => setShowFocusMode(true);
    const handleReadingMode = () => setShowReadingMode(true);
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
    const handleEquationDialog = () => setShowEquationDialog(true);
    const handleWhiteboardOpen = () => setShowWhiteboard(true);
    const handleHfEdit = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setHfEditType(detail?.type || 'footer');
    };
    window.addEventListener('insert-link', handleInsertLink);
    window.addEventListener('insert-image', handleInsertImage);
    window.addEventListener('special-chars-open', handleSpecialChars);
    window.addEventListener('equation-dialog-open', handleEquationDialog);
    window.addEventListener('whiteboard-open', handleWhiteboardOpen);
    window.addEventListener('edit-header-footer', handleHfEdit);
    window.addEventListener('find-replace-open', handleEvent);
    window.addEventListener('word-count-open', handleWordCount);
    window.addEventListener('doc-stats-open', handleDocStats);
    window.addEventListener('focus-mode-toggle', handleFocusMode);
    window.addEventListener('reading-mode-toggle', handleReadingMode);
    window.addEventListener('export-open', handleExport);
    const handleRulerToggle = () => setShowRuler(prev => !prev);
    const handlePagelessToggle = () => setPageless(prev => {
      const next = !prev;
      localStorage.setItem('md-office-pageless', String(next));
      return next;
    });
    window.addEventListener('outline-toggle', handleOutline);
    window.addEventListener('ruler-toggle', handleRulerToggle);
    const handleImportDocx = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        try {
          const html = await importDocx(file);
          if (editorRef) {
            editorRef.commands.setContent(html);
            toast('Word document imported', 'success');
          }
        } catch (err) {
          console.error('DOCX import failed:', err);
          toast('Failed to import Word document', 'error');
        }
      };
      input.click();
    };
    window.addEventListener('import-docx', handleImportDocx);
    window.addEventListener('pageless-toggle', handlePagelessToggle);
    const handleMailMerge = () => setShowMailMerge(prev => !prev);
    const handleTemplateSidebar = () => setShowTemplateSidebar(prev => !prev);
    const handleMacroEditor = () => setShowMacroEditor((prev: boolean) => !prev);
    const handleMacroRecord = () => window.dispatchEvent(new CustomEvent('macro-start-recording'));
    const handleMacroRunPicker = () => window.dispatchEvent(new CustomEvent('macro-run-picker'));
    window.addEventListener('mail-merge-toggle', handleMailMerge);
    window.addEventListener('template-sidebar-toggle', handleTemplateSidebar);
    const handleCitationPickerOpen = () => setShowCitationPicker(true);
    const handleCitationManagerToggle = () => setShowCitationPanel(prev => !prev);
    window.addEventListener('macro-editor-toggle', handleMacroEditor);
    window.addEventListener('macro-record-toggle', handleMacroRecord);
    window.addEventListener('macro-run-picker', handleMacroRunPicker);
    window.addEventListener('citation-picker-open', handleCitationPickerOpen);
    window.addEventListener('citation-manager-toggle', handleCitationManagerToggle);
    const handlePageColumnsOpen = () => setShowPageColumns(true);
    const handleCoverPageOpen = () => setShowCoverPage(true);
    const handleTableOfFiguresOpen = () => setShowTableOfFigures(true);
    const handlePublishOpen = () => setShowPublish(true);
    window.addEventListener('page-columns-open', handlePageColumnsOpen);
    window.addEventListener('cover-page-open', handleCoverPageOpen);
    window.addEventListener('table-of-figures-open', handleTableOfFiguresOpen);
    window.addEventListener('publish-open', handlePublishOpen);
    const handleWritingAssistant = () => setShowWritingPrompts(prev => !prev);
    const handleDocumentMap = () => setShowDocumentMap(prev => !prev);
    const handleSnippetManager = () => setShowSnippetManager(prev => !prev);
    window.addEventListener('writing-assistant-toggle', handleWritingAssistant);
    window.addEventListener('document-map-toggle', handleDocumentMap);
    window.addEventListener('snippet-manager-toggle', handleSnippetManager);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('find-replace-open', handleEvent);
      window.removeEventListener('word-count-open', handleWordCount);
      window.removeEventListener('doc-stats-open', handleDocStats);
      window.removeEventListener('focus-mode-toggle', handleFocusMode);
      window.removeEventListener('reading-mode-toggle', handleReadingMode);
      window.removeEventListener('export-open', handleExport);
      window.removeEventListener('outline-toggle', handleOutline);
      window.removeEventListener('ruler-toggle', handleRulerToggle);
      window.removeEventListener('pageless-toggle', handlePagelessToggle);
      window.removeEventListener('import-docx', handleImportDocx);
      window.removeEventListener('insert-link', handleInsertLink);
      window.removeEventListener('insert-image', handleInsertImage);
      window.removeEventListener('special-chars-open', handleSpecialChars);
      window.removeEventListener('equation-dialog-open', handleEquationDialog);
      window.removeEventListener('whiteboard-open', handleWhiteboardOpen);
      window.removeEventListener('edit-header-footer', handleHfEdit);
      window.removeEventListener('mail-merge-toggle', handleMailMerge);
      window.removeEventListener('template-sidebar-toggle', handleTemplateSidebar);
      window.removeEventListener('macro-editor-toggle', handleMacroEditor);
      window.removeEventListener('macro-record-toggle', handleMacroRecord);
      window.removeEventListener('macro-run-picker', handleMacroRunPicker);
      window.removeEventListener('citation-picker-open', handleCitationPickerOpen);
      window.removeEventListener('citation-manager-toggle', handleCitationManagerToggle);
      window.removeEventListener('page-columns-open', handlePageColumnsOpen);
      window.removeEventListener('cover-page-open', handleCoverPageOpen);
      window.removeEventListener('table-of-figures-open', handleTableOfFiguresOpen);
      window.removeEventListener('publish-open', handlePublishOpen);
      window.removeEventListener('writing-assistant-toggle', handleWritingAssistant);
      window.removeEventListener('document-map-toggle', handleDocumentMap);
      window.removeEventListener('snippet-manager-toggle', handleSnippetManager);
    };
  }, []);

  // Macro recording & run-picker events
  useEffect(() => {
    const handleStartRec = () => startMacroRecording();
    const handleStopRec = () => {
      const code = stopMacroRecording();
      if (code) {
        setShowMacroEditor(true);
      }
    };
    const handleStopRecSave = (e: Event) => {
      const code = stopMacroRecording();
      const name = (e as CustomEvent).detail?.name;
      if (name && code) {
        saveMacro({ name, code, createdAt: Date.now(), updatedAt: Date.now() });
      }
    };
    const handleRunPicker = () => {
      const macros = loadSavedMacros();
      if (macros.length === 0) {
        window.alert('No saved macros. Open the Macro Editor to create one.');
        return;
      }
      const name = window.prompt('Run macro:\n' + macros.map(m => `• ${m.name}`).join('\n'));
      if (!name) return;
      const macro = macros.find(m => m.name === name);
      if (!macro) { window.alert(`Macro "${name}" not found`); return; }
      const ctx: MacroContext = {
        getDocText: () => editorRef?.getText() ?? content ?? '',
        insertText: (text: string) => editorRef?.commands?.insertContent(text),
        replaceAll: (search: string, replace: string) => {
          if (editorRef) {
            const html = editorRef.getHTML();
            editorRef.commands.setContent(html.replaceAll(search, replace));
          }
        },
        getSelection: () => {
          if (!editorRef) return '';
          const { from, to } = editorRef.state.selection;
          return editorRef.state.doc.textBetween(from, to, '\n');
        },
        getCell: () => undefined,
        setCell: () => {},
        getRange: () => [],
        alert: (msg: string) => window.alert(msg),
        prompt: (msg: string) => Promise.resolve(window.prompt(msg)),
        toast: (msg: string) => toast(msg, 'info'),
        log: (msg: string) => console.log('[macro]', msg),
      };
      runMacro(macro.code, ctx);
    };
    const handleMacroToast = (e: Event) => {
      const msg = (e as CustomEvent).detail?.message;
      if (msg) toast(msg, 'info');
    };
    window.addEventListener('macro-start-recording', handleStartRec);
    window.addEventListener('macro-recording-stop', handleStopRec);
    window.addEventListener('macro-recording-stop-save', handleStopRecSave);
    window.addEventListener('macro-run-picker', handleRunPicker);
    window.addEventListener('macro-toast', handleMacroToast);
    return () => {
      window.removeEventListener('macro-start-recording', handleStartRec);
      window.removeEventListener('macro-recording-stop', handleStopRec);
      window.removeEventListener('macro-recording-stop-save', handleStopRecSave);
      window.removeEventListener('macro-run-picker', handleRunPicker);
      window.removeEventListener('macro-toast', handleMacroToast);
    };
  }, [editorRef, content, startMacroRecording, stopMacroRecording]);

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="app-loading">
        <LoadingSpinner size="large" message="Loading MD Office..." />
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
    <ErrorBoundary>
    <ToastProvider>
    <OfflineIndicator />
    <div className="app">
      <a href="#main-editor" className="skip-to-content">Skip to content</a>
      <div style={{ display: 'flex', alignItems: 'center' }}>
      <div style={{ flex: 1 }}>
      <MenuBar
        onNewFile={handleNewFile}
        onNewSpreadsheet={handleNewSpreadsheet}
        onNewPresentation={handleNewPresentation}
        onNewDrawing={handleNewDrawing}
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
        onBranches={() => setShowBranchManager(true)}
        onCommitHistory={() => setShowCommitHistory(true)}
        appMode={appMode}
        onShowAbout={() => setShowAbout(true)}
        onStartTour={() => setRunTour(true)}
        onShowShortcuts={() => setShowShortcuts(true)}
        onShowAccessibility={() => setShowA11y(true)}
        onShowPreferences={() => setShowPreferences(true)}
      />
      </div>
      <NotificationCenter />
      </div>

      {/* Formatting Toolbar - Google Docs style (only for docs mode) */}
      {appMode === 'docs' && <DocsToolbar editor={editorRef} />}

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
          <OutlineView editor={editorRef} onClose={() => setShowOutline(false)} />
        )}

        <div className="main-editor" id="main-editor">
          {!activeFile && !loading ? (
            <RecentDocs
              recentDocs={recentDocs}
              onOpenDocument={handleOpenByPath}
              onNewDocument={handleNewFile}
              onNewSpreadsheet={handleNewSpreadsheet}
              onNewPresentation={handleNewPresentation}
              onNewDrawing={handleNewDrawing}
              onNewFromTemplate={handleNewFromTemplate}
              landingMode={landingMode}
              onLandingModeChange={setLandingMode}
            />
          ) : null}
          {appMode === 'docs' && showRuler && !pageless && activeFile && (() => {
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
            <LoadingSpinner message="Loading document..." />
          ) : appMode === 'sheets' && activeFile ? (
            <SpreadsheetEditor
              initialData={content}
              onSave={(data) => handleContentChange(data)}
            />
          ) : appMode === 'slides' && activeFile ? (
            <SlidesEditor
              content={content}
              onChange={handleContentChange}
              filePath={activeFile.path}
            />
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

        {showMailMerge && (
          <TemplatePanel
            content={content}
            onClose={() => setShowMailMerge(false)}
            onPreview={(_rendered) => {
              toast('Preview rendered — check document', 'success');
            }}
          />
        )}

        {showTemplateSidebar && (
          <TemplateSidebar
            onClose={() => setShowTemplateSidebar(false)}
            currentContent={content}
            onUseTemplate={(tplContent) => {
              setContent(tplContent);
              if (editorRef) {
                editorRef.commands.setContent(tplContent);
              }
              setShowTemplateSidebar(false);
              toast('Template applied', 'success');
            }}
          />
        )}

        {showCitationPanel && editorRef && (
          <CitationPanel
            editor={editorRef}
            citations={citations}
            setCitations={setCitations}
            citationStyle={citationStyle}
            setCitationStyle={setCitationStyle}
            onClose={() => setShowCitationPanel(false)}
          />
        )}

        {showCitationPicker && editorRef && (
          <CitationPicker
            editor={editorRef}
            citations={citations}
            citationStyle={citationStyle}
            onAddNew={() => {
              setShowCitationPicker(false);
              setShowCitationPanel(true);
            }}
            onClose={() => setShowCitationPicker(false)}
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

        {showBranchManager && (
          <BranchManager
            onClose={() => setShowBranchManager(false)}
            onBranchChange={() => {
              loadCurrentBranch();
              if (activeFile) {
                fileAPI.getFile(activeFile.path).then(f => {
                  setActiveFile(f);
                  setContent(f.content);
                }).catch(() => {});
              }
            }}
            hasUnsavedChanges={saveStatus === 'unsaved'}
          />
        )}

        {showCommitHistory && (
          <CommitHistory
            onClose={() => setShowCommitHistory(false)}
            activeFilePath={activeFile?.path}
            onPreviewCommit={(commit) => {
              handleVhPreview(commit);
              setShowCommitHistory(false);
              setShowVersionHistory(true);
            }}
            onRestoreCommit={(commit) => {
              handleVhRevert(commit);
              setShowCommitHistory(false);
            }}
          />
        )}
      </div>

      {appMode === 'docs' && (
        <>
        <StatusBar
          content={content}
          activeFile={activeFile?.path}
          saveStatus={saveStatus}
          lastSaved={lastSaved}
          isGuestMode={isGuestMode}
          suggestionMode={suggestionMode}
          collaborationStatus={collabStatus}
          connectedUsers={collabUsers}
          currentBranch={currentBranchName}
          onBranchClick={() => setShowBranchManager(true)}
          onSave={handleAutoSave}
        />
        <div style={{ position: 'fixed', bottom: 0, right: 8, zIndex: 100 }}>
          <LanguagePicker />
        </div>
        </>
      )}

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

      {/* Publish Dialog */}
      {showPublish && (
        <Suspense fallback={null}>
          <PublishDialog
            content={content}
            htmlContent={editorRef?.getHTML() || ''}
            fileName={activeFile?.path || 'untitled.md'}
            onClose={() => setShowPublish(false)}
          />
        </Suspense>
      )}

      {/* Page Columns Dialog */}
      {showPageColumns && editorRef && (
        <Suspense fallback={null}>
          <PageColumns editor={editorRef} onClose={() => setShowPageColumns(false)} />
        </Suspense>
      )}

      {/* Cover Page Dialog */}
      {showCoverPage && editorRef && (
        <Suspense fallback={null}>
          <CoverPage editor={editorRef} onClose={() => setShowCoverPage(false)} />
        </Suspense>
      )}

      {/* Table of Figures Dialog */}
      {showTableOfFigures && editorRef && (
        <Suspense fallback={null}>
          <TableOfFigures editor={editorRef} onClose={() => setShowTableOfFigures(false)} />
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

      {/* Equation Dialog */}
      {showEquationDialog && (
        <Suspense fallback={null}>
          <EquationDialog
            open={showEquationDialog}
            onClose={() => setShowEquationDialog(false)}
            onInsert={(latex, displayMode) => {
              if (editorRef) {
                if (displayMode) {
                  editorRef.chain().focus().insertContent(`$$${latex}$$`).run();
                } else {
                  editorRef.chain().focus().insertContent(`$${latex}$`).run();
                }
              }
            }}
          />
        </Suspense>
      )}

      {/* Whiteboard */}
      {showWhiteboard && (
        <Suspense fallback={null}>
          <Whiteboard
            onClose={() => setShowWhiteboard(false)}
            onInsert={(dataUrl) => {
              if (editorRef) {
                editorRef.chain().focus().setImage({ src: dataUrl }).run();
              }
              setShowWhiteboard(false);
            }}
            isDarkMode={isDarkMode}
          />
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

      {/* About Dialog */}
      <AccessibilitySettings open={showA11y} onClose={() => setShowA11y(false)} />

      {showAbout && (
        <AboutDialog
          onClose={() => setShowAbout(false)}
          onShowShortcuts={() => setShowShortcuts(true)}
        />
      )}

      {/* Onboarding Tour */}
      <OnboardingTour
        run={runTour}
        onFinish={() => setRunTour(false)}
      />

      {/* Macro Editor */}
      {showMacroEditor && (
        <MacroEditor
          onClose={() => setShowMacroEditor(false)}
          getDocText={() => editorRef?.getText() ?? content ?? ''}
          insertText={(text: string) => editorRef?.commands?.insertContent(text)}
          replaceAll={(search: string, replace: string) => {
            if (editorRef) {
              const html = editorRef.getHTML();
              editorRef.commands.setContent(html.replaceAll(search, replace));
            }
          }}
          getSelection={() => {
            if (!editorRef) return '';
            const { from, to } = editorRef.state.selection;
            return editorRef.state.doc.textBetween(from, to, '\n');
          }}
        />
      )}

      {/* Macro Recorder */}
      {macroRecording && (
        <MacroRecorder onStop={() => {}} />
      )}

      {/* User Preferences */}
      {showPreferences && (
        <UserPreferences onClose={() => setShowPreferences(false)} />
      )}

      {/* Focus Mode */}
      {showFocusMode && (
        <FocusMode content={content} editor={editorRef} onExit={() => setShowFocusMode(false)} />
      )}

      {/* Reading Mode */}
      {showReadingMode && editorRef && (
        <ReadingMode content={editorRef.getHTML()} onExit={() => setShowReadingMode(false)} />
      )}

      {/* Document Statistics */}
      {showDocStats && (
        <DocumentStats content={content} onClose={() => setShowDocStats(false)} />
      )}

      {/* Share Dialog */}
      <ShareDialog
        isOpen={showShareDialog}
        onClose={() => setShowShareDialog(false)}
        documentName={activeFile?.path?.split('/').pop()?.replace(/\.\w+$/, '') || 'Untitled Document'}
      />

      {/* Writing Prompts */}
      {showWritingPrompts && editorRef && (
        <WritingPrompts editor={editorRef} onClose={() => setShowWritingPrompts(false)} />
      )}

      {/* Document Map */}
      {showDocumentMap && editorRef && (
        <DocumentMap editor={editorRef} onClose={() => setShowDocumentMap(false)} />
      )}

      {/* Snippet Manager */}
      {showSnippetManager && editorRef && (
        <SnippetManager editor={editorRef} onClose={() => setShowSnippetManager(false)} />
      )}
    </div>
    </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;