import React, { useState, useEffect } from 'react';
import { Settings, X } from 'lucide-react';
import { FileContent } from '../types';
import Editor from './Editor';
import PageBreakWrapper from './PageBreakWrapper';
import { 
  parseFrontmatter, 
  serializeFrontmatter, 
  getDocumentStyles, 
  getPageStyles,
  updateMetadata,
  DocumentMetadata 
} from '../utils/frontmatter';

interface DocumentEditorProps {
  activeFile: FileContent | null;
  content: string;
  onChange: (content: string) => void;
  onTitleChange: (newTitle: string) => void;
  onEditorReady?: (editor: any) => void;
}

const DocumentEditor: React.FC<DocumentEditorProps> = ({ 
  activeFile, 
  content, 
  onChange, 
  onEditorReady
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [parsedDocument, setParsedDocument] = useState(() => parseFrontmatter(content));

  // Parse content when it changes
  useEffect(() => {
    const parsed = parseFrontmatter(content);
    setParsedDocument(parsed);
  }, [content]);

  // Handle editor content changes (markdown only, not metadata)
  const handleEditorChange = (newMarkdownContent: string) => {
    const fullContent = serializeFrontmatter(parsedDocument.metadata, newMarkdownContent);
    onChange(fullContent);
  };

  // Handle metadata updates
  const handleMetadataUpdate = (updates: Partial<DocumentMetadata>) => {
    const updatedMetadata = updateMetadata(parsedDocument.metadata, updates);
    
    // For guest mode, also store page preferences in localStorage
    if (!activeFile?.path.includes('/')) { // Simple check for guest mode
      if (updates.pageSize) {
        localStorage.setItem('preferredPageSize', updates.pageSize);
      }
      if (updates.pageMargins) {
        localStorage.setItem('preferredPageMargins', updates.pageMargins);
      }
    }
    
    const newContent = serializeFrontmatter(updatedMetadata, parsedDocument.content);
    onChange(newContent);
  };

  // Get styles from metadata
  const documentStyles = getDocumentStyles(parsedDocument.metadata);
  const pageStyles = getPageStyles(parsedDocument.metadata);

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
      <div 
        className="document-page" 
        style={{ 
          maxWidth: pageStyles.maxWidth,
          minHeight: pageStyles.minHeight,
          ...documentStyles 
        }}
      >
        <div className="document-header">
          <button 
            className="document-settings-btn"
            onClick={() => setShowSettings(!showSettings)}
            title="Document settings"
          >
            <Settings size={16} />
          </button>
        </div>
        
        <div 
          className="document-content" 
          style={{ 
            padding: 0, // Remove outer padding, let inner editor handle it
            minHeight: `calc(${pageStyles.minHeight} - 64px)`, // Account for header
            ...documentStyles 
          }}
        >
          <div className="editor-content-area" style={{ padding: pageStyles.padding }}>
            <PageBreakWrapper pageHeight={1056} gapHeight={24}>
              <Editor
                content={parsedDocument.content}
                onChange={handleEditorChange}
                onEditorReady={onEditorReady}
              />
            </PageBreakWrapper>
          </div>
        </div>
      </div>

      {/* Document Settings Panel */}
      {showSettings && (
        <div className="document-settings-overlay" onClick={() => setShowSettings(false)}>
          <div className="document-settings-panel" onClick={(e) => e.stopPropagation()}>
            <div className="settings-header">
              <h3>Document Settings</h3>
              <button onClick={() => setShowSettings(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="settings-content">
              <div className="settings-group">
                <label>Font Family</label>
                <select
                  value={parsedDocument.metadata.font || 'Lora'}
                  onChange={(e) => handleMetadataUpdate({ font: e.target.value as any })}
                >
                  <option value="Lora">Lora (Serif)</option>
                  <option value="Inter">Inter (Sans-serif)</option>
                  <option value="Georgia">Georgia</option>
                  <option value="Times">Times New Roman</option>
                  <option value="Arial">Arial</option>
                  <option value="Helvetica">Helvetica</option>
                </select>
              </div>

              <div className="settings-group">
                <label>Font Size</label>
                <select
                  value={parsedDocument.metadata.fontSize || 16}
                  onChange={(e) => handleMetadataUpdate({ fontSize: parseInt(e.target.value) })}
                >
                  <option value={12}>12px</option>
                  <option value={14}>14px</option>
                  <option value={16}>16px</option>
                  <option value={18}>18px</option>
                  <option value={20}>20px</option>
                  <option value={24}>24px</option>
                </select>
              </div>

              <div className="settings-group">
                <label>Page Size</label>
                <select
                  value={parsedDocument.metadata.pageSize || 'letter'}
                  onChange={(e) => handleMetadataUpdate({ pageSize: e.target.value as any })}
                >
                  <option value="letter">US Letter (8.5" × 11")</option>
                  <option value="a4">A4 (8.27" × 11.69")</option>
                  <option value="legal">Legal (8.5" × 14")</option>
                  <option value="tabloid">Tabloid (11" × 17")</option>
                </select>
              </div>

              <div className="settings-group">
                <label>Page Width</label>
                <select
                  value={parsedDocument.metadata.pageWidth || 'normal'}
                  onChange={(e) => handleMetadataUpdate({ pageWidth: e.target.value as any })}
                >
                  <option value="narrow">Narrow</option>
                  <option value="normal">Normal</option>
                  <option value="wide">Wide</option>
                </select>
              </div>

              <div className="settings-group">
                <label>Page Margins</label>
                <select
                  value={parsedDocument.metadata.pageMargins || 'normal'}
                  onChange={(e) => handleMetadataUpdate({ pageMargins: e.target.value as any })}
                >
                  <option value="narrow">Narrow (0.5")</option>
                  <option value="normal">Normal (1")</option>
                  <option value="wide">Wide (1.33")</option>
                </select>
              </div>

              <div className="settings-group">
                <label>Line Height</label>
                <select
                  value={parsedDocument.metadata.lineHeight || 1.6}
                  onChange={(e) => handleMetadataUpdate({ lineHeight: parseFloat(e.target.value) })}
                >
                  <option value={1.2}>1.2 (Compact)</option>
                  <option value={1.4}>1.4 (Normal)</option>
                  <option value={1.6}>1.6 (Comfortable)</option>
                  <option value={1.8}>1.8 (Spacious)</option>
                  <option value={2.0}>2.0 (Double)</option>
                </select>
              </div>

              <div className="settings-group">
                <label>Text Alignment</label>
                <select
                  value={parsedDocument.metadata.textAlign || 'left'}
                  onChange={(e) => handleMetadataUpdate({ textAlign: e.target.value as any })}
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                  <option value="justify">Justify</option>
                </select>
              </div>

              <div className="settings-group">
                <label>Author</label>
                <input
                  type="text"
                  value={parsedDocument.metadata.author || ''}
                  onChange={(e) => handleMetadataUpdate({ author: e.target.value })}
                  placeholder="Document author"
                />
              </div>

              <div className="settings-group">
                <label>Tags</label>
                <input
                  type="text"
                  value={parsedDocument.metadata.tags?.join(', ') || ''}
                  onChange={(e) => handleMetadataUpdate({ 
                    tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean)
                  })}
                  placeholder="tag1, tag2, tag3"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentEditor;