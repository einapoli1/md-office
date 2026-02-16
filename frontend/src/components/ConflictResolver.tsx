import React, { useState, useCallback, useMemo } from 'react';

interface ConflictRegion {
  id: string;
  yours: string;
  theirs: string;
  resolved?: string;
  resolution?: 'yours' | 'theirs' | 'manual';
}

interface ConflictResolverProps {
  open: boolean;
  onClose: () => void;
  /** Raw text with git-style conflict markers */
  conflictText: string;
  onResolve: (resolvedText: string) => void;
}

/** Parse git-style conflict markers into regions */
function parseConflicts(text: string): { regions: ConflictRegion[]; cleanParts: { type: 'clean' | 'conflict'; content: string; conflictId?: string }[] } {
  const regex = /<<<<<<< .*?\n([\s\S]*?)=======\n([\s\S]*?)>>>>>>> .*?\n/g;
  const regions: ConflictRegion[] = [];
  const cleanParts: { type: 'clean' | 'conflict'; content: string; conflictId?: string }[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      cleanParts.push({ type: 'clean', content: text.slice(lastIndex, match.index) });
    }
    const id = `conflict-${regions.length}`;
    regions.push({
      id,
      yours: match[1].trimEnd(),
      theirs: match[2].trimEnd(),
    });
    cleanParts.push({ type: 'conflict', content: '', conflictId: id });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    cleanParts.push({ type: 'clean', content: text.slice(lastIndex) });
  }

  return { regions, cleanParts };
}

