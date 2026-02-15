import React, { useMemo } from 'react';
import { FileText, Type, Clock } from 'lucide-react';

interface StatusBarProps {
  content: string;
  activeFile?: string | null;
  saveStatus: 'saved' | 'saving' | 'unsaved' | 'error';
  lastSaved?: Date;
  isGuestMode?: boolean;
}

const StatusBar: React.FC<StatusBarProps> = ({ 
  content, 
  activeFile,
  saveStatus,
  lastSaved,
  isGuestMode = false 
}) => {
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
        <div 
          className="save-status"
          style={{ color: getSaveStatusColor() }}
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
      </div>

      <div className="status-bar-center">
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
        </div>
      </div>
    </div>
  );
};

export default StatusBar;