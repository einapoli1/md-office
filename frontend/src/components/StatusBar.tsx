import React, { useMemo, useState, useCallback } from 'react';
import { FileText, Type, Clock, Minus, Plus, GitBranch as BranchIcon, Lock } from 'lucide-react';
import AutoSave from './AutoSave';

interface StatusBarProps {
  content: string;
  activeFile?: string | null;
  saveStatus: 'saved' | 'saving' | 'unsaved' | 'error';
  lastSaved?: Date;
  isGuestMode?: boolean;
  suggestionMode?: boolean;
  collaborationStatus?: 'disconnected' | 'connecting' | 'connected';
  connectedUsers?: number;
  onZoomChange?: (zoom: number) => void;
  currentBranch?: string;
  onBranchClick?: () => void;
  onSave?: (commitMessage?: string) => Promise<void>;
  isProtected?: boolean;
}

const StatusBar: React.FC<StatusBarProps> = ({ 
  content, 
  activeFile,
  saveStatus,
  lastSaved,
  isGuestMode = false,
  suggestionMode = false,
  collaborationStatus,
  connectedUsers = 0,
  onZoomChange,
  currentBranch,
  onBranchClick,
  onSave,
  isProtected,
}) => {
  const [zoom, setZoom] = useState(100);
  const zoomLevels = [50, 75, 90, 100, 110, 125, 150, 175, 200];

  const handleZoomChange = useCallback((newZoom: number) => {
    const clamped = Math.max(50, Math.min(200, newZoom));
    setZoom(clamped);
    onZoomChange?.(clamped);
    // Apply zoom to the editor content area
    const editor = document.querySelector('.docs-editor-content') as HTMLElement;
    if (editor) {
      editor.style.transform = `scale(${clamped / 100})`;
      editor.style.transformOrigin = 'top center';
    }
  }, [onZoomChange]);

  const zoomIn = () => {
    const nextLevel = zoomLevels.find(z => z > zoom) || 200;
    handleZoomChange(nextLevel);
  };

  const zoomOut = () => {
    const prevLevel = [...zoomLevels].reverse().find(z => z < zoom) || 50;
    handleZoomChange(prevLevel);
  };
  const stats = useMemo(() => {
    const text = content.replace(/[#*`_\[\]()]/g, '').trim(); // Remove markdown formatting
    const words = text ? text.split(/\s+/).length : 0;
    const characters = text.length;
    const charactersNoSpaces = text.replace(/\s/g, '').length;
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim()).length;
    
    // Estimate reading time (average 200 words per minute)
    const readingTime = Math.max(1, Math.ceil(words / 200));
    
    return {
      words,
      characters,
      charactersNoSpaces,
      paragraphs,
      readingTime
    };
  }, [content]);

  const formatLastSaved = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const getSaveStatusText = () => {
    switch (saveStatus) {
      case 'saving':
        return 'Saving...';
      case 'unsaved':
        return 'Unsaved changes';
      case 'error':
        return 'Save failed - will retry';
      default:
        return lastSaved ? `Saved ${formatLastSaved(lastSaved)}` : 'All changes saved';
    }
  };

  const getSaveStatusColor = () => {
    switch (saveStatus) {
      case 'saving':
        return '#ff9800';
      case 'unsaved':
        return '#2196f3';
      case 'error':
        return '#f44336';
      default:
        return '#4caf50';
    }
  };

  return (
    <div className="status-bar">
      <div className="status-bar-left">
        {isProtected && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#d32f2f', marginRight: 8 }} title="Document is protected">
            <Lock size={12} /> Protected
          </span>
        )}
        {currentBranch && (
          <button
            onClick={onBranchClick}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              border: 'none', background: 'transparent', cursor: 'pointer',
              fontSize: 11, color: '#1a73e8', padding: '2px 8px', borderRadius: 4,
              marginRight: 8,
            }}
            title="Manage branches"
          >
            <BranchIcon size={12} />
            <span style={{ fontWeight: 500 }}>{currentBranch}</span>
          </button>
        )}
        {onSave ? (
          <AutoSave
            content={content}
            activeFilePath={activeFile}
            onSave={onSave}
            saveStatus={saveStatus}
            lastSaved={lastSaved}
          />
        ) : (
          <div 
            className="save-status"
            style={{ color: getSaveStatusColor() }}
            aria-live="polite"
            role="status"
          >
            <div className="status-indicator">
              <div 
                className={`status-dot ${saveStatus}`}
                style={{ backgroundColor: getSaveStatusColor() }}
              />
              <span>{getSaveStatusText()}</span>
              {isGuestMode && (
                <span className="guest-mode-indicator" title="Guest mode - documents stored locally">
                  (Local)
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="status-bar-center">
        {collaborationStatus === 'connected' && (
          <span style={{ 
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 11, color: '#137333', background: '#e6f4ea',
            padding: '2px 8px', borderRadius: 4, marginRight: 8 
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34a853', display: 'inline-block' }} />
            {connectedUsers > 1 ? `${connectedUsers} editing` : 'Connected'}
          </span>
        )}
        {collaborationStatus === 'connecting' && (
          <span style={{ 
            fontSize: 11, color: '#e37400', background: '#fef7e0',
            padding: '2px 8px', borderRadius: 4, marginRight: 8 
          }}>
            Connecting...
          </span>
        )}
        {suggestionMode && (
          <span className="suggestion-mode-indicator active" style={{ marginRight: 8 }}>
            ✏️ Suggesting
          </span>
        )}
        {activeFile && (
          <div className="file-info">
            <FileText size={14} />
            <span className="file-name">
              {activeFile.replace(/.*\//, '').replace(/\.md$/, '')}
            </span>
          </div>
        )}
      </div>

      <div className="status-bar-right">
        <div className="document-stats">
          <div className="stat-item" title="Reading time">
            <Clock size={12} />
            <span>{stats.readingTime} min read</span>
          </div>
          
          <div className="stat-divider" />
          
          <div className="stat-item" title="Word count">
            <Type size={12} />
            <span>{stats.words.toLocaleString()} words</span>
          </div>
          
          <div className="stat-divider" />
          
          <div className="stat-item" title="Character count">
            <span>{stats.characters.toLocaleString()} characters</span>
          </div>
          
          <div className="stat-divider" />
          
          <div className="stat-item" title="Pages (≈250 words/page)">
            <span>{Math.max(1, Math.ceil(stats.words / 250))} pages</span>
          </div>
          
          <div className="stat-divider" />
          
          <div className="zoom-control">
            <button className="zoom-btn" onClick={zoomOut} title="Zoom out">
              <Minus size={12} />
            </button>
            <select
              className="zoom-select"
              value={zoom}
              onChange={e => handleZoomChange(Number(e.target.value))}
              title="Zoom level"
            >
              {zoomLevels.map(z => (
                <option key={z} value={z}>{z}%</option>
              ))}
            </select>
            <button className="zoom-btn" onClick={zoomIn} title="Zoom in">
              <Plus size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatusBar;