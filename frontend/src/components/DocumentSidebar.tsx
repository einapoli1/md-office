import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Search, 
  Clock, 
  Star, 
  Folder, 
  Plus,
  Settings,
  History,
  ChevronDown,
  ChevronRight,
  X
} from 'lucide-react';
import { FileSystemItem } from '../types';

interface DocumentSidebarProps {
  files: FileSystemItem[];
  activeFile: string | null;
  onFileSelect: (file: FileSystemItem) => void;
  onDelete: (path: string) => void;
  onNewFile: () => void;
  onNewFromTemplate: () => void;
  recentFiles?: string[];
}

const DocumentSidebar: React.FC<DocumentSidebarProps> = ({
  files,
  activeFile,
  onFileSelect,
  onDelete,
  onNewFile,
  onNewFromTemplate,
  recentFiles = []
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [hoveredFile, setHoveredFile] = useState<string | null>(null);

  // Filter and organize files
  const { recentFilesList, filteredFiles } = useMemo(() => {
    // Get recent files (limit to 5)
    const recent = files
      .filter(f => !f.isDirectory && recentFiles.includes(f.path))
      .slice(0, 5);

    // Filter files based on search
    const filtered = searchTerm
      ? files.filter(f => 
          f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          f.path.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : files;

    return {
      recentFilesList: recent,
      filteredFiles: filtered
    };
  }, [files, recentFiles, searchTerm]);

  const toggleFolder = (folderPath: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderPath)) {
      newExpanded.delete(folderPath);
    } else {
      newExpanded.add(folderPath);
    }
    setExpandedFolders(newExpanded);
  };

  const handleDeleteFile = (filePath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete "${filePath}"?`)) {
      onDelete(filePath);
    }
  };

  const renderFileItem = (file: FileSystemItem, level = 0) => {
    const isActive = activeFile === file.path;
    const isExpanded = expandedFolders.has(file.path);
    const isHovered = hoveredFile === file.path;

    return (
      <div key={file.path} className="file-item-container">
        <div
          className={`file-item ${isActive ? 'active' : ''} ${file.isDirectory ? 'directory' : 'file'}`}
          style={{ paddingLeft: `${8 + level * 16}px` }}
          onClick={() => file.isDirectory ? toggleFolder(file.path) : onFileSelect(file)}
          onMouseEnter={() => setHoveredFile(file.path)}
          onMouseLeave={() => setHoveredFile(null)}
        >
          <div className="file-item-content">
            {file.isDirectory ? (
              <>
                {isExpanded ? (
                  <ChevronDown size={16} className="folder-chevron" />
                ) : (
                  <ChevronRight size={16} className="folder-chevron" />
                )}
                <Folder size={16} className="file-icon" />
              </>
            ) : (
              <FileText size={16} className="file-icon" />
            )}
            
            <span className="file-name">
              {file.isDirectory ? file.name : file.name.replace(/\.md$/, '')}
            </span>
          </div>

          {!file.isDirectory && isHovered && (
            <button
              className="file-action-btn delete-btn"
              onClick={(e) => handleDeleteFile(file.path, e)}
              title="Delete file"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Render children if directory is expanded */}
        {file.isDirectory && isExpanded && (
          <div className="directory-children">
            {/* Note: This would need to be implemented to show nested files */}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="document-sidebar">
      {/* Header with New Document button */}
      <div className="sidebar-header">
        <div className="sidebar-title">
          <FileText size={20} />
          <span>Documents</span>
        </div>
        
        <button 
          className="new-doc-btn primary"
          onClick={onNewFile}
          title="New document"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <button className="quick-action-item" onClick={onNewFile}>
          <FileText size={16} />
          <span>Blank document</span>
        </button>
        <button className="quick-action-item" onClick={onNewFromTemplate}>
          <Star size={16} />
          <span>From template</span>
        </button>
      </div>

      {/* Search */}
      <div className="search-section">
        <div className="search-input-container">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      <div className="sidebar-content">
        {/* Recent Files */}
        {!searchTerm && recentFilesList.length > 0 && (
          <div className="file-section">
            <div className="section-header">
              <Clock size={14} />
              <span>Recent</span>
            </div>
            <div className="file-list">
              {recentFilesList.map(file => renderFileItem(file))}
            </div>
          </div>
        )}

        {/* All Files */}
        <div className="file-section">
          <div className="section-header">
            <Folder size={14} />
            <span>{searchTerm ? 'Search results' : 'All documents'}</span>
            {!searchTerm && (
              <span className="file-count">({files.filter(f => !f.isDirectory).length})</span>
            )}
          </div>
          <div className="file-list">
            {filteredFiles.length === 0 ? (
              <div className="empty-state">
                <p>No documents found</p>
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className="clear-search">
                    Clear search
                  </button>
                )}
              </div>
            ) : (
              filteredFiles.map(file => renderFileItem(file))
            )}
          </div>
        </div>
      </div>

      {/* Advanced Options (collapsed by default) */}
      <div className="sidebar-footer">
        <button 
          className="advanced-toggle"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          <Settings size={14} />
          <span>Advanced</span>
          <ChevronDown 
            size={14} 
            className={`chevron ${showAdvanced ? 'expanded' : ''}`} 
          />
        </button>

        {showAdvanced && (
          <div className="advanced-section">
            <button className="advanced-item">
              <History size={14} />
              <span>Version History</span>
            </button>
            <button className="advanced-item">
              <Settings size={14} />
              <span>Settings</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentSidebar;