import React, { useState, useRef, useEffect } from 'react';
import { FileContent } from '../types';
import Editor from './Editor';

interface DocumentEditorProps {
  activeFile: FileContent | null;
  content: string;
  onChange: (content: string) => void;
  onTitleChange: (newTitle: string) => void;
}

const DocumentEditor: React.FC<DocumentEditorProps> = ({ 
  activeFile, 
  content, 
  onChange, 
  onTitleChange
}) => {
  const [documentTitle, setDocumentTitle] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeFile) {
      // Extract title from filename (remove .md extension)
      const title = activeFile.path.replace(/\.md$/, '').replace(/.*\//, '');
      setDocumentTitle(title);
    }
  }, [activeFile]);

  const handleTitleClick = () => {
    setIsEditingTitle(true);
  };

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (documentTitle.trim() && activeFile) {
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

  if (!activeFile) {
    return (
      <div className="document-empty-state">
        <div className="empty-state-content">
          <div className="empty-state-icon">📄</div>
          <h2>Start a new document</h2>
          <p>Choose a template or create a blank document to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="document-editor">
      <div className="document-page">
        <div className="document-title-area">
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              value={documentTitle}
              onChange={(e) => setDocumentTitle(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={handleTitleKeyDown}
              className="document-title-input"
            />
          ) : (
            <h1 
              className="document-title" 
              onClick={handleTitleClick}
              title="Click to rename document"
            >
              {documentTitle || 'Untitled Document'}
            </h1>
          )}
        </div>
        
        <div className="document-content">
          <Editor
            content={content}
            onChange={onChange}
          />
        </div>
      </div>
    </div>
  );
};

export default DocumentEditor;