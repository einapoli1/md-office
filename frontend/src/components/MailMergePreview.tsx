import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, Grid, AlertTriangle } from 'lucide-react';
import { renderTemplate, extractVariables } from '../lib/templateEngine';

interface MailMergePreviewProps {
  template: string;
  rows: Record<string, string>[];
  currentIndex: number;
  onIndexChange: (i: number) => void;
}

/**
 * Live preview panel for mail merge: record navigator, highlighted diffs,
 * grid overview, and missing-variable indicators.
 */
const MailMergePreview: React.FC<MailMergePreviewProps> = ({
  template,
  rows,
  currentIndex,
  onIndexChange,
}) => {
  const [showGrid, setShowGrid] = useState(false);
  const [flashKeys, setFlashKeys] = useState<Set<string>>(new Set());
  const prevIndex = useRef(currentIndex);

  const variables = useMemo(() => extractVariables(template), [template]);

  // Detect which variables changed when navigating records
  useEffect(() => {
    if (rows.length < 2) return;
    const prev = rows[prevIndex.current];
    const curr = rows[currentIndex];
    if (!prev || !curr || prevIndex.current === currentIndex) {
      prevIndex.current = currentIndex;
      return;
    }
    const changed = new Set<string>();
    variables.forEach((v) => {
      if ((prev[v] ?? '') !== (curr[v] ?? '')) changed.add(v);
    });
    setFlashKeys(changed);
    prevIndex.current = currentIndex;
    const timer = setTimeout(() => setFlashKeys(new Set()), 600);
    return () => clearTimeout(timer);
  }, [currentIndex, rows, variables]);

  const currentRow = rows[currentIndex] ?? {};
  const rendered = useMemo(
    () => renderTemplate(template, currentRow),
    [template, currentRow],
  );

  // Missing / empty variables for current record
  const missingVars = useMemo(
    () => variables.filter((v) => !currentRow[v]?.trim()),
    [variables, currentRow],
  );

  // Build highlighted HTML: wrap changed values in yellow span
  const highlightedHtml = useMemo(() => {
    if (flashKeys.size === 0) return rendered;
    let html = rendered;
    flashKeys.forEach((key) => {
      const val = currentRow[key] ?? '';
      if (val) {
        html = html.replaceAll(
          val,
          `<mark style="background:#fff3b0;transition:background 0.5s">${val}</mark>`,
        );
      }
    });
    return html;
  }, [rendered, flashKeys, currentRow]);

  if (rows.length === 0) {
    return (
      <div style={{ padding: 16, color: '#999', fontSize: 13 }}>
        No data loaded. Import a CSV or JSON file to preview merged documents.
      </div>
    );
  }

  if (showGrid) {
    return (
      <div style={{ padding: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>All Records Preview</span>
          <button onClick={() => setShowGrid(false)} style={linkBtn}>← Back to single</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10, maxHeight: 500, overflow: 'auto' }}>
          {rows.map((row, i) => {
            const text = renderTemplate(template, row);
            const rowMissing = variables.some((v) => !row[v]?.trim());
            return (
              <div
                key={i}
                onClick={() => { onIndexChange(i); setShowGrid(false); }}
                style={{
                  border: i === currentIndex ? '2px solid #1a73e8' : '1px solid #ddd',
                  borderRadius: 6,
                  padding: 8,
                  cursor: 'pointer',
                  fontSize: 9,
                  lineHeight: 1.4,
                  maxHeight: 140,
                  overflow: 'hidden',
                  position: 'relative',
                  background: '#fff',
                }}
              >
                {rowMissing && (
                  <AlertTriangle size={12} style={{ position: 'absolute', top: 4, right: 4, color: '#e67700' }} />
                )}
                <div style={{ fontWeight: 600, fontSize: 10, marginBottom: 4, color: '#666' }}>#{i + 1}</div>
                <div style={{ whiteSpace: 'pre-wrap', color: '#333' }}>{text.slice(0, 300)}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Navigator bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', borderBottom: '1px solid #e0e0e0', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => onIndexChange(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0}
            style={navBtn}
          >
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontSize: 13, minWidth: 70, textAlign: 'center' }}>
            {currentIndex + 1} of {rows.length}
          </span>
          <button
            onClick={() => onIndexChange(Math.min(rows.length - 1, currentIndex + 1))}
            disabled={currentIndex >= rows.length - 1}
            style={navBtn}
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {missingVars.length > 0 && (
            <span style={{ fontSize: 11, color: '#e67700', display: 'flex', alignItems: 'center', gap: 3 }}>
              <AlertTriangle size={12} /> {missingVars.length} empty
            </span>
          )}
          <button onClick={() => setShowGrid(true)} style={linkBtn} title="Preview All">
            <Grid size={14} /> All
          </button>
        </div>
      </div>

      {/* Rendered preview */}
      <div
        style={{
          flex: 1, overflow: 'auto', padding: 16, fontSize: 14, lineHeight: 1.7,
          whiteSpace: 'pre-wrap', fontFamily: 'Georgia, serif',
        }}
        dangerouslySetInnerHTML={{ __html: highlightedHtml }}
      />
    </div>
  );
};

const navBtn: React.CSSProperties = {
  background: 'none', border: '1px solid #ddd', borderRadius: 4,
  cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center',
};

const linkBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: 12, color: '#1a73e8', display: 'flex', alignItems: 'center', gap: 3,
};

export default MailMergePreview;
