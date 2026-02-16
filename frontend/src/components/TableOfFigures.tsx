import React, { useState, useMemo } from 'react';
import { X, List } from 'lucide-react';

type ListType = 'figures' | 'tables' | 'index';

interface FigureEntry {
  number: number;
  text: string;
  captionId: string;
}

interface IndexEntry {
  term: string;
  pages: number[];
}

interface TableOfFiguresProps {
  editor: any;
  onClose: () => void;
}

const TableOfFigures: React.FC<TableOfFiguresProps> = ({ editor, onClose }) => {
  const [listType, setListType] = useState<ListType>('figures');
  const [indexTerms, setIndexTerms] = useState('');

  const figures = useMemo<FigureEntry[]>(() => {
    if (!editor) return [];
    const entries: FigureEntry[] = [];
    editor.state.doc.descendants((node: any) => {
      if (node.type.name === 'caption' && node.attrs.kind === 'figure') {
        entries.push({
          number: node.attrs.number,
          text: node.textContent,
          captionId: node.attrs.captionId,
        });
      }
    });
    return entries;
  }, [editor]);

  const tables = useMemo<FigureEntry[]>(() => {
    if (!editor) return [];
    const entries: FigureEntry[] = [];
    editor.state.doc.descendants((node: any) => {
      if (node.type.name === 'caption' && node.attrs.kind === 'table') {
        entries.push({
          number: node.attrs.number,
          text: node.textContent,
          captionId: node.attrs.captionId,
        });
      }
    });
    return entries;
  }, [editor]);

  const insertList = () => {
    if (!editor) return;

    let html = '';
    if (listType === 'figures') {
      html = `<div data-tof="figures" style="margin:16px 0;"><h3 style="border-bottom:1px solid #ddd;padding-bottom:4px;">Table of Figures</h3>`;
      if (figures.length === 0) {
        html += '<p style="color:#888;font-style:italic;">No figures with captions found.</p>';
      } else {
        figures.forEach((f) => {
          html += `<p style="margin:2px 0;"><a href="#${f.captionId}" style="color:#4285f4;text-decoration:none;">Figure ${f.number}</a> — ${f.text}</p>`;
        });
      }
      html += '</div>';
    } else if (listType === 'tables') {
      html = `<div data-tof="tables" style="margin:16px 0;"><h3 style="border-bottom:1px solid #ddd;padding-bottom:4px;">Table of Tables</h3>`;
      if (tables.length === 0) {
        html += '<p style="color:#888;font-style:italic;">No tables with captions found.</p>';
      } else {
        tables.forEach((t) => {
          html += `<p style="margin:2px 0;"><a href="#${t.captionId}" style="color:#4285f4;text-decoration:none;">Table ${t.number}</a> — ${t.text}</p>`;
        });
      }
      html += '</div>';
    } else {
      // Index
      const terms = indexTerms
        .split('\n')
        .map((t) => t.trim())
        .filter(Boolean);
      const docText = editor.state.doc.textContent;
      const entries: IndexEntry[] = terms.map((term) => {
        // Estimate "page" by character position (rough: 3000 chars per page)
        const pages: number[] = [];
        let idx = 0;
        const lower = docText.toLowerCase();
        const termLower = term.toLowerCase();
        while (true) {
          const found = lower.indexOf(termLower, idx);
          if (found === -1) break;
          const page = Math.floor(found / 3000) + 1;
          if (!pages.includes(page)) pages.push(page);
          idx = found + termLower.length;
        }
        return { term, pages };
      }).filter((e) => e.pages.length > 0);

      entries.sort((a, b) => a.term.localeCompare(b.term));

      html = `<div data-tof="index" style="margin:16px 0;"><h3 style="border-bottom:1px solid #ddd;padding-bottom:4px;">Index</h3>`;
      if (entries.length === 0) {
        html += '<p style="color:#888;font-style:italic;">No index terms found in document.</p>';
      } else {
        entries.forEach((e) => {
          html += `<p style="margin:2px 0;"><strong>${e.term}</strong> — ${e.pages.join(', ')}</p>`;
        });
      }
      html += '</div>';
    }

    editor.chain().focus().insertContent(html).run();
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 10000,
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: 'white', borderRadius: 8, padding: 24, width: 440,
        maxHeight: '80vh', overflow: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <List size={20} /> Table of Figures / Index
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['figures', 'tables', 'index'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setListType(t)}
              style={{
                padding: '6px 14px', borderRadius: 4, cursor: 'pointer', fontSize: 13,
                border: listType === t ? '2px solid #4285f4' : '1px solid #ddd',
                background: listType === t ? '#e8f0fe' : '#fafafa',
                fontWeight: listType === t ? 600 : 400,
                textTransform: 'capitalize',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {listType === 'figures' && (
          <div style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
            Lists all images with captions. Found <strong>{figures.length}</strong> figure caption(s).
          </div>
        )}
        {listType === 'tables' && (
          <div style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
            Lists all tables with captions. Found <strong>{tables.length}</strong> table caption(s).
          </div>
        )}
        {listType === 'index' && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>
              Index terms (one per line)
            </label>
            <textarea
              value={indexTerms}
              onChange={(e) => setIndexTerms(e.target.value)}
              placeholder={'algorithm\nmachine learning\nneural network'}
              rows={6}
              style={{
                width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 4,
                fontSize: 13, fontFamily: 'monospace', resize: 'vertical',
              }}
            />
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={insertList} style={{
            padding: '8px 16px', border: 'none', borderRadius: 4, cursor: 'pointer',
            background: '#4285f4', color: 'white', fontWeight: 600,
          }}>
            Insert
          </button>
        </div>
      </div>
    </div>
  );
};

export default TableOfFigures;
