import React, { useState, useMemo, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Upload, GitBranch, ArrowLeftRight } from 'lucide-react';
import { GitCommit } from '../types';

interface DiffLine {
  type: 'added' | 'removed' | 'context' | 'modified';
  oldText?: string;
  newText?: string;
  text: string;
  lineNumOld?: number;
  lineNumNew?: number;
}

interface DiffStats {
  wordsAdded: number;
  wordsDeleted: number;
  wordsModified: number;
  similarityPercent: number;
}

interface DocumentCompareProps {
  commits: GitCommit[];
  currentContent: string;
  onFetchVersion: (sha: string) => Promise<string>;
  onApplyMerged?: (content: string) => void;
  onClose: () => void;
}

type ViewMode = 'side-by-side' | 'inline' | 'combined';
type SourceMode = 'upload' | 'history';

function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const m = oldLines.length;
  const n = newLines.length;

  if (m * n > 1_000_000) {
    const result: DiffLine[] = [];
    let ln = 1;
    oldLines.forEach(l => result.push({ type: 'removed', text: l, lineNumOld: ln++ }));
    ln = 1;
    newLines.forEach(l => result.push({ type: 'added', text: l, lineNumNew: ln++ }));
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
      ops.push({ type: 'context', text: oldLines[i - 1], lineNumOld: i, lineNumNew: j });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.push({ type: 'added', text: newLines[j - 1], lineNumNew: j });
      j--;
    } else {
      ops.push({ type: 'removed', text: oldLines[i - 1], lineNumOld: i });
      i--;
    }
  }
  return ops.reverse();
}

function computeStats(diff: DiffLine[]): DiffStats {
  let wordsAdded = 0, wordsDeleted = 0, wordsModified = 0;
  let totalOld = 0, totalNew = 0, commonWords = 0;

  diff.forEach(d => {
    const wc = d.text.split(/\s+/).filter(Boolean).length;
    if (d.type === 'added') { wordsAdded += wc; totalNew += wc; }
    else if (d.type === 'removed') { wordsDeleted += wc; totalOld += wc; }
    else { totalOld += wc; totalNew += wc; commonWords += wc; }
  });

  // Check for adjacent remove+add pairs as modifications
  for (let i = 0; i < diff.length - 1; i++) {
    if (diff[i].type === 'removed' && diff[i + 1].type === 'added') {
      const rmWc = diff[i].text.split(/\s+/).filter(Boolean).length;
      const min = Math.min(rmWc, diff[i + 1].text.split(/\s+/).filter(Boolean).length);
      wordsModified += min;
    }
  }

  const total = Math.max(totalOld + totalNew, 1);
  const similarityPercent = Math.round((commonWords * 2 / total) * 100);

  return { wordsAdded, wordsDeleted, wordsModified, similarityPercent };
}

