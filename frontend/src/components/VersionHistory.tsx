import React, { useState, useMemo } from 'react';
import { GitCommit } from '../types';
import { X, RotateCcw, Clock, ChevronRight } from 'lucide-react';

interface VersionHistoryProps {
  commits: GitCommit[];
  onRevert: (commit: GitCommit) => void;
  onPreview: (commit: GitCommit) => void;
  onClose: () => void;
  selectedCommit: GitCommit | null;
  previewContent: string | null;
  currentContent: string;
  isLoading?: boolean;
}

/** Simple line-level diff */
interface DiffLine {
  type: 'added' | 'removed' | 'context';
  text: string;
  lineNum?: number;
}

function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const result: DiffLine[] = [];

  // Simple LCS-based diff
  const m = oldLines.length;
  const n = newLines.length;

  // For very large files, fall back to a simpler approach
  if (m * n > 1_000_000) {
    // Just show removed/added
    oldLines.forEach(l => result.push({ type: 'removed', text: l }));
    newLines.forEach(l => result.push({ type: 'added', text: l }));
    return result;
  }

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = oldLines[i - 1] === newLines[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // Backtrack
  const ops: DiffLine[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      ops.push({ type: 'context', text: oldLines[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.push({ type: 'added', text: newLines[j - 1] });
      j--;
    } else {
      ops.push({ type: 'removed', text: oldLines[i - 1] });
      i--;
    }
  }

  return ops.reverse();
}

function formatRelativeDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

function groupByDate(commits: GitCommit[]): { label: string; commits: GitCommit[] }[] {
  const groups: Map<string, GitCommit[]> = new Map();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  for (const c of commits) {
    const d = new Date(c.date);
    d.setHours(0, 0, 0, 0);
    let label: string;
    if (d.getTime() === today.getTime()) label = 'Today';
    else if (d.getTime() === yesterday.getTime()) label = 'Yesterday';
    else label = d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(c);
  }
  return Array.from(groups.entries()).map(([label, commits]) => ({ label, commits }));
}

const VersionHistory: React.FC<VersionHistoryProps> = ({
  commits,
  onRevert,
  onPreview,
  onClose,
  selectedCommit,
  previewContent,
  currentContent,
  isLoading,
}) => {
  const [showDiff, setShowDiff] = useState(true);
  const grouped = useMemo(() => groupByDate(commits), [commits]);

  const diffLines = useMemo(() => {
    if (!selectedCommit || previewContent === null) return null;
    return computeDiff(previewContent, currentContent);
  }, [selectedCommit, previewContent, currentContent]);

  const isAutoSave = (msg: string) => msg.startsWith('Update ') || msg === 'Auto-save';

  return (
    <div className="vh-sidebar">
      {/* Header */}
      <div className="vh-header">
        <h3>Version history</h3>
        <button className="vh-close-btn" onClick={onClose} title="Close">
          <X size={18} />
        </button>
      </div>

      {/* Diff area */}
      {selectedCommit && (
        <div className="vh-diff-section">
          <div className="vh-diff-header">
            <span className="vh-diff-title">
              {selectedCommit.message || 'Auto-save'}
            </span>
            <div className="vh-diff-actions">
              <button
                className={`vh-diff-toggle ${showDiff ? 'active' : ''}`}
                onClick={() => setShowDiff(!showDiff)}
              >
                {showDiff ? 'Hide diff' : 'Show diff'}
              </button>
              <button
                className="vh-restore-btn"
                onClick={() => {
                  if (confirm(`Restore this version?\n\n${selectedCommit.message}\n${new Date(selectedCommit.date).toLocaleString()}`)) {
                    onRevert(selectedCommit);
                  }
                }}
              >
                <RotateCcw size={14} />
                Restore this version
              </button>
            </div>
          </div>
          {showDiff && diffLines && (
            <div className="vh-diff-view">
              {diffLines.map((line, i) => (
                <div
                  key={i}
                  className={`vh-diff-line vh-diff-${line.type}`}
                >
                  <span className="vh-diff-prefix">
                    {line.type === 'added' ? '+' : line.type === 'removed' ? '−' : ' '}
                  </span>
                  <span className="vh-diff-text">{line.text || '\u00a0'}</span>
                </div>
              ))}
              {diffLines.length === 0 && (
                <div className="vh-diff-empty">No changes in this version</div>
              )}
            </div>
          )}
          {isLoading && (
            <div className="vh-diff-loading">Loading version...</div>
          )}
        </div>
      )}

      {/* Version list */}
      <div className="vh-list">
        {commits.length === 0 ? (
          <div className="vh-empty">
            <Clock size={32} />
            <p>No version history yet</p>
            <p className="vh-empty-sub">Versions are created each time you save</p>
          </div>
        ) : (
          grouped.map(group => (
            <div key={group.label} className="vh-group">
              <div className="vh-group-label">{group.label}</div>
              {group.commits.map(commit => {
                const isSelected = selectedCommit?.hash === commit.hash;
                const auto = isAutoSave(commit.message);
                return (
                  <button
                    key={commit.hash}
                    className={`vh-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => onPreview(commit)}
                  >
                    <div className="vh-item-left">
                      <ChevronRight size={14} className={`vh-chevron ${isSelected ? 'open' : ''}`} />
                      <div className="vh-item-info">
                        <span className={`vh-item-message ${auto ? 'auto' : 'named'}`}>
                          {commit.message || 'Auto-save'}
                        </span>
                        <span className="vh-item-meta">
                          {formatRelativeDate(commit.date)}
                          {commit.author && ` · ${commit.author}`}
                        </span>
                      </div>
                    </div>
                    <span className="vh-item-hash">{commit.hash.slice(0, 7)}</span>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default VersionHistory;
