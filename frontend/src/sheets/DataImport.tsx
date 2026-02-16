import { useState } from 'react';

export interface ImportResult {
  data: string[][];
  headers?: string[];
}

function parseCSV(text: string, delimiter = ','): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuote) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') inQuote = false;
      else cell += ch;
    } else {
      if (ch === '"') inQuote = true;
      else if (ch === delimiter) { row.push(cell); cell = ''; }
      else if (ch === '\n' || (ch === '\r' && text[i + 1] === '\n')) {
        row.push(cell); cell = '';
        if (row.some(c => c !== '')) rows.push(row);
        row = [];
        if (ch === '\r') i++;
      } else cell += ch;
    }
  }
  row.push(cell);
  if (row.some(c => c !== '')) rows.push(row);
  return rows;
}

function detectDelimiter(text: string): string {
  const firstLine = text.split('\n')[0] || '';
  const tabs = (firstLine.match(/\t/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  const semis = (firstLine.match(/;/g) || []).length;
  if (tabs > commas && tabs > semis) return '\t';
  if (semis > commas) return ';';
  return ',';
}

function parseJSON(text: string): string[][] {
  const data = JSON.parse(text);
  if (Array.isArray(data)) {
    if (data.length === 0) return [];
    if (typeof data[0] === 'object' && data[0] !== null) {
      const keys = Object.keys(data[0]);
      return [keys, ...data.map((row: Record<string, unknown>) => keys.map(k => String(row[k] ?? '')))];
    }
    return data.map((r: unknown) => Array.isArray(r) ? r.map(String) : [String(r)]);
  }
  return [];
}

interface DataImportProps {
  onClose: () => void;
  onImport: (data: string[][], mode: 'replace' | 'append') => void;
}

export default function DataImportDialog({ onClose, onImport }: DataImportProps) {
  const [source, setSource] = useState<'clipboard' | 'url'>('clipboard');
  const [pasteText, setPasteText] = useState('');
  const [url, setUrl] = useState('');
  const [mode, setMode] = useState<'replace' | 'append'>('replace');
  const [preview, setPreview] = useState<string[][] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const parseInput = (text: string): string[][] => {
    const trimmed = text.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try { return parseJSON(trimmed); } catch { /* fall through */ }
    }
    const delim = detectDelimiter(trimmed);
    return parseCSV(trimmed, delim);
  };

  const handlePreview = async () => {
    setError('');
    setPreview(null);
    if (source === 'clipboard') {
      if (!pasteText.trim()) { setError('Paste some data first'); return; }
      const data = parseInput(pasteText);
      if (data.length === 0) { setError('No data detected'); return; }
      setPreview(data);
    } else {
      if (!url.trim()) { setError('Enter a URL'); return; }
      setLoading(true);
      try {
        const resp = await fetch(url.trim());
        const text = await resp.text();
        const data = parseInput(text);
        if (data.length === 0) { setError('No data found at URL'); setLoading(false); return; }
        setPreview(data);
      } catch (e) {
        setError('Failed to fetch URL: ' + (e instanceof Error ? e.message : String(e)));
      }
      setLoading(false);
    }
  };

  const handleImport = () => {
    if (preview) onImport(preview, mode);
  };

  const inputStyle = { width: '100%', padding: '6px 8px', border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box' as const };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 8, padding: 24, minWidth: 500, maxWidth: 700, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 16px' }}>Import Data</h3>
        <div style={{ marginBottom: 12, display: 'flex', gap: 12, fontSize: 13 }}>
          <label><input type="radio" checked={source === 'clipboard'} onChange={() => setSource('clipboard')} /> Paste data</label>
          <label><input type="radio" checked={source === 'url'} onChange={() => setSource('url')} /> From URL</label>
        </div>
        {source === 'clipboard' ? (
          <div style={{ marginBottom: 12 }}>
            <textarea value={pasteText} onChange={e => setPasteText(e.target.value)} placeholder="Paste CSV, TSV, or JSON data here..." rows={6} style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }} />
          </div>
        ) : (
          <div style={{ marginBottom: 12 }}>
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com/data.csv" style={inputStyle} />
          </div>
        )}
        <div style={{ marginBottom: 12, display: 'flex', gap: 12, fontSize: 13 }}>
          <label><input type="radio" checked={mode === 'replace'} onChange={() => setMode('replace')} /> Replace current data</label>
          <label><input type="radio" checked={mode === 'append'} onChange={() => setMode('append')} /> Append to sheet</label>
        </div>
        {error && <div style={{ color: 'red', fontSize: 13, marginBottom: 8 }}>{error}</div>}
        {loading && <div style={{ fontSize: 13, marginBottom: 8, color: '#666' }}>Loading...</div>}
        {preview && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, marginBottom: 4, fontWeight: 500 }}>Preview ({preview.length} rows, {preview[0]?.length || 0} columns):</div>
            <div style={{ maxHeight: 200, overflow: 'auto', border: '1px solid #e0e0e0', borderRadius: 4 }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%' }}>
                <tbody>
                  {preview.slice(0, 10).map((row, ri) => (
                    <tr key={ri} style={{ background: ri === 0 ? '#f5f5f5' : '#fff' }}>
                      {row.map((cell, ci) => (
                        <td key={ci} style={{ padding: '4px 8px', border: '1px solid #e0e0e0', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.length > 10 && <div style={{ padding: 4, fontSize: 11, color: '#999', textAlign: 'center' }}>...and {preview.length - 10} more rows</div>}
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '6px 16px', border: '1px solid #ccc', borderRadius: 4, background: '#fff', cursor: 'pointer' }}>Cancel</button>
          {!preview ? (
            <button onClick={handlePreview} style={{ padding: '6px 16px', border: 'none', borderRadius: 4, background: '#1a73e8', color: '#fff', cursor: 'pointer' }}>Preview</button>
          ) : (
            <button onClick={handleImport} style={{ padding: '6px 16px', border: 'none', borderRadius: 4, background: '#34a853', color: '#fff', cursor: 'pointer' }}>Import</button>
          )}
        </div>
      </div>
    </div>
  );
}
