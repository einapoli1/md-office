import React, { useMemo } from 'react';
import { X } from 'lucide-react';

interface WordCountDialogProps {
  content: string;
  onClose: () => void;
}

const WordCountDialog: React.FC<WordCountDialogProps> = ({ content, onClose }) => {
  const stats = useMemo(() => {
    // Strip markdown formatting for text stats
    const text = content
      .replace(/^---[\s\S]*?---\n/m, '') // Remove frontmatter
      .replace(/[#*`_\[\]()!]/g, '')
      .replace(/\n{2,}/g, '\n')
      .trim();
    
    const words = text ? text.split(/\s+/).filter(w => w.length > 0).length : 0;
    const characters = text.length;
    const charactersNoSpaces = text.replace(/\s/g, '').length;
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim()).length;
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
    const lines = text.split('\n').length;
    const readingTime = Math.max(1, Math.ceil(words / 200));
    const speakingTime = Math.max(1, Math.ceil(words / 130));
    
    return { words, characters, charactersNoSpaces, paragraphs, sentences, lines, readingTime, speakingTime };
  }, [content]);

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="word-count-dialog" onClick={e => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>Word count</h3>
          <button className="dialog-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="word-count-grid">
          <div className="wc-row">
            <span className="wc-label">Words</span>
            <span className="wc-value">{stats.words.toLocaleString()}</span>
          </div>
          <div className="wc-row">
            <span className="wc-label">Characters</span>
            <span className="wc-value">{stats.characters.toLocaleString()}</span>
          </div>
          <div className="wc-row">
            <span className="wc-label">Characters (no spaces)</span>
            <span className="wc-value">{stats.charactersNoSpaces.toLocaleString()}</span>
          </div>
          <div className="wc-row">
            <span className="wc-label">Sentences</span>
            <span className="wc-value">{stats.sentences.toLocaleString()}</span>
          </div>
          <div className="wc-row">
            <span className="wc-label">Paragraphs</span>
            <span className="wc-value">{stats.paragraphs.toLocaleString()}</span>
          </div>
          <div className="wc-row">
            <span className="wc-label">Lines</span>
            <span className="wc-value">{stats.lines.toLocaleString()}</span>
          </div>
          <div className="wc-divider" />
          <div className="wc-row">
            <span className="wc-label">Reading time</span>
            <span className="wc-value">{stats.readingTime} min</span>
          </div>
          <div className="wc-row">
            <span className="wc-label">Speaking time</span>
            <span className="wc-value">{stats.speakingTime} min</span>
          </div>
        </div>
        <div className="dialog-footer">
          <button className="dialog-ok-btn" onClick={onClose}>OK</button>
        </div>
      </div>
    </div>
  );
};

export default WordCountDialog;
