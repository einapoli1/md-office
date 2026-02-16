import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Columns, AlignLeft, Check, XCircle, FileText } from 'lucide-react';

interface DiffViewerProps {
  oldText: string;
  newText: string;
  oldLabel?: string;
  newLabel?: string;
  changedFiles?: { file: string; type: string; additions: number; deletions: number }[];
  onSelectFile?: (file: string) => void;
  onAcceptHunk?: (hunkIndex: number) => void;
  onRejectHunk?: (hunkIndex: number) => void;
  onClose: () => void;
}

interface DiffLine {
  type: 'added' | 'removed' | 'context';
  oldNum?: number;
  newNum?: number;
  text: string;
  charDiffs?: { start: number; end: number }[];
}

interface Hunk {
  startIndex: number;
  endIndex: number;
  lines: DiffLine[];
}

function computeCharDiff(oldStr: string, newStr: string): { oldDiffs: { start: number; end: number }[]; newDiffs: { start: number; end: number }[] } {
  const oldDiffs: { start: number; end: number }[] = [];
  const newDiffs: { start: number; end: number }[] = [];

  // Find common prefix
  let prefix = 0;
  while (prefix < oldStr.length && prefix < newStr.length && oldStr[prefix] === newStr[prefix]) prefix++;

  // Find common suffix
  let oldSuffix = oldStr.length;
  let newSuffix = newStr.length;
  while (oldSuffix > prefix && newSuffix > prefix && oldStr[oldSuffix - 1] === newStr[newSuffix - 1]) {
    oldSuffix--;
    newSuffix--;
  }

  if (prefix < oldSuffix) oldDiffs.push({ start: prefix, end: oldSuffix });
  if (prefix < newSuffix) newDiffs.push({ start: prefix, end: newSuffix });

  return { oldDiffs, newDiffs };
}

function computeDiffLines(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const result: DiffLine[] = [];
  const m = oldLines.length, n = newLines.length;

  if (m * n > 2_000_000) {
    let oNum = 0, nNum = 0;
    oldLines.forEach(l => result.push({ type: 'removed', oldNum: ++oNum, text: l }));
    newLines.forEach(l => result.push({ type: 'added', newNum: ++nNum, text: l }));
    return result;
  }

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = oldLines[i - 1] === newLines[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);

  const ops: DiffLine[] = [];
  let i = m, j = n, oLine = m, nLine = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      ops.push({ type: 'context', oldNum: oLine--, newNum: nLine--, text: oldLines[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.push({ type: 'added', newNum: nLine--, text: newLines[j - 1] });
      j--;
    } else {
      ops.push({ type: 'removed', oldNum: oLine--, text: oldLines[i - 1] });
      i--;
    }
  }
  const lines = ops.reverse();

  // Add char-level diffs for adjacent removed/added pairs
  for (let k = 0; k < lines.length - 1; k++) {
    if (lines[k].type === 'removed' && lines[k + 1].type === 'added') {
      const { oldDiffs, newDiffs } = computeCharDiff(lines[k].text, lines[k + 1].text);
      lines[k].charDiffs = oldDiffs;
      lines[k + 1].charDiffs = newDiffs;
    }
  }

  return lines;
}

function getHunks(lines: DiffLine[]): Hunk[] {
  const hunks: Hunk[] = [];
  let inHunk = false;
  let start = 0;
  const CONTEXT = 2;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].type !== 'context') {
      if (!inHunk) { start = Math.max(0, i - CONTEXT); inHunk = true; }
    } else if (inHunk) {
      let contextAhead = 0;
      for (let j = i; j < lines.length && lines[j].type === 'context'; j++) contextAhead++;
      if (contextAhead > CONTEXT * 2) {
        hunks.push({ startIndex: start, endIndex: i + CONTEXT, lines: lines.slice(start, i + CONTEXT) });
        inHunk = false;
      }
    }
  }
  if (inHunk) hunks.push({ startIndex: start, endIndex: lines.length, lines: lines.slice(start) });
  return hunks;
}

