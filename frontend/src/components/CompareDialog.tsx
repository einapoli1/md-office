import React, { useState, useMemo } from 'react';
import { X } from 'lucide-react';
import { GitCommit } from '../types';

interface CompareDialogProps {
  commits: GitCommit[];
  currentContent: string;
  onFetchVersion: (sha: string) => Promise<string>;
  onClose: () => void;
}

interface DiffLine {
  type: 'added' | 'removed' | 'context';
  text: string;
}

function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');

  const m = oldLines.length;
  const n = newLines.length;

  if (m * n > 1_000_000) {
    const result: DiffLine[] = [];
    oldLines.forEach(l => result.push({ type: 'removed', text: l }));
    newLines.forEach(l => result.push({ type: 'added', text: l }));
    return result;
  }

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = oldLines[i - 1] === newLines[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);

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

type CompareMode = 'history' | 'paste';
type ViewMode = 'unified' | 'side-by-side';

const CompareDialog: React.FC<CompareDialogProps> = ({ commits, currentContent, onFetchVersion, onClose }) => {
  const [mode, setMode] = useState<CompareMode>('paste');
  const [viewMode, setViewMode] = useState<ViewMode>('unified');
  const [leftSha, setLeftSha] = useState<string>(commits[1]?.sha || '');
  const [rightSha, setRightSha] = useState<string>(commits[0]?.sha || '');
  const [leftText, setLeftText] = useState('');
  const [rightText, setRightText] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCompareHistory = async () => {
    if (!leftSha || !rightSha) return;
    setLoading(true);
    try {
      const [l, r] = await Promise.all([onFetchVersion(leftSha), onFetchVersion(rightSha)]);
      setLeftText(l);
      setRightText(r);
    } finally {
      setLoading(false);
    }
  };

  const diffLines = useMemo(() => {
    if (mode === 'paste') {
      if (!pasteText) return [];
      return computeDiff(pasteText, currentContent);
    }
    if (!leftText && !rightText) return [];
    return computeDiff(leftText, rightText);
  }, [mode, leftText, rightText, pasteText, currentContent]);

  const sideBySide = useMemo(() => {
    const left: (DiffLine | null)[] = [];
    const right: (DiffLine | null)[] = [];
    let i = 0;
    while (i < diffLines.length) {
      const line = diffLines[i];
      if (line.type === 'context') {
        left.push(line); right.push(line); i++;
      } else if (line.type === 'removed') {
        // Collect consecutive removed then added
        const removedStart = i;
        while (i < diffLines.length && diffLines[i].type === 'removed') i++;
        const addedStart = i;
        while (i < diffLines.length && diffLines[i].type === 'added') i++;
        const removedCount = addedStart - removedStart;
        const addedCount = i - addedStart;
        const maxCount = Math.max(removedCount, addedCount);
        for (let k = 0; k < maxCount; k++) {
          left.push(k < removedCount ? diffLines[removedStart + k] : null);
          right.push(k < addedCount ? diffLines[addedStart + k] : null);
        }
      } else {
        left.push(null); right.push(line); i++;
      }
    }
    return { left, right };
  }, [diffLines]);

  const stats = useMemo(() => {
    let added = 0, removed = 0;
    diffLines.forEach(l => { if (l.type === 'added') added++; if (l.type === 'removed') removed++; });
    return { added, removed };
  }, [diffLines]);

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="compare-dialog" onClick={e => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>Compare Documents</h3>
          <button className="dialog-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="compare-controls">
          <div className="compare-mode-tabs">
            <button className={mode === 'paste' ? 'active' : ''} onClick={() => setMode('paste')}>Paste text</button>
            <button className={mode === 'history' ? 'active' : ''} onClick={() => setMode('history')}>Git history</button>
          </div>
          <div className="compare-view-tabs">
            <button className={viewMode === 'unified' ? 'active' : ''} onClick={() => setViewMode('unified')}>Unified</button>
            <button className={viewMode === 'side-by-side' ? 'active' : ''} onClick={() => setViewMode('side-by-side')}>Side by side</button>
          </div>
        </div>

        {mode === 'history' && (
          <div className="compare-history-selectors">
            <label>
              Left version
              <select value={leftSha} onChange={e => setLeftSha(e.target.value)}>
                <option value="">Select…</option>
                {commits.map(c => (
                  <option key={c.sha} value={c.sha}>{c.sha.slice(0, 7)} — {c.message}</option>
                ))}
              </select>
            </label>
            <label>
              Right version
              <select value={rightSha} onChange={e => setRightSha(e.target.value)}>
                <option value="">Select…</option>
                {commits.map(c => (
                  <option key={c.sha} value={c.sha}>{c.sha.slice(0, 7)} — {c.message}</option>
                ))}
              </select>
            </label>
            <button className="compare-run-btn" onClick={handleCompareHistory} disabled={!leftSha || !rightSha || loading}>
              {loading ? 'Loading…' : 'Compare'}
            </button>
          </div>
        )}

        {mode === 'paste' && (
          <div className="compare-paste-area">
            <textarea
              placeholder="Paste text to compare against the current document…"
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              rows={6}
            />
          </div>
        )}

        {diffLines.length > 0 && (
          <div className="compare-stats">
            <span className="compare-stat-added">+{stats.added} added</span>
            <span className="compare-stat-removed">−{stats.removed} removed</span>
          </div>
        )}

        <div className="compare-diff-container">
          {diffLines.length === 0 && (
            <div className="compare-empty">
              {mode === 'paste' ? 'Paste text above to see differences' : 'Select two versions and click Compare'}
            </div>
          )}

          {diffLines.length > 0 && viewMode === 'unified' && (
            <div className="compare-diff-unified">
              {diffLines.map((line, idx) => (
                <div key={idx} className={`diff-line diff-line--${line.type}`}>
                  <span className="diff-marker">{line.type === 'added' ? '+' : line.type === 'removed' ? '−' : ' '}</span>
                  <span className="diff-text">{line.text || '\u00A0'}</span>
                </div>
              ))}
            </div>
          )}

          {diffLines.length > 0 && viewMode === 'side-by-side' && (
            <div className="compare-diff-side-by-side">
              <div className="diff-side diff-side--left">
                {sideBySide.left.map((line, idx) => (
                  <div key={idx} className={`diff-line ${line ? `diff-line--${line.type}` : 'diff-line--empty'}`}>
                    <span className="diff-text">{line?.text || '\u00A0'}</span>
                  </div>
                ))}
              </div>
              <div className="diff-side diff-side--right">
                {sideBySide.right.map((line, idx) => (
                  <div key={idx} className={`diff-line ${line ? `diff-line--${line.type}` : 'diff-line--empty'}`}>
                    <span className="diff-text">{line?.text || '\u00A0'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CompareDialog;
