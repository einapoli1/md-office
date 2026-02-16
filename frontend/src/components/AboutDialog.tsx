import React from 'react';
import { X, FileText, GitBranch, Users, WifiOff, Keyboard, ExternalLink } from 'lucide-react';

interface AboutDialogProps {
  onClose: () => void;
  onShowShortcuts?: () => void;
}

const AboutDialog: React.FC<AboutDialogProps> = ({ onClose, onShowShortcuts }) => {
  const features = [
    { icon: FileText, label: 'Markdown-based', desc: 'Documents are plain Markdown files' },
    { icon: GitBranch, label: 'Git version control', desc: 'Full history with branching & diffs' },
    { icon: Users, label: 'Real-time collaboration', desc: 'Edit together with live cursors' },
    { icon: WifiOff, label: 'Offline-capable', desc: 'Works without an internet connection' },
  ];

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="about-dialog" onClick={e => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>About MD Office</h3>
          <button className="dialog-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="about-content">
          <div className="about-hero">
            <div className="about-logo">
              <FileText size={40} />
            </div>
            <h2>MD Office</h2>
            <p className="about-version">Version 1.0.0</p>
            <p className="about-tagline">A git-native office suite — Docs, Sheets, Slides</p>
          </div>

          <div className="about-features">
            {features.map((f, i) => (
              <div key={i} className="about-feature">
                <f.icon size={18} />
                <div>
                  <div className="about-feature-label">{f.label}</div>
                  <div className="about-feature-desc">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="about-links">
            <a
              href="https://github.com/md-office/md-office"
              target="_blank"
              rel="noopener noreferrer"
              className="about-link"
            >
              <ExternalLink size={14} />
              GitHub Repository
            </a>
            <button
              className="about-link"
              onClick={() => { onClose(); onShowShortcuts?.(); }}
            >
              <Keyboard size={14} />
              Keyboard Shortcuts
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutDialog;
