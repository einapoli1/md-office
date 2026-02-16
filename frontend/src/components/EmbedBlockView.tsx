import { useState, useEffect, useCallback } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import { embedRegistry } from '../lib/embedRegistry';
import { embedSync } from '../lib/embedSync';

export function EmbedBlockView({ node, selected, deleteNode }: any) {
  const { embedId, sourceFile, embedType, width, height } = node.attrs;
  const [entry, setEntry] = useState(() => embedRegistry.get(embedId));
  const [stale, setStale] = useState(() => embedSync.isStale(embedId));
  const [showPopover, setShowPopover] = useState(false);

  useEffect(() => {
    const unsub1 = embedRegistry.subscribe(() => setEntry(embedRegistry.get(embedId)));
    const unsub2 = embedSync.subscribe(() => setStale(embedSync.isStale(embedId)));
    return () => { unsub1(); unsub2(); };
  }, [embedId]);

  const handleRefresh = useCallback(() => {
    const current = embedRegistry.get(embedId);
    if (current) {
      embedSync.clearStale(embedId);
      setStale(false);
    }
  }, [embedId]);

  const handleUnlink = useCallback(() => {
    deleteNode();
  }, [deleteNode]);

  const sourceName = sourceFile?.split('/').pop()?.replace('.sheet.md', '') || 'Sheet';
  const snapshot = entry?.snapshot || '<div style="padding:20px;color:#999;text-align:center">No preview available</div>';

  return (
    <NodeViewWrapper className={`embed-block-wrapper ${selected ? 'selected' : ''}`}>
      <div
        style={{
          border: '1px solid #ddd',
          borderRadius: 6,
          overflow: 'hidden',
          display: 'inline-block',
          width: width || 400,
          cursor: 'pointer',
          position: 'relative',
        }}
        onClick={() => setShowPopover(!showPopover)}
      >
        {stale && (
          <div style={{
            position: 'absolute', top: 4, right: 4, zIndex: 2,
            background: '#fbbf24', color: '#78350f', fontSize: 11,
            padding: '2px 8px', borderRadius: 10, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            ⚠ Outdated
            <button
              onClick={(e) => { e.stopPropagation(); handleRefresh(); }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 11, textDecoration: 'underline', color: '#78350f',
              }}
            >Refresh</button>
          </div>
        )}
        <div
          style={{ minHeight: height || 200, overflow: 'hidden' }}
          dangerouslySetInnerHTML={{ __html: snapshot }}
        />
        <div style={{
          padding: '4px 8px', fontSize: 11, color: '#888',
          borderTop: '1px solid #eee', background: '#fafafa',
        }}>
          Linked from <strong>{sourceName}</strong> ({embedType})
        </div>
      </div>

      {showPopover && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 10,
          background: 'white', border: '1px solid #ddd', borderRadius: 6,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)', padding: 8,
          display: 'flex', gap: 8, marginTop: 4,
        }}>
          <button
            onClick={(e) => { e.stopPropagation(); handleRefresh(); setShowPopover(false); }}
            style={{
              padding: '4px 12px', fontSize: 12, background: '#4285f4',
              color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer',
            }}
          >Update</button>
          <button
            onClick={(e) => { e.stopPropagation(); handleUnlink(); }}
            style={{
              padding: '4px 12px', fontSize: 12, background: '#eee',
              border: 'none', borderRadius: 4, cursor: 'pointer',
            }}
          >Unlink</button>
        </div>
      )}
    </NodeViewWrapper>
  );
}