const DocumentCompare: React.FC<DocumentCompareProps> = ({
  commits, currentContent, onFetchVersion, onApplyMerged, onClose,
}) => {
  const [sourceMode, setSourceMode] = useState<SourceMode>('upload');
  const [viewMode, setViewMode] = useState<ViewMode>('side-by-side');
  const [leftText, setLeftText] = useState('');
  const [rightText, setRightText] = useState('');
  const [leftLabel, setLeftLabel] = useState('Document A');
  const [rightLabel, setRightLabel] = useState('Document B');
  const [leftHash, setLeftHash] = useState(commits[1]?.hash || '');
  const [rightHash, setRightHash] = useState(commits[0]?.hash || '');
  const [loading, setLoading] = useState(false);
  const [changeIndex, setChangeIndex] = useState(0);
  const [acceptedChanges, setAcceptedChanges] = useState<Set<number>>(new Set());

  const diff = useMemo(() => computeDiff(leftText, rightText), [leftText, rightText]);
  const stats = useMemo(() => computeStats(diff), [diff]);
  const changeIndices = useMemo(() => diff.reduce<number[]>((acc, d, i) => { if (d.type !== 'context') acc.push(i); return acc; }, []), [diff]);

  const handleFileUpload = useCallback((side: 'left' | 'right') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.md,.html,.rtf';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        if (side === 'left') { setLeftText(text); setLeftLabel(file.name); }
        else { setRightText(text); setRightLabel(file.name); }
      };
      reader.readAsText(file);
    };
    input.click();
  }, []);

  const handleCompareHistory = async () => {
    if (!leftHash || !rightHash) return;
    setLoading(true);
    try {
      const [l, r] = await Promise.all([onFetchVersion(leftHash), onFetchVersion(rightHash)]);
      setLeftText(l);
      setRightText(r);
      const lc = commits.find(c => c.hash === leftHash);
      const rc = commits.find(c => c.hash === rightHash);
      setLeftLabel(lc ? `${lc.hash.slice(0, 7)} - ${lc.message}` : leftHash.slice(0, 7));
      setRightLabel(rc ? `${rc.hash.slice(0, 7)} - ${rc.message}` : rightHash.slice(0, 7));
    } finally {
      setLoading(false);
    }
  };

  const handleComparePrevious = async () => {
    if (commits.length < 1) return;
    setLoading(true);
    try {
      const prev = await onFetchVersion(commits[0].hash);
      setLeftText(prev);
      setRightText(currentContent);
      setLeftLabel(`Previous: ${commits[0].hash.slice(0, 7)}`);
      setRightLabel('Current');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptChange = (idx: number) => {
    setAcceptedChanges(prev => { const next = new Set(prev); next.add(idx); return next; });
  };

  const buildMerged = () => {
    const lines: string[] = [];
    diff.forEach((d, i) => {
      if (d.type === 'context') lines.push(d.text);
      else if (d.type === 'added') {
        if (acceptedChanges.has(i)) lines.push(d.text);
      } else if (d.type === 'removed') {
        if (!acceptedChanges.has(i)) lines.push(d.text);
      }
    });
    return lines.join('\n');
  };

  const handleApplyMerged = () => {
    if (onApplyMerged) onApplyMerged(buildMerged());
  };

  const prevChange = () => setChangeIndex(i => Math.max(0, i - 1));
  const nextChange = () => setChangeIndex(i => Math.min(changeIndices.length - 1, i + 1));

  const lineStyle = (type: string): React.CSSProperties => ({
    padding: '1px 8px', fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
    background: type === 'added' ? '#e6f4ea' : type === 'removed' ? '#fce8e6' : type === 'modified' ? '#e8f0fe' : 'transparent',
    color: type === 'added' ? '#137333' : type === 'removed' ? '#c5221f' : type === 'modified' ? '#1a73e8' : 'inherit',
    textDecoration: type === 'removed' ? 'line-through' : 'none',
  });

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--bg-primary, #fff)', borderRadius: 8, width: '90vw', maxWidth: 1200,
        height: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid #e0e0e0' }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>
            <ArrowLeftRight size={16} style={{ verticalAlign: -2, marginRight: 8 }} />
            Document Compare
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        {/* Controls */}
        <div style={{ padding: '8px 20px', borderBottom: '1px solid #e0e0e0', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setSourceMode('upload')}
              style={{ fontSize: 12, padding: '4px 10px', borderRadius: 4, border: '1px solid #ccc', background: sourceMode === 'upload' ? '#1a73e8' : '#fff', color: sourceMode === 'upload' ? '#fff' : '#333', cursor: 'pointer' }}>
              <Upload size={12} /> Upload
            </button>
            <button onClick={() => setSourceMode('history')}
              style={{ fontSize: 12, padding: '4px 10px', borderRadius: 4, border: '1px solid #ccc', background: sourceMode === 'history' ? '#1a73e8' : '#fff', color: sourceMode === 'history' ? '#fff' : '#333', cursor: 'pointer' }}>
              <GitBranch size={12} /> History
            </button>
          </div>

          {sourceMode === 'upload' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => handleFileUpload('left')} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 4, border: '1px solid #ccc', cursor: 'pointer' }}>
                Upload Left
              </button>
              <button onClick={() => handleFileUpload('right')} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 4, border: '1px solid #ccc', cursor: 'pointer' }}>
                Upload Right
              </button>
            </div>
          )}

          {sourceMode === 'history' && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select value={leftHash} onChange={e => setLeftHash(e.target.value)} style={{ fontSize: 12, padding: '4px 6px', borderRadius: 4, border: '1px solid #ccc' }}>
                {commits.map(c => <option key={c.hash} value={c.hash}>{c.hash.slice(0, 7)} - {c.message}</option>)}
              </select>
              <span style={{ fontSize: 12 }}>vs</span>
              <select value={rightHash} onChange={e => setRightHash(e.target.value)} style={{ fontSize: 12, padding: '4px 6px', borderRadius: 4, border: '1px solid #ccc' }}>
                {commits.map(c => <option key={c.hash} value={c.hash}>{c.hash.slice(0, 7)} - {c.message}</option>)}
              </select>
              <button onClick={handleCompareHistory} disabled={loading} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 4, border: '1px solid #1a73e8', background: '#1a73e8', color: '#fff', cursor: 'pointer' }}>
                {loading ? 'Loading...' : 'Compare'}
              </button>
              <button onClick={handleComparePrevious} disabled={loading || commits.length < 1} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 4, border: '1px solid #ccc', cursor: 'pointer' }}>
                Compare with previous
              </button>
            </div>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            {(['side-by-side', 'inline', 'combined'] as ViewMode[]).map(vm => (
              <button key={vm} onClick={() => setViewMode(vm)}
                style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, border: '1px solid #ccc', background: viewMode === vm ? '#e8f0fe' : '#fff', cursor: 'pointer' }}>
                {vm === 'side-by-side' ? 'Side by Side' : vm === 'inline' ? 'Inline' : 'Combined'}
              </button>
            ))}
          </div>
        </div>

        {/* Stats bar */}
        {(leftText || rightText) && (
          <div style={{ padding: '6px 20px', borderBottom: '1px solid #e0e0e0', display: 'flex', gap: 16, fontSize: 12, color: '#555' }}>
            <span style={{ color: '#137333' }}>+{stats.wordsAdded} added</span>
            <span style={{ color: '#c5221f' }}>−{stats.wordsDeleted} deleted</span>
            <span style={{ color: '#1a73e8' }}>~{stats.wordsModified} modified</span>
            <span>{stats.similarityPercent}% similar</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={prevChange} disabled={changeIndex <= 0} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: changeIndex <= 0 ? 0.3 : 1 }}>
                <ChevronLeft size={14} />
              </button>
              <span>{changeIndices.length > 0 ? `${changeIndex + 1}/${changeIndices.length}` : '0/0'}</span>
              <button onClick={nextChange} disabled={changeIndex >= changeIndices.length - 1} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: changeIndex >= changeIndices.length - 1 ? 0.3 : 1 }}>
                <ChevronRight size={14} />
              </button>
              {onApplyMerged && acceptedChanges.size > 0 && (
                <button onClick={handleApplyMerged} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, border: '1px solid #34a853', background: '#e6f4ea', color: '#34a853', cursor: 'pointer' }}>
                  Apply Merged ({acceptedChanges.size} changes)
                </button>
              )}
            </div>
          </div>
        )}

        {/* Diff view */}
        <div style={{ flex: 1, overflow: 'auto', padding: 0 }}>
          {!leftText && !rightText ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
              Select two documents to compare
            </div>
          ) : viewMode === 'side-by-side' ? (
            <div style={{ display: 'flex', height: '100%' }}>
              <div style={{ flex: 1, borderRight: '1px solid #e0e0e0', overflow: 'auto' }}>
                <div style={{ padding: '4px 8px', background: '#f5f5f5', fontSize: 11, fontWeight: 600, borderBottom: '1px solid #e0e0e0', position: 'sticky', top: 0 }}>
                  {leftLabel}
                </div>
                {diff.map((d, i) => (
                  d.type !== 'added' && (
                    <div key={i} style={{ ...lineStyle(d.type), display: 'flex' }}>
                      <span style={{ width: 40, color: '#999', fontSize: 11, flexShrink: 0 }}>{d.lineNumOld || ''}</span>
                      <span>{d.text}</span>
                    </div>
                  )
                ))}
              </div>
              <div style={{ flex: 1, overflow: 'auto' }}>
                <div style={{ padding: '4px 8px', background: '#f5f5f5', fontSize: 11, fontWeight: 600, borderBottom: '1px solid #e0e0e0', position: 'sticky', top: 0 }}>
                  {rightLabel}
                </div>
                {diff.map((d, i) => (
                  d.type !== 'removed' && (
                    <div key={i} style={{ ...lineStyle(d.type), display: 'flex', alignItems: 'center' }}>
                      <span style={{ width: 40, color: '#999', fontSize: 11, flexShrink: 0 }}>{d.lineNumNew || ''}</span>
                      <span style={{ flex: 1 }}>{d.text}</span>
                      {d.type === 'added' && !acceptedChanges.has(i) && (
                        <button onClick={() => handleAcceptChange(i)} style={{ fontSize: 10, padding: '0 4px', borderRadius: 2, border: '1px solid #34a853', background: '#e6f4ea', color: '#34a853', cursor: 'pointer', marginLeft: 4 }}>
                          Accept
                        </button>
                      )}
                    </div>
                  )
                ))}
              </div>
            </div>
          ) : viewMode === 'inline' ? (
            <div>
              {diff.map((d, i) => (
                <div key={i} style={{ ...lineStyle(d.type), display: 'flex', alignItems: 'center' }}>
                  <span style={{ width: 35, color: '#999', fontSize: 11, flexShrink: 0, textAlign: 'right', paddingRight: 4 }}>{d.lineNumOld || ''}</span>
                  <span style={{ width: 35, color: '#999', fontSize: 11, flexShrink: 0, textAlign: 'right', paddingRight: 8 }}>{d.lineNumNew || ''}</span>
                  <span style={{ width: 14, fontSize: 11, color: d.type === 'added' ? '#137333' : d.type === 'removed' ? '#c5221f' : '#999' }}>
                    {d.type === 'added' ? '+' : d.type === 'removed' ? '-' : ' '}
                  </span>
                  <span style={{ flex: 1 }}>{d.text}</span>
                  {d.type !== 'context' && !acceptedChanges.has(i) && (
                    <button onClick={() => handleAcceptChange(i)} style={{ fontSize: 10, padding: '0 4px', borderRadius: 2, border: '1px solid #34a853', background: '#e6f4ea', color: '#34a853', cursor: 'pointer', marginLeft: 4 }}>
                      Accept
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            /* combined/merge view */
            <div>
              <div style={{ padding: '4px 8px', background: '#f5f5f5', fontSize: 11, fontWeight: 600, borderBottom: '1px solid #e0e0e0', position: 'sticky', top: 0 }}>
                Merged View
              </div>
              {diff.map((d, i) => (
                <div key={i} style={{ ...lineStyle(d.type), display: 'flex', alignItems: 'center' }}>
                  <span style={{ width: 14, fontSize: 11, color: d.type === 'added' ? '#137333' : d.type === 'removed' ? '#c5221f' : '#999' }}>
                    {d.type === 'added' ? '+' : d.type === 'removed' ? '-' : ' '}
                  </span>
                  <span style={{ flex: 1 }}>{d.text}</span>
                  {d.type !== 'context' && !acceptedChanges.has(i) && (
                    <button onClick={() => handleAcceptChange(i)} style={{ fontSize: 10, padding: '0 4px', borderRadius: 2, border: '1px solid #34a853', background: '#e6f4ea', color: '#34a853', cursor: 'pointer', marginLeft: 4 }}>
                      Accept
                    </button>
                  )}
                  {acceptedChanges.has(i) && (
                    <span style={{ fontSize: 10, color: '#34a853', marginLeft: 4 }}>✓</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentCompare;
