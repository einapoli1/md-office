import React, { useState, useMemo } from 'react';
import { Plus, FileText, Search, LayoutTemplate, Clock, Star, StarOff } from 'lucide-react';

export interface RecentDocEntry {
  path: string;
  title: string;
  lastModified: string;
  preview: string;
  starred?: boolean;
}

interface RecentDocsProps {
  onOpenDocument: (path: string) => void;
  onNewDocument: () => void;
  onNewFromTemplate: () => void;
  recentDocs: RecentDocEntry[];
}

const STORAGE_KEY = 'md-office-recent-docs';

/** Read the enriched recent-docs list from localStorage */
export function loadRecentDocs(): RecentDocEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RecentDocEntry[];
  } catch {
    return [];
  }
}

/** Persist the enriched recent-docs list */
export function saveRecentDocs(docs: RecentDocEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
}

/** Upsert a document into the recent list (max 20) */
export function touchRecentDoc(path: string, content: string) {
  const docs = loadRecentDocs();
  const title = path.replace(/\.md$/i, '').replace(/.*\//, '') || 'Untitled';
  const preview = content
    .replace(/^---[\s\S]*?---\s*/, '') // strip frontmatter
    .replace(/[#*_`>\-\[\]()!|]/g, '') // strip markdown
    .trim()
    .slice(0, 120);

  const existing = docs.find(d => d.path === path);
  const entry: RecentDocEntry = {
    path,
    title,
    lastModified: new Date().toISOString(),
    preview,
    starred: existing?.starred ?? false,
  };

  const filtered = docs.filter(d => d.path !== path);
  const updated = [entry, ...filtered].slice(0, 20);
  saveRecentDocs(updated);
  return updated;
}

/** Remove a doc from the recent list */
export function removeRecentDoc(path: string) {
  const docs = loadRecentDocs().filter(d => d.path !== path);
  saveRecentDocs(docs);
  return docs;
}

function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

const RecentDocs: React.FC<RecentDocsProps> = ({ onOpenDocument, onNewDocument, onNewFromTemplate, recentDocs }) => {
  const [query, setQuery] = useState('');
  const [showStarredOnly, setShowStarredOnly] = useState(false);

  const filtered = useMemo(() => {
    let list = recentDocs;
    if (showStarredOnly) list = list.filter(d => d.starred);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(d => d.title.toLowerCase().includes(q) || d.preview.toLowerCase().includes(q));
    }
    return list;
  }, [recentDocs, query, showStarredOnly]);

  const handleToggleStar = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    const docs = loadRecentDocs().map(d =>
      d.path === path ? { ...d, starred: !d.starred } : d
    );
    saveRecentDocs(docs);
    // Force re-render via parent — we dispatch a storage event
    window.dispatchEvent(new Event('recent-docs-updated'));
  };

  return (
    <div className="recent-docs">
      {/* Hero section */}
      <div className="recent-docs-hero">
        <div className="recent-docs-hero-inner">
          <h1 className="recent-docs-heading">
            <FileText size={32} strokeWidth={1.5} />
            MD Office
          </h1>
          <p className="recent-docs-subtitle">Start a new document or pick up where you left off</p>

          <div className="recent-docs-actions">
            <button className="recent-docs-action-btn primary" onClick={onNewDocument}>
              <Plus size={20} />
              <span>Blank document</span>
            </button>
            <button className="recent-docs-action-btn secondary" onClick={onNewFromTemplate}>
              <LayoutTemplate size={20} />
              <span>From template</span>
            </button>
          </div>
        </div>
      </div>

      {/* Recent documents list */}
      <div className="recent-docs-body">
        <div className="recent-docs-toolbar">
          <div className="recent-docs-toolbar-left">
            <Clock size={16} />
            <h2 className="recent-docs-section-title">Recent documents</h2>
          </div>
          <div className="recent-docs-toolbar-right">
            <div className="recent-docs-search">
              <Search size={16} className="recent-docs-search-icon" />
              <input
                type="text"
                placeholder="Search documents…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="recent-docs-search-input"
              />
            </div>
            <button
              className={`recent-docs-filter-btn ${showStarredOnly ? 'active' : ''}`}
              onClick={() => setShowStarredOnly(v => !v)}
              title="Show starred only"
            >
              <Star size={16} />
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="recent-docs-empty">
            {recentDocs.length === 0 ? (
              <>
                <div className="recent-docs-empty-icon">📄</div>
                <p>No recent documents yet</p>
                <p className="recent-docs-empty-hint">Create a new document to get started</p>
              </>
            ) : (
              <>
                <p>No documents match your search</p>
              </>
            )}
          </div>
        ) : (
          <div className="recent-docs-grid">
            {filtered.map(doc => (
              <button
                key={doc.path}
                className="recent-doc-card"
                onClick={() => onOpenDocument(doc.path)}
              >
                <div className="recent-doc-card-preview">
                  <span className="recent-doc-card-preview-text">{doc.preview || 'Empty document'}</span>
                </div>
                <div className="recent-doc-card-info">
                  <div className="recent-doc-card-title-row">
                    <FileText size={16} className="recent-doc-card-icon" />
                    <span className="recent-doc-card-title">{doc.title}</span>
                  </div>
                  <div className="recent-doc-card-meta">
                    <span className="recent-doc-card-date">{formatRelativeDate(doc.lastModified)}</span>
                    <button
                      className={`recent-doc-star-btn ${doc.starred ? 'starred' : ''}`}
                      onClick={e => handleToggleStar(e, doc.path)}
                      title={doc.starred ? 'Unstar' : 'Star'}
                    >
                      {doc.starred ? <Star size={14} fill="currentColor" /> : <StarOff size={14} />}
                    </button>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RecentDocs;
