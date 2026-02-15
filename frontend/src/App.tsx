import { useState, useEffect, useRef, useCallback } from 'react';
import DocumentSidebar from './components/DocumentSidebar';
import DocumentEditor from './components/DocumentEditor';
import MenuBar from './components/MenuBar';
import StatusBar from './components/StatusBar';
import TemplateSelector from './components/TemplateSelector';
import { FileSystemItem, FileContent } from './types';
import { fileAPI } from './utils/api';
import { Template } from './utils/templates';

function App() {
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

  // Auto-save functionality
  const saveTimeoutRef = useRef<number>();
  const originalContentRef = useRef<string>('');

  // Load file tree on mount
  useEffect(() => {
    loadFiles();
    loadRecentFiles();
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
    saveTimeoutRef.current = setTimeout(async () => {
      if (newContent === originalContentRef.current) {
        setSaveStatus('saved');
        return;
      }

      try {
        setSaveStatus('saving');
        await fileAPI.saveFile(activeFile.path, newContent);
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
      const fileData = await fileAPI.getFiles();
      setFiles(fileData);
    } catch (error) {
      console.error('Failed to load files:', error);
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
      const fileContent = await fileAPI.getFile(file.path);
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
      if (isDirectory) {
        await fileAPI.createDirectory(name);
      } else {
        await fileAPI.createFile(name);
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
      await fileAPI.createFile(name);
      if (template.content) {
        await fileAPI.saveFile(name, template.content);
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
      await fileAPI.deleteItem(path);
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
    const fileName = window.prompt('Enter file name (include .md extension):');
    if (fileName) {
      handleCreateFile(fileName, false);
    }
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
      />

      <div className="app-content">
        <DocumentSidebar
          files={files}
          activeFile={activeFile?.path || null}
          onFileSelect={handleFileSelect}
          onDelete={handleDelete}
          onNewFile={handleNewFile}
          onNewFromTemplate={handleNewFromTemplate}
          recentFiles={recentFiles}
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
            />
          )}
        </div>
      </div>

      <StatusBar
        content={content}
        activeFile={activeFile?.path}
        saveStatus={saveStatus}
        lastSaved={lastSaved}
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