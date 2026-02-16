import React, { useState, useEffect, useCallback } from 'react';
import { Settings, X } from 'lucide-react';
import { FileContent } from '../types';
import Editor from './Editor';
import CollabPresence from './CollabPresence';
import CollabChat from './CollabChat';
import CollabHistory from './CollabHistory';
import PageSetupDialog from './PageSetupDialog';
import { getUserColor } from '../utils/collabColors';
import WatermarkDialog, { WatermarkConfig } from './WatermarkDialog';
// PageBreaks handled by TipTap extension now
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
  marginOverride?: { left: number; right: number } | null;
  pageless?: boolean;
}

const DocumentEditor: React.FC<DocumentEditorProps> = ({ 
  activeFile, 
  content, 
  onChange, 
  onEditorReady,
  marginOverride,
  pageless = false
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [showPageSetup, setShowPageSetup] = useState(false);
  const [showWatermark, setShowWatermark] = useState(false);
  const [parsedDocument, setParsedDocument] = useState(() => parseFrontmatter(content));
  const [collabProvider, setCollabProvider] = useState<any>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
  const [editorInstance, setEditorInstance] = useState<any>(null);

  const isCollab = new URLSearchParams(window.location.search).has('collab');
  const collabUserName = new URLSearchParams(window.location.search).get('user') || 'Anonymous User';
  const collabUserColor = getUserColor(collabUserName);
  const handleProviderReady = useCallback((p: any) => setCollabProvider(p), []);
  const handleEditorReady = useCallback((e: any) => {
    setEditorInstance(e);
    onEditorReady?.(e);
  }, [onEditorReady]);

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

  // Listen for page setup and text direction events
  useEffect(() => {
    const handlePageSetup = () => setShowPageSetup(true);
    const handleWatermarkOpen = () => setShowWatermark(true);
    const handleTextDirection = (e: Event) => {
      const dir = (e as CustomEvent).detail?.dir as 'ltr' | 'rtl';
      if (dir) handleMetadataUpdate({ textDirection: dir });
    };
    window.addEventListener('page-setup-open', handlePageSetup);
    window.addEventListener('watermark-open', handleWatermarkOpen);
    window.addEventListener('set-text-direction', handleTextDirection);
    return () => {
      window.removeEventListener('page-setup-open', handlePageSetup);
      window.removeEventListener('watermark-open', handleWatermarkOpen);
      window.removeEventListener('set-text-direction', handleTextDirection);
    };
  }, [parsedDocument]);

  // Get styles from metadata
  const documentStyles = getDocumentStyles(parsedDocument.metadata);
  const pageStyles = getPageStyles(parsedDocument.metadata);
  const textDirection = parsedDocument.metadata.textDirection || 'ltr';

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
    <div className={`document-editor ${pageless ? 'document-editor--pageless' : ''}`}>
      <div 
        className={`document-page ${pageless ? 'document-page--pageless' : ''}`}
        dir={textDirection}
        style={pageless ? { ...documentStyles } : { 
          maxWidth: pageStyles.maxWidth,
          minHeight: pageStyles.minHeight,
          ...documentStyles 
        }}
      >
        <div className="document-header">
          {isCollab && collabProvider && (
            <>
              <CollabPresence provider={collabProvider} currentUser={collabUserName} editor={editorInstance} />
              <div style={{ display: 'inline-flex', gap: 4, marginLeft: 8 }}>
                <button
                  onClick={() => { setChatOpen(o => !o); setHistoryOpen(false); }}
                  title="Toggle chat"
                  style={{
                    position: 'relative', background: 'none', border: '1px solid #ddd',
                    borderRadius: 4, cursor: 'pointer', fontSize: 14, padding: '2px 8px',
                  }}
                >
                  💬
                  {chatUnread > 0 && (
                    <span style={{
                      position: 'absolute', top: -6, right: -6,
                      background: '#EA4335', color: '#fff', fontSize: 10,
                      borderRadius: '50%', width: 16, height: 16,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700,
                    }}>{chatUnread}</span>
                  )}
                </button>
                <button
                  onClick={() => { setHistoryOpen(o => !o); setChatOpen(false); }}
                  title="Activity feed"
                  style={{
                    background: 'none', border: '1px solid #ddd',
                    borderRadius: 4, cursor: 'pointer', fontSize: 14, padding: '2px 8px',
                  }}
                >📋</button>
              </div>
            </>
          )}
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
          <div className="editor-content-area" style={{ 
            padding: marginOverride 
              ? `${parseInt(pageStyles.padding)}px ${marginOverride.right}px ${parseInt(pageStyles.padding)}px ${marginOverride.left}px`
              : pageStyles.padding 
          }}>
            <div className="page-break-wrapper" style={{ position: 'relative' }}>
              <Editor
                content={parsedDocument.content}
                onChange={handleEditorChange}
                onEditorReady={handleEditorReady}
                enableCollaboration={isCollab}
                documentName={activeFile?.path || 'untitled'}
                userName={collabUserName}
                onProviderReady={handleProviderReady}
                pageless={pageless}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Watermark Overlay */}
      {parsedDocument.metadata.watermark && (
        <div className="watermark-overlay" aria-hidden="true">
          <span
            className="watermark-text"
            style={{
              fontSize: { small: 48, medium: 72, large: 120 }[(parsedDocument.metadata.watermark as WatermarkConfig).fontSize] || 72,
              color: (parsedDocument.metadata.watermark as WatermarkConfig).color || '#cccccc',
              opacity: (parsedDocument.metadata.watermark as WatermarkConfig).opacity ?? 0.3,
              transform: `translate(-50%, -50%) rotate(${(parsedDocument.metadata.watermark as WatermarkConfig).rotation ?? -45}deg)`,
            }}
          >
            {(parsedDocument.metadata.watermark as WatermarkConfig).text}
          </span>
        </div>
      )}

      {/* Watermark Dialog */}
      {showWatermark && (
        <WatermarkDialog
          watermark={(parsedDocument.metadata.watermark as WatermarkConfig) || null}
          onApply={(config) => handleMetadataUpdate({ watermark: config as any })}
          onClose={() => setShowWatermark(false)}
        />
      )}

      {/* Page Setup Dialog */}
      {showPageSetup && (
        <PageSetupDialog
          metadata={parsedDocument.metadata}
          onUpdate={handleMetadataUpdate}
          onClose={() => setShowPageSetup(false)}
        />
      )}

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
                  <option value="wide">Wide (1.5")</option>
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

      {/* Collab Chat Panel */}
      {isCollab && collabProvider && (
        <CollabChat
          provider={collabProvider}
          currentUser={collabUserName}
          currentUserColor={collabUserColor}
          editor={editorInstance}
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          onUnreadChange={setChatUnread}
        />
      )}

      {/* Collab Activity Feed */}
      {isCollab && collabProvider && (
        <CollabHistory
          provider={collabProvider}
          currentUser={collabUserName}
          editor={editorInstance}
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </div>
  );
};

export default DocumentEditor;