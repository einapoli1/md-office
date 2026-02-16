import { useState, useEffect, useCallback } from 'react';
import { embedRegistry, type EmbedEntry } from '../lib/embedRegistry';

interface EmbedPickerProps {
  open: boolean;
  onClose: () => void;
  onInsert: (entry: EmbedEntry) => void;
  filterType?: 'chart' | 'range';
}

interface SheetFile {
  path: string;
  name: string;
}

function getSheetFiles(): SheetFile[] {
  const files: SheetFile[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.endsWith('.sheet.md')) {
      files.push({ path: key, name: key.split('/').pop()?.replace('.sheet.md', '') || key });
    }
  }
  // Also check for file list in a known key
  try {
    const fileList = localStorage.getItem('md-office-files');
    if (fileList) {
      const parsed: string[] = JSON.parse(fileList);
      for (const p of parsed) {
        if (p.endsWith('.sheet.md') && !files.some(f => f.path === p)) {
          files.push({ path: p, name: p.split('/').pop()?.replace('.sheet.md', '') || p });
        }
      }
    }
  } catch { /* ignore */ }
  return files;
}

export default function EmbedPicker({ open, onClose, onInsert, filterType }: EmbedPickerProps) {
  const [sheets, setSheets] = useState<SheetFile[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [embeds, setEmbeds] = useState<EmbedEntry[]>([]);

  useEffect(() => {
    if (open) {
      setSheets(getSheetFiles());
      setEmbeds(embedRegistry.getAll());
    }
  }, [open]);

  useEffect(() => {
    if (selectedSheet) {
      setEmbeds(embedRegistry.getBySource(selectedSheet));
    } else {
      setEmbeds(embedRegistry.getAll());
    }
  }, [selectedSheet]);

  const filtered = filterType ? embeds.filter(e => e.embedType === filterType) : embeds;

  const handleCreatePlaceholder = useCallback(() => {
    if (!selectedSheet) return;
    const entry: EmbedEntry = {
      id: embedRegistry.generateId(),
      sourceFile: selectedSheet,
      embedType: filterType || 'chart',
      label: `${filterType === 'range' ? 'Table' : 'Chart'} from ${selectedSheet.split('/').pop()?.replace('.sheet.md', '')}`,
      snapshot: `<div style="padding:40px;text-align:center;color:#666;background:#f5f5f5;border-radius:4px">
        <div style="font-size:32px;margin-bottom:8px">${filterType === 'range' ? '📊' : '📈'}</div>
        <div>${filterType === 'range' ? 'Table' : 'Chart'} embed</div>
      </div>`,
      updatedAt: Date.now(),
    };
    embedRegistry.register(entry);
    onInsert(entry);
  }, [selectedSheet, filterType, onInsert]);

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.4)',
    }} onClick={onClose}>
      <div
        style={{
          background: 'white', borderRadius: 8, width: 520, maxHeight: '80vh',
          overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #eee',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>
            Insert {filterType === 'range' ? 'Table' : 'Chart'} from Sheets
          </h3>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#888',
          }}>✕</button>
        </div>

        <div style={{ padding: 20 }}>
          <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6 }}>
            Select a spreadsheet:
          </label>
          <select
            value={selectedSheet}
            onChange={e => setSelectedSheet(e.target.value)}
            style={{
              width: '100%', padding: '8px 10px', borderRadius: 4,
              border: '1px solid #ccc', fontSize: 13, marginBottom: 16,
            }}
          >
            <option value="">All sheets</option>
            {sheets.map(s => (
              <option key={s.path} value={s.path}>{s.name}</option>
            ))}
          </select>

          {filtered.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, maxHeight: 300, overflow: 'auto' }}>
              {filtered.map(entry => (
                <div
                  key={entry.id}
                  onClick={() => onInsert(entry)}
                  style={{
                    border: '1px solid #ddd', borderRadius: 6, overflow: 'hidden',
                    cursor: 'pointer', transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#4285f4')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#ddd')}
                >
                  <div
                    style={{ height: 100, overflow: 'hidden', background: '#fafafa' }}
                    dangerouslySetInnerHTML={{ __html: entry.snapshot }}
                  />
                  <div style={{ padding: '6px 8px', fontSize: 12, color: '#333', borderTop: '1px solid #eee' }}>
                    {entry.label}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '30px 0', color: '#999' }}>
              <p style={{ margin: '0 0 12px' }}>
                {selectedSheet ? 'No embeddable content found in this sheet.' : 'No embedded content registered yet.'}
              </p>
              {selectedSheet && (
                <button
                  onClick={handleCreatePlaceholder}
                  style={{
                    padding: '8px 16px', background: '#4285f4', color: 'white',
                    border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13,
                  }}
                >
                  Create {filterType === 'range' ? 'Table' : 'Chart'} Embed
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
