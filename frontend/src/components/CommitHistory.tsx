import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GitCommit } from '../types';
import { gitAPI } from '../utils/api';
import {
  X, Search, RotateCcw, Star, Clock, ChevronRight,
  Filter, AlertTriangle, Check, User, Hash
} from 'lucide-react';

interface CommitHistoryProps {
  onClose: () => void;
  onPreviewCommit?: (commit: GitCommit) => void;
  onRestoreCommit?: (commit: GitCommit) => void;
  activeFilePath?: string | null;
}

const CommitHistory: React.FC<CommitHistoryProps> = ({
  onClose, onPreviewCommit, onRestoreCommit, activeFilePath,
}) => {
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterByFile, setFilterByFile] = useState(false);
  const [selectedCommit, setSelectedCommit] = useState<GitCommit | null>(null);
  const [starredHashes, setStarredHashes] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('md-office-starred-commits');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadCommits = useCallback(async () => {
    setLoading(true);
    try {
      const path = filterByFile && activeFilePath ? activeFilePath : undefined;
      const history = await gitAPI.getHistory(path);
      setCommits(history.commits || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history');
    } finally { setLoading(false); }
  }, [filterByFile, activeFilePath]);

  useEffect(() => { loadCommits(); }, [loadCommits]);

  const toggleStar = (hash: string) => {
    setStarredHashes(prev => {
      const next = new Set(prev);
      if (next.has(hash)) next.delete(hash); else next.add(hash);
      localStorage.setItem('md-office-starred-commits', JSON.stringify([...next]));
      return next;
    });
  };

  const handleRestore = async (commit: GitCommit) => {
    setConfirmRestore(null);
    try {
      onRestoreCommit?.(commit);
    } catch {
      setError('Failed to restore');
    }
  };

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return commits;
    const q = searchQuery.toLowerCase();
    return commits.filter(c =>
      c.message.toLowerCase().includes(q) ||
      c.author.toLowerCase().includes(q) ||
      c.hash.toLowerCase().startsWith(q)
    );
  }, [commits, searchQuery]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
  };

  const formatFullDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  };

  return (
    <div className="ch-overlay" onClick={onClose}>
      <div className="ch-panel" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="ch-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={18} />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Commit History</h3>
            <span className="ch-count">{filtered.length} commits</span>
          </div>
          <button className="ch-close" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Search & filters */}
        <div className="ch-toolbar">
          <div className="ch-search">
            <Search size={14} />
            <input
              placeholder="Search commits..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          {activeFilePath && (
            <button
              className={`ch-filter-btn ${filterByFile ? 'active' : ''}`}
              onClick={() => setFilterByFile(!filterByFile)}
              title={`Filter by: ${activeFilePath}`}
            >
              <Filter size={12} />
              Current file
            </button>
          )}
        </div>

        {error && (
          <div className="ch-error">
            <AlertTriangle size={14} /> {error}
            <button onClick={() => setError('')}><X size={12} /></button>
          </div>
        )}

        {/* Commit list */}
        <div className="ch-list">
          {loading && <div className="ch-loading">Loading history...</div>}
          {!loading && filtered.length === 0 && (
            <div className="ch-empty">No commits found</div>
          )}
          {filtered.map((commit, i) => {
            const isSelected = selectedCommit?.hash === commit.hash;
            const isStarred = starredHashes.has(commit.hash);
            return (
              <div key={commit.hash} className={`ch-commit ${isSelected ? 'ch-commit-selected' : ''}`}>
                {/* Timeline dot */}
                <div className="ch-timeline">
                  <div className={`ch-dot ${i === 0 ? 'ch-dot-head' : ''}`} />
                  {i < filtered.length - 1 && <div className="ch-line" />}
                </div>

                <div className="ch-commit-body">
                  <div className="ch-commit-main">
                    <div className="ch-commit-msg" onClick={() => { setSelectedCommit(isSelected ? null : commit); onPreviewCommit?.(commit); }}>
                      {commit.message}
                    </div>
                    <button
                      className={`ch-star ${isStarred ? 'ch-starred' : ''}`}
                      onClick={() => toggleStar(commit.hash)}
                      title={isStarred ? 'Unstar' : 'Star this commit'}
                    >
                      <Star size={14} fill={isStarred ? '#fbbc04' : 'none'} />
                    </button>
                  </div>

                  <div className="ch-commit-meta">
                    <span className="ch-meta-item" title={commit.author}>
                      <User size={11} /> {commit.author.split('<')[0].trim() || 'Unknown'}
                    </span>
                    <span className="ch-meta-item" title={formatFullDate(commit.date)}>
                      <Clock size={11} /> {formatDate(commit.date)}
                    </span>
                    <span className="ch-meta-item ch-hash" title={commit.hash}>
                      <Hash size={11} /> {commit.hash.slice(0, 7)}
                    </span>
                  </div>

                  {isSelected && (
                    <div className="ch-commit-actions">
                      <button className="ch-action-btn" onClick={() => onPreviewCommit?.(commit)}>
                        <ChevronRight size={12} /> View changes
                      </button>
                      {confirmRestore === commit.hash ? (
                        <div className="ch-confirm-restore">
                          <span style={{ fontSize: 11, color: '#e37400' }}>Restore to this version?</span>
                          <button className="ch-action-btn ch-action-warn" onClick={() => handleRestore(commit)}>
                            <Check size={12} /> Confirm
                          </button>
                          <button className="ch-action-btn" onClick={() => setConfirmRestore(null)}>Cancel</button>
                        </div>
                      ) : (
                        <button className="ch-action-btn" onClick={() => setConfirmRestore(commit.hash)}>
                          <RotateCcw size={12} /> Restore
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <style>{`
          .ch-overlay {
            position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 1000;
            display: flex; align-items: flex-start; justify-content: center; padding-top: 50px;
          }
          .ch-panel {
            background: #fff; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.18);
            width: 520px; max-height: 80vh; display: flex; flex-direction: column;
            font-family: 'Google Sans', -apple-system, sans-serif;
          }
          .ch-header {
            display: flex; justify-content: space-between; align-items: center;
            padding: 16px 20px; border-bottom: 1px solid #e8eaed;
          }
          .ch-count { font-size: 12px; color: #5f6368; background: #f1f3f4; padding: 2px 8px; border-radius: 10px; }
          .ch-close {
            border: none; background: transparent; cursor: pointer; color: #5f6368;
            display: flex; padding: 4px; border-radius: 6px;
          }
          .ch-close:hover { background: #f1f3f4; }
          .ch-toolbar {
            display: flex; gap: 8px; padding: 12px 20px; border-bottom: 1px solid #e8eaed; align-items: center;
          }
          .ch-search {
            flex: 1; display: flex; align-items: center; gap: 8; padding: 6px 12px;
            border: 1px solid #dadce0; border-radius: 8px; background: #f8f9fa;
          }
          .ch-search input {
            border: none; background: transparent; outline: none; flex: 1; font-size: 13px;
          }
          .ch-filter-btn {
            display: flex; align-items: center; gap: 4; padding: 6px 10px;
            border: 1px solid #dadce0; border-radius: 6px; background: #fff;
            font-size: 12px; cursor: pointer; color: #5f6368; white-space: nowrap;
          }
          .ch-filter-btn.active { background: #e8f0fe; color: #1a73e8; border-color: #1a73e8; }
          .ch-error {
            display: flex; align-items: center; gap: 8; padding: 8px 20px;
            background: #fce8e6; color: #d93025; font-size: 13px;
          }
          .ch-error button { border: none; background: none; cursor: pointer; margin-left: auto; }
          .ch-list { overflow-y: auto; flex: 1; padding: 8px 0; }
          .ch-loading, .ch-empty { padding: 30px; text-align: center; color: #5f6368; font-size: 13px; }
          .ch-commit { display: flex; gap: 0; padding: 0 20px; }
          .ch-commit:hover { background: #f8f9fa; }
          .ch-commit-selected { background: #e8f0fe; }
          .ch-timeline {
            display: flex; flex-direction: column; align-items: center; width: 20px; flex-shrink: 0; padding-top: 14px;
          }
          .ch-dot { width: 8px; height: 8px; border-radius: 50%; background: #dadce0; flex-shrink: 0; }
          .ch-dot-head { background: #1a73e8; width: 10px; height: 10px; }
          .ch-line { width: 2px; flex: 1; background: #e8eaed; min-height: 16px; }
          .ch-commit-body { flex: 1; padding: 10px 0 10px 12px; min-width: 0; }
          .ch-commit-main { display: flex; align-items: flex-start; gap: 8; }
          .ch-commit-msg {
            flex: 1; font-size: 13px; font-weight: 500; color: #202124; cursor: pointer;
            line-height: 1.4; word-break: break-word;
          }
          .ch-commit-msg:hover { color: #1a73e8; }
          .ch-star { border: none; background: none; cursor: pointer; color: #dadce0; padding: 2px; flex-shrink: 0; }
          .ch-starred { color: #fbbc04; }
          .ch-commit-meta { display: flex; gap: 12px; margin-top: 4px; flex-wrap: wrap; }
          .ch-meta-item {
            display: flex; align-items: center; gap: 3; font-size: 11px; color: #5f6368;
          }
          .ch-hash { font-family: 'SF Mono', Monaco, monospace; }
          .ch-commit-actions { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; align-items: center; }
          .ch-action-btn {
            display: inline-flex; align-items: center; gap: 4; padding: 4px 10px;
            border: 1px solid #dadce0; border-radius: 6px; background: #fff;
            font-size: 12px; cursor: pointer; color: #3c4043;
          }
          .ch-action-btn:hover { background: #f1f3f4; }
          .ch-action-warn { background: #e37400; color: #fff; border-color: #e37400; }
          .ch-confirm-restore { display: flex; align-items: center; gap: 6; }
        `}</style>
      </div>
    </div>
  );
};

export default CommitHistory;