const ConflictResolver: React.FC<ConflictResolverProps> = ({ open, onClose, conflictText, onResolve }) => {
  const { regions: initialRegions, cleanParts } = useMemo(() => parseConflicts(conflictText), [conflictText]);
  const [regions, setRegions] = useState<ConflictRegion[]>(initialRegions);

  const resolve = useCallback((id: string, resolution: 'yours' | 'theirs', text?: string) => {
    setRegions(prev => prev.map(r => {
      if (r.id !== id) return r;
      return {
        ...r,
        resolution,
        resolved: text ?? (resolution === 'yours' ? r.yours : r.theirs),
      };
    }));
  }, []);

  const setManual = useCallback((id: string, text: string) => {
    setRegions(prev => prev.map(r => r.id === id ? { ...r, resolution: 'manual', resolved: text } : r));
  }, []);

  const acceptAllYours = useCallback(() => {
    setRegions(prev => prev.map(r => ({ ...r, resolution: 'yours', resolved: r.yours })));
  }, []);

  const acceptAllTheirs = useCallback(() => {
    setRegions(prev => prev.map(r => ({ ...r, resolution: 'theirs', resolved: r.theirs })));
  }, []);

  const allResolved = regions.every(r => r.resolution);

  const buildResult = useCallback(() => {
    const regionMap = new Map(regions.map(r => [r.id, r]));
    return cleanParts.map(p => {
      if (p.type === 'clean') return p.content;
      const r = regionMap.get(p.conflictId!);
      return r?.resolved ?? r?.yours ?? '';
    }).join('');
  }, [regions, cleanParts]);

  const handleApply = useCallback(() => {
    onResolve(buildResult());
    onClose();
  }, [buildResult, onResolve, onClose]);

  if (!open) return null;

  if (initialRegions.length === 0) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
        <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-primary, #fff)', borderRadius: 12, padding: 32, textAlign: 'center' }}>
          <p>No conflicts detected in this document.</p>
          <button onClick={onClose} style={{ marginTop: 12, padding: '8px 20px', borderRadius: 6, background: '#4285F4', color: '#fff', border: 'none', cursor: 'pointer' }}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000,
      display: 'flex', alignItems: 'stretch', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        background: 'var(--bg-primary, #fff)', borderRadius: 12, flex: 1, maxWidth: 1000,
        display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 20px', borderBottom: '1px solid var(--border-color, #ddd)',
        }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>
            Resolve Conflicts ({regions.filter(r => r.resolution).length}/{regions.length})
          </h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={acceptAllYours} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 4, border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }}>Accept All Yours</button>
            <button onClick={acceptAllTheirs} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 4, border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }}>Accept All Theirs</button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>✕</button>
          </div>
        </div>

        {/* Conflict list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {regions.map((region, i) => (
            <div key={region.id} style={{
              marginBottom: 20, border: `2px solid ${region.resolution ? '#34A853' : '#EA4335'}`,
              borderRadius: 8, overflow: 'hidden',
            }}>
              <div style={{ background: region.resolution ? 'rgba(52,168,83,0.1)' : 'rgba(234,67,53,0.1)', padding: '8px 12px', fontSize: 13, fontWeight: 600 }}>
                Conflict {i + 1} {region.resolution && `— resolved (${region.resolution})`}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0 }}>
                {/* Yours */}
                <div style={{ borderRight: '1px solid #eee' }}>
                  <div style={{ padding: '6px 10px', fontSize: 11, fontWeight: 600, color: '#4285F4', background: 'rgba(66,133,244,0.05)' }}>YOURS</div>
                  <pre style={{
                    padding: '8px 10px', margin: 0, fontSize: 12, whiteSpace: 'pre-wrap',
                    background: region.resolution === 'yours' ? 'rgba(66,133,244,0.08)' : 'transparent',
                    minHeight: 40, fontFamily: 'monospace',
                  }}>{region.yours}</pre>
                  <button
                    onClick={() => resolve(region.id, 'yours')}
                    style={{
                      width: '100%', padding: '6px', border: 'none', cursor: 'pointer', fontSize: 12,
                      background: region.resolution === 'yours' ? '#4285F4' : '#f0f0f0',
                      color: region.resolution === 'yours' ? '#fff' : '#333',
                    }}
                  >Accept Yours</button>
                </div>

                {/* Theirs */}
                <div style={{ borderRight: '1px solid #eee' }}>
                  <div style={{ padding: '6px 10px', fontSize: 11, fontWeight: 600, color: '#EA4335', background: 'rgba(234,67,53,0.05)' }}>THEIRS</div>
                  <pre style={{
                    padding: '8px 10px', margin: 0, fontSize: 12, whiteSpace: 'pre-wrap',
                    background: region.resolution === 'theirs' ? 'rgba(234,67,53,0.08)' : 'transparent',
                    minHeight: 40, fontFamily: 'monospace',
                  }}>{region.theirs}</pre>
                  <button
                    onClick={() => resolve(region.id, 'theirs')}
                    style={{
                      width: '100%', padding: '6px', border: 'none', cursor: 'pointer', fontSize: 12,
                      background: region.resolution === 'theirs' ? '#EA4335' : '#f0f0f0',
                      color: region.resolution === 'theirs' ? '#fff' : '#333',
                    }}
                  >Accept Theirs</button>
                </div>

                {/* Merged */}
                <div>
                  <div style={{ padding: '6px 10px', fontSize: 11, fontWeight: 600, color: '#34A853', background: 'rgba(52,168,83,0.05)' }}>MERGED</div>
                  <textarea
                    value={region.resolved ?? ''}
                    onChange={e => setManual(region.id, e.target.value)}
                    style={{
                      width: '100%', minHeight: 60, padding: '8px 10px', border: 'none', resize: 'vertical',
                      fontSize: 12, fontFamily: 'monospace', background: 'rgba(52,168,83,0.04)', boxSizing: 'border-box',
                    }}
                    placeholder="Edit merged result..."
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px', borderTop: '1px solid var(--border-color, #ddd)',
          display: 'flex', justifyContent: 'flex-end', gap: 8,
        }}>
          <button onClick={onClose} style={{ padding: '8px 20px', borderRadius: 6, border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }}>Cancel</button>
          <button
            onClick={handleApply}
            disabled={!allResolved}
            style={{
              padding: '8px 20px', borderRadius: 6, border: 'none', cursor: allResolved ? 'pointer' : 'not-allowed',
              background: allResolved ? '#34A853' : '#ccc', color: '#fff', fontWeight: 600,
            }}
          >Apply Resolved</button>
        </div>
      </div>
    </div>
  );
};

export default ConflictResolver;
