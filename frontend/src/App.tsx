import { useState, useEffect, useRef, useCallback } from 'react';
import FileTree from './components/FileTree';
import Editor from './components/Editor';
import Preview from './components/Preview';
import VersionHistory from './components/VersionHistory';
// Removed unused component imports
import TemplateSelector from './components/TemplateSelector';
import TableOfContents from './components/TableOfContents';
import { FileSystemItem, FileContent, GitCommit } from './types';
import { fileAPI, gitAPI } from './utils/api';
import { Template } from './utils/templates';
import { FileText, Folder, Plus, ChevronDown, Download, Printer } from 'lucide-react';

function App() {
  const [files, setFiles] = useState<FileSystemItem[]>([]);
  const [activeFile, setActiveFile] = useState<FileContent | null>(null);
  const [content, setContent] = useState('');
  const [history, setHistory] = useState<GitCommit[]>([]);
  const [showPreview, setShowPreview] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | 'error'>('saved');
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [showNewFileMenu, setShowNewFileMenu] = useState(false);
  
  // Removed unused collaboration state variables

  // Auto-save functionality
  const saveTimeoutRef = useRef<number>();
  const originalContentRef = useRef<string>('');

  // Load file tree on mount
  useEffect(() => {
    loadFiles();
  }, []);

  // Load git history when active file changes
  useEffect(() => {
    if (activeFile) {
      loadHistory(activeFile.path);
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

    // Set up debounced save (500ms after last keystroke)
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
        
        // Refresh history after auto-save
        await loadHistory(activeFile.path);
      } catch (error) {
        console.error('Auto-save failed:', error);
        setSaveStatus('error');
        
        // Retry after 5 seconds
        setTimeout(() => {
          debouncedSave(newContent);
        }, 5000);
      }
    }, 500);
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

  const loadHistory = async (path?: string) => {
    try {
      const historyData = await gitAPI.getHistory(path);
      setHistory(historyData.commits);
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  };

  const handleFileSelect = async (file: FileSystemItem) => {
    if (file.isDirectory) return;
    
    try {
      setLoading(true);
      const fileContent = await fileAPI.getFile(file.path);
      setActiveFile(fileContent);
      setContent(fileContent.content);
      setSaveStatus('saved');
      originalContentRef.current = fileContent.content;
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

  const handleManualSave = async () => {
    if (!activeFile) return;

    try {
      setSaveStatus('saving');
      await fileAPI.saveFile(activeFile.path, content);
      setActiveFile({ ...activeFile, content });
      originalContentRef.current = content;
      setSaveStatus('saved');
      await loadHistory(activeFile.path);
    } catch (error) {
      console.error('Failed to save file:', error);
      setSaveStatus('error');
    }
  };

  const handleCreateFile = async (name: string, isDirectory: boolean) => {
    try {
      if (isDirectory) {
        await fileAPI.createDirectory(name);
      } else {
        await fileAPI.createFile(name);
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
        content: template.content,
        lastModified: new Date().toISOString()
      };
      setActiveFile(newFile);
      setContent(template.content);
      setSaveStatus('saved');
      originalContentRef.current = template.content;
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
    } catch (error) {
      console.error('Failed to delete item:', error);
    }
  };

  const handleRevert = async (commit: GitCommit) => {
    if (!activeFile) return;
    
    try {
      await gitAPI.revertToCommit(commit.hash, activeFile.path);
      // Reload the file content after revert
      await handleFileSelect({ name: activeFile.path, path: activeFile.path, isDirectory: false });
      await loadHistory(activeFile.path);
    } catch (error) {
      console.error('Failed to revert:', error);
    }
  };

  const handleViewDiff = async (commit: GitCommit) => {
    setSelectedCommit(commit);
    setShowDiffViewer(true);
  };

  const handleCommentsChange = (newComments: Comment[]) => {
    setComments(newComments);
  };

  const handleSuggestionsChange = (newSuggestions: Suggestion[]) => {
    setSuggestions(newSuggestions);
  };

  const handleToggleSuggestionsMode = () => {
    setSuggestionsMode(!suggestionsMode);
  };

  const handleCommentSelect = (commentId: string) => {
    // Could scroll to comment or highlight it
    console.log('Selected comment:', commentId);
  };

  const handleMoveFile = async (sourcePath: string, targetPath: string) => {
    try {
      await fileAPI.moveFile(sourcePath, targetPath);
      await loadFiles();
      
      // Update active file path if it was moved
      if (activeFile?.path === sourcePath) {
        setActiveFile({ ...activeFile, path: targetPath });
      }
    } catch (error) {
      console.error('Failed to move file:', error);
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

  const handleNewFileClick = () => {
    setShowNewFileMenu(!showNewFileMenu);
  };

  const handleNewBlankFile = () => {
    const fileName = window.prompt('Enter file name (include .md extension):');
    if (fileName) {
      handleCreateFile(fileName, false);
    }
    setShowNewFileMenu(false);
  };

  const handleNewFromTemplate = () => {
    setShowTemplateSelector(true);
    setShowNewFileMenu(false);
  };

  const handleTemplateSelect = (template: Template) => {
    const fileName = window.prompt('Enter file name (include .md extension):');
    if (fileName) {
      handleCreateFromTemplate(fileName, template);
    }
  };

  return (
    <div className="app">
      <div className="sidebar">
        <div className="header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={20} />
            MD Office
          </h2>
          
          {/* New File Menu */}
          <div className="new-file-menu" style={{ position: 'relative' }}>
            <button 
              onClick={handleNewFileClick}
              className="new-file-button"
              title="Create New File"
            >
              <Plus size={16} />
              <ChevronDown size={12} />
            </button>
            
            {showNewFileMenu && (
              <div className="new-file-dropdown">
                <button onClick={handleNewBlankFile} className="dropdown-item">
                  <FileText size={14} />
                  Blank Document
                </button>
                <button onClick={handleNewFromTemplate} className="dropdown-item">
                  <FileText size={14} />
                  From Template
                </button>
                <div className="dropdown-divider"></div>
                <button 
                  onClick={() => {
                    const name = window.prompt('Enter directory name:');
                    if (name) handleCreateFile(name, true);
                    setShowNewFileMenu(false);
                  }} 
                  className="dropdown-item"
                >
                  <Folder size={14} />
                  New Folder
                </button>
              </div>
            )}
          </div>
        </div>
        
        <FileTree 
          files={files} 
          onFileSelect={handleFileSelect}
          onCreateFile={handleCreateFile}
          onDelete={handleDelete}
          onMoveFile={handleMoveFile}
          activeFile={activeFile?.path}
        />
        
        {activeFile && (
          <div style={{ padding: '10px', borderTop: '1px solid var(--border)' }}>
            <TableOfContents content={content} />
          </div>
        )}
        
        <VersionHistory 
          commits={history}
          onRevert={handleRevert}
          onViewDiff={handleViewDiff}
        />
      </div>

      <div className="main-content">
        <div className="header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {activeFile && (
              <>
                <span>{activeFile.path}</span>
                <button onClick={handleManualSave} className="primary">
                  Save
                </button>
                <button onClick={() => setShowPreview(!showPreview)}>
                  {showPreview ? 'Hide Preview' : 'Show Preview'}
                </button>
                <button onClick={handleExportPDF} title="Export to PDF">
                  <Download size={16} />
                  PDF
                </button>
                <button onClick={handlePrint} title="Print">
                  <Printer size={16} />
                  Print
                </button>
              </>
            )}
          </div>
        </div>

        {activeFile ? (
          <div className="editor-container">
            <div className="editor">
              {loading ? (
                <div>Loading...</div>
              ) : (
                <Editor
                  content={content}
                  onChange={handleContentChange}
                  filePath={activeFile.path}
                  comments={comments}
                  onCommentsChange={setComments}
                  suggestionsMode={suggestionsMode}
                  saveStatus={saveStatus}
                />
              )}
            </div>
            
            {showPreview && (
              <Preview content={content} />
            )}
          </div>
        ) : (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '100%',
            flexDirection: 'column',
            gap: '20px',
            color: '#666'
          }}>
            <Folder size={48} />
            <p>Select a file to start editing</p>
            <p style={{ fontSize: '14px' }}>Create a new file or open an existing one from the sidebar</p>
            
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button onClick={handleNewBlankFile} className="primary">
                <Plus size={16} />
                New File
              </button>
              <button onClick={() => setShowTemplateSelector(true)}>
                <FileText size={16} />
                From Template
              </button>
            </div>
          </div>
        )}
      </div>

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