function renderText(text: string, diffs?: { start: number; end: number }[], highlightClass?: string) {
  if (!diffs || diffs.length === 0) return <>{text || ' '}</>;
  const parts: React.ReactNode[] = [];
  let last = 0;
  diffs.forEach((d, i) => {
    if (d.start > last) parts.push(<span key={`t${i}`}>{text.slice(last, d.start)}</span>);
    parts.push(<span key={`h${i}`} className={highlightClass}>{text.slice(d.start, d.end)}</span>);
    last = d.end;
  });
  if (last < text.length) parts.push(<span key="end">{text.slice(last)}</span>);
  return <>{parts}</>;
}

const DiffViewer: React.FC<DiffViewerProps> = ({
  oldText, newText, oldLabel = 'Before', newLabel = 'After',
  changedFiles, onSelectFile, onAcceptHunk, onRejectHunk, onClose,
}) => {
  const [viewMode, setViewMode] = useState<'side' | 'inline'>('side');
  const [currentHunk, setCurrentHunk] = useState(0);
  const hunkRefs = useRef<(HTMLDivElement | null)[]>([]);

  const diffLines = useMemo(() => computeDiffLines(oldText, newText), [oldText, newText]);
  const hunks = useMemo(() => getHunks(diffLines), [diffLines]);

  const stats = useMemo(() => {
    const added = diffLines.filter(l => l.type === 'added').length;
    const removed = diffLines.filter(l => l.type === 'removed').length;
    return { added, removed };
  }, [diffLines]);

  useEffect(() => {
    hunkRefs.current[currentHunk]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentHunk]);

  const navigateHunk = useCallback((dir: 1 | -1) => {
    setCurrentHunk(prev => Math.max(0, Math.min(hunks.length - 1, prev + dir)));
  }, [hunks.length]);

  return (
    <div className="diff-viewer-overlay" onClick={onClose}>
      <div className="diff-viewer-panel" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="dv-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Compare changes</h3>
            <span className="dv-stat dv-stat-add">+{stats.added}</span>
            <span className="dv-stat dv-stat-del">-{stats.removed}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="dv-toggle">
              <button className={viewMode === 'side' ? 'active' : ''} onClick={() => setViewMode('side')} title="Side by side">
                <Columns size={14} />
              </button>
              <button className={viewMode === 'inline' ? 'active' : ''} onClick={() => setViewMode('inline')} title="Inline">
                <AlignLeft size={14} />
              </button>
            </div>
            {hunks.length > 0 && (
              <div className="dv-nav">
                <button onClick={() => navigateHunk(-1)} disabled={currentHunk === 0}><ChevronLeft size={14} /></button>
                <span style={{ fontSize: 12 }}>{currentHunk + 1}/{hunks.length}</span>
                <button onClick={() => navigateHunk(1)} disabled={currentHunk >= hunks.length - 1}><ChevronRight size={14} /></button>
              </div>
            )}
            <button className="dv-close" onClick={onClose}><X size={18} /></button>
          </div>
        </div>

        <div className="dv-body">
          {/* File list sidebar */}
          {changedFiles && changedFiles.length > 0 && (
            <div className="dv-files">
              <div className="dv-files-title">Changed files</div>
              {changedFiles.map(f => (
                <button key={f.file} className="dv-file-item" onClick={() => onSelectFile?.(f.file)}>
                  <FileText size={12} />
                  <span className="dv-file-name">{f.file}</span>
                  <span className={`dv-file-type dv-ft-${f.type}`}>{f.type[0].toUpperCase()}</span>
                </button>
              ))}
            </div>
          )}

          {/* Diff content */}
          <div className="dv-content">
            {viewMode === 'side' ? (
              <div className="dv-side-by-side">
                <div className="dv-side-header">
                  <span>{oldLabel}</span>
                  <span>{newLabel}</span>
                </div>
                {hunks.map((hunk, hi) => (
                  <div key={hi} ref={el => { hunkRefs.current[hi] = el; }}
                    className={`dv-hunk ${hi === currentHunk ? 'dv-hunk-active' : ''}`}>
                    {(onAcceptHunk || onRejectHunk) && (
                      <div className="dv-hunk-actions">
                        {onAcceptHunk && <button className="dv-hunk-btn dv-accept" onClick={() => onAcceptHunk(hi)} title="Accept"><Check size={12} /></button>}
                        {onRejectHunk && <button className="dv-hunk-btn dv-reject" onClick={() => onRejectHunk(hi)} title="Reject"><XCircle size={12} /></button>}
                      </div>
                    )}
                    <table className="dv-table"><tbody>
                      {hunk.lines.map((line, li) => (
                        <tr key={li} className={`dv-line dv-line-${line.type}`}>
                          <td className="dv-linenum">{line.oldNum ?? ''}</td>
                          <td className="dv-code dv-code-old">
                            {line.type === 'added' ? '' : renderText(line.text, line.charDiffs, 'dv-char-del')}
                          </td>
                          <td className="dv-linenum">{line.newNum ?? ''}</td>
                          <td className="dv-code dv-code-new">
                            {line.type === 'removed' ? '' : renderText(line.text, line.charDiffs, 'dv-char-add')}
                          </td>
                        </tr>
                      ))}
                    </tbody></table>
                  </div>
                ))}
              </div>
            ) : (
              <div className="dv-inline">
                {hunks.map((hunk, hi) => (
                  <div key={hi} ref={el => { hunkRefs.current[hi] = el; }}
                    className={`dv-hunk ${hi === currentHunk ? 'dv-hunk-active' : ''}`}>
                    {(onAcceptHunk || onRejectHunk) && (
                      <div className="dv-hunk-actions">
                        {onAcceptHunk && <button className="dv-hunk-btn dv-accept" onClick={() => onAcceptHunk(hi)}><Check size={12} /></button>}
                        {onRejectHunk && <button className="dv-hunk-btn dv-reject" onClick={() => onRejectHunk(hi)}><XCircle size={12} /></button>}
                      </div>
                    )}
                    <table className="dv-table"><tbody>
                      {hunk.lines.map((line, li) => (
                        <tr key={li} className={`dv-line dv-line-${line.type}`}>
                          <td className="dv-linenum">{line.oldNum ?? ''}</td>
                          <td className="dv-linenum">{line.newNum ?? ''}</td>
                          <td className="dv-code">
                            <span className="dv-prefix">{line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}</span>
                            {renderText(line.text, line.charDiffs, line.type === 'added' ? 'dv-char-add' : 'dv-char-del')}
                          </td>
                        </tr>
                      ))}
                    </tbody></table>
                  </div>
                ))}
              </div>
            )}
            {hunks.length === 0 && (
              <div className="dv-no-changes">No changes detected</div>
            )}
          </div>
        </div>

        <style>{`
          .diff-viewer-overlay {
            position: fixed; inset: 0; background: rgba(0,0,0,0.35); z-index: 1000;
            display: flex; align-items: flex-start; justify-content: center; padding-top: 40px;
          }
          .diff-viewer-panel {
            background: #fff; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.2);
            width: 90vw; max-width: 1100px; max-height: 85vh; display: flex; flex-direction: column;
            font-family: 'Google Sans', -apple-system, sans-serif;
          }
          .dv-header {
            display: flex; justify-content: space-between; align-items: center;
            padding: 14px 20px; border-bottom: 1px solid #e8eaed;
          }
          .dv-stat { font-size: 12px; padding: 2px 8px; border-radius: 4px; font-weight: 500; }
          .dv-stat-add { background: #e6f4ea; color: #137333; }
          .dv-stat-del { background: #fce8e6; color: #d93025; }
          .dv-toggle { display: flex; border: 1px solid #dadce0; border-radius: 6px; overflow: hidden; }
          .dv-toggle button {
            padding: 4px 10px; border: none; background: #fff; cursor: pointer;
            display: flex; align-items: center; color: #5f6368;
          }
          .dv-toggle button.active { background: #e8f0fe; color: #1a73e8; }
          .dv-toggle button:not(:last-child) { border-right: 1px solid #dadce0; }
          .dv-nav { display: flex; align-items: center; gap: 4; }
          .dv-nav button {
            padding: 2px; border: 1px solid #dadce0; border-radius: 4px; background: #fff;
            cursor: pointer; display: flex; color: #5f6368;
          }
          .dv-nav button:disabled { opacity: 0.3; cursor: default; }
          .dv-close { border: none; background: transparent; cursor: pointer; color: #5f6368; display: flex; padding: 4px; border-radius: 6px; }
          .dv-close:hover { background: #f1f3f4; }
          .dv-body { display: flex; overflow: hidden; flex: 1; }
          .dv-files {
            width: 200px; border-right: 1px solid #e8eaed; overflow-y: auto; padding: 8px 0; flex-shrink: 0;
          }
          .dv-files-title { font-size: 11px; color: #5f6368; text-transform: uppercase; letter-spacing: 0.5px; padding: 4px 12px 8px; }
          .dv-file-item {
            display: flex; align-items: center; gap: 6; padding: 6px 12px; border: none;
            background: none; width: 100%; text-align: left; cursor: pointer; font-size: 12px;
          }
          .dv-file-item:hover { background: #f1f3f4; }
          .dv-file-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .dv-file-type { font-size: 10px; padding: 1px 4px; border-radius: 3px; font-weight: 600; }
          .dv-ft-added { background: #e6f4ea; color: #137333; }
          .dv-ft-modified { background: #fef7e0; color: #e37400; }
          .dv-ft-deleted { background: #fce8e6; color: #d93025; }
          .dv-content { flex: 1; overflow: auto; padding: 0; }
          .dv-side-header {
            display: grid; grid-template-columns: 1fr 1fr; padding: 8px 12px;
            font-size: 12px; font-weight: 600; color: #5f6368;
            border-bottom: 1px solid #e8eaed; background: #f8f9fa; position: sticky; top: 0; z-index: 1;
          }
          .dv-hunk { border-bottom: 1px solid #e8eaed; position: relative; }
          .dv-hunk-active { outline: 2px solid #1a73e8; outline-offset: -2px; border-radius: 4px; }
          .dv-hunk-actions {
            position: absolute; right: 8px; top: 4px; display: flex; gap: 4px; z-index: 2;
          }
          .dv-hunk-btn {
            padding: 2px 6px; border: 1px solid #dadce0; border-radius: 4px; background: #fff;
            cursor: pointer; display: flex; align-items: center;
          }
          .dv-accept { color: #137333; } .dv-accept:hover { background: #e6f4ea; }
          .dv-reject { color: #d93025; } .dv-reject:hover { background: #fce8e6; }
          .dv-table { width: 100%; border-collapse: collapse; font-size: 12px; font-family: 'SF Mono', Monaco, monospace; }
          .dv-linenum { width: 40px; padding: 0 6px; text-align: right; color: #80868b; user-select: none; font-size: 11px; vertical-align: top; }
          .dv-code { padding: 1px 8px; white-space: pre-wrap; word-break: break-all; }
          .dv-prefix { color: #80868b; user-select: none; margin-right: 4px; }
          .dv-line-added { background: #e6f4ea; }
          .dv-line-removed { background: #fce8e6; }
          .dv-line-context { background: #fff; }
          .dv-code-old { border-right: 1px solid #e8eaed; }
          .dv-char-add { background: #a8dab5; border-radius: 2px; }
          .dv-char-del { background: #f5b7b1; border-radius: 2px; }
          .dv-no-changes { padding: 40px; text-align: center; color: #5f6368; font-size: 14px; }
          .dv-side-by-side .dv-table { table-layout: fixed; }
          .dv-side-by-side .dv-code { width: 45%; }
        `}</style>
      </div>
    </div>
  );
};

export default DiffViewer;
