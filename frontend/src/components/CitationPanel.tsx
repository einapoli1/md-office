import React, { useState, useRef } from 'react';
import { X, Plus, Upload, Trash2, Edit3, BookOpen, GripVertical } from 'lucide-react';
import {
  Citation,
  CitationStyle,
  CitationType,
  formatCitation,
  formatBibliographyEntry,
  parseBibTeX,
  exportBibTeX,
  lookupDOI,
} from '../lib/citationEngine';

interface CitationPanelProps {
  editor: any;
  citations: Citation[];
  setCitations: React.Dispatch<React.SetStateAction<Citation[]>>;
  citationStyle: CitationStyle;
  setCitationStyle: React.Dispatch<React.SetStateAction<CitationStyle>>;
  onClose: () => void;
}

const EMPTY_CITATION: Omit<Citation, 'id'> = {
  type: 'journal',
  authors: [{ first: '', last: '' }],
  title: '',
  year: '',
};

const CitationPanel: React.FC<CitationPanelProps> = ({
  editor,
  citations,
  setCitations,
  citationStyle,
  setCitationStyle,
  onClose,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Omit<Citation, 'id'>>(EMPTY_CITATION);
  const [doiQuery, setDoiQuery] = useState('');
  const [doiLoading, setDoiLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setFormData(EMPTY_CITATION);
    setEditingId(null);
    setShowForm(false);
  };

  const handleSave = () => {
    if (!formData.title.trim()) return;
    if (editingId) {
      setCitations(prev => prev.map(c => c.id === editingId ? { ...formData, id: editingId } as Citation : c));
    } else {
      const newCite: Citation = {
        ...formData,
        id: `cite-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      } as Citation;
      setCitations(prev => [...prev, newCite]);
    }
    resetForm();
  };

  const handleEdit = (c: Citation) => {
    const { id: _id, ...rest } = c;
    void _id;
    setFormData(rest);
    setEditingId(c.id);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    setCitations(prev => prev.filter(c => c.id !== id));
    if (editor) {
      editor.commands.removeCitation(id);
    }
  };

  const handleInsert = (c: Citation) => {
    if (!editor) return;
    const numbered = { ...c, _number: citations.indexOf(c) + 1 };
    const label = formatCitation(numbered, citationStyle);
    editor.chain().focus().insertContent({
      type: 'citation',
      attrs: { citationId: c.id, label },
    }).run();
  };

  const handleDOILookup = async () => {
    if (!doiQuery.trim()) return;
    setDoiLoading(true);
    try {
      const result = await lookupDOI(doiQuery.trim());
      if (result) {
        const { id: _id, ...rest } = result;
        void _id;
        setFormData(rest);
        setShowForm(true);
      } else {
        alert('DOI not found. Please enter citation details manually.');
        setShowForm(true);
      }
    } finally {
      setDoiLoading(false);
    }
  };

  const handleImportBibTeX = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const imported = parseBibTeX(text);
      if (imported.length) {
        setCitations(prev => [...prev, ...imported]);
      } else {
        alert('No valid BibTeX entries found.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExportBibTeX = () => {
    const text = exportBibTeX(citations);
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'references.bib';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAuthorChange = (index: number, field: 'first' | 'last', value: string) => {
    const newAuthors = [...formData.authors];
    newAuthors[index] = { ...newAuthors[index], [field]: value };
    setFormData({ ...formData, authors: newAuthors });
  };

  const addAuthor = () => {
    setFormData({ ...formData, authors: [...formData.authors, { first: '', last: '' }] });
  };

  const removeAuthor = (idx: number) => {
    if (formData.authors.length <= 1) return;
    setFormData({ ...formData, authors: formData.authors.filter((_, i) => i !== idx) });
  };

  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const reordered = [...citations];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(idx, 0, moved);
    setCitations(reordered);
    setDragIdx(idx);
  };
  const handleDragEnd = () => setDragIdx(null);

  return (
    <div className="citation-panel sidebar-panel" style={{
      position: 'fixed', right: 0, top: 0, bottom: 0, width: 380, background: 'var(--bg-primary, #fff)',
      borderLeft: '1px solid var(--border-color, #e0e0e0)', zIndex: 100, display: 'flex', flexDirection: 'column',
      boxShadow: '-2px 0 8px rgba(0,0,0,0.08)', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color, #e0e0e0)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BookOpen size={18} />
          <span style={{ fontWeight: 600, fontSize: 14 }}>Citation Manager</span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={16} /></button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Style selector */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 500, marginBottom: 4, display: 'block' }}>Citation Style</label>
          <select value={citationStyle} onChange={e => setCitationStyle(e.target.value as CitationStyle)}
            style={{ width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid var(--border-color, #ccc)', fontSize: 13 }}>
            <option value="apa">APA 7th Edition</option>
            <option value="mla">MLA 9th Edition</option>
            <option value="chicago">Chicago</option>
            <option value="ieee">IEEE</option>
            <option value="harvard">Harvard</option>
          </select>
        </div>

        {/* DOI lookup */}
        <div style={{ display: 'flex', gap: 6 }}>
          <input placeholder="Search by DOI..." value={doiQuery} onChange={e => setDoiQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleDOILookup()}
            style={{ flex: 1, padding: '6px 8px', borderRadius: 4, border: '1px solid var(--border-color, #ccc)', fontSize: 13 }} />
          <button onClick={handleDOILookup} disabled={doiLoading}
            style={{ padding: '6px 12px', borderRadius: 4, border: '1px solid var(--border-color, #ccc)', cursor: 'pointer', fontSize: 12, background: 'var(--bg-secondary, #f5f5f5)' }}>
            {doiLoading ? '...' : 'Lookup'}
          </button>
        </div>

        {/* Actions row */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={() => { setShowForm(true); setEditingId(null); setFormData(EMPTY_CITATION); }}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border-color, #ccc)', cursor: 'pointer', fontSize: 12, background: 'var(--bg-secondary, #f5f5f5)' }}>
            <Plus size={14} /> Add
          </button>
          <button onClick={() => fileInputRef.current?.click()}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border-color, #ccc)', cursor: 'pointer', fontSize: 12, background: 'var(--bg-secondary, #f5f5f5)' }}>
            <Upload size={14} /> Import BibTeX
          </button>
          {citations.length > 0 && (
            <button onClick={handleExportBibTeX}
              style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border-color, #ccc)', cursor: 'pointer', fontSize: 12, background: 'var(--bg-secondary, #f5f5f5)' }}>
              Export BibTeX
            </button>
          )}
          <input ref={fileInputRef} type="file" accept=".bib,.bibtex,.txt" onChange={handleImportBibTeX} style={{ display: 'none' }} />
        </div>

        {/* Form */}
        {showForm && (
          <div style={{ border: '1px solid var(--border-color, #e0e0e0)', borderRadius: 6, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--bg-secondary, #fafafa)' }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{editingId ? 'Edit Citation' : 'New Citation'}</div>

            <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value as CitationType })}
              style={{ padding: '4px 6px', borderRadius: 4, border: '1px solid var(--border-color, #ccc)', fontSize: 12 }}>
              <option value="journal">Journal Article</option>
              <option value="book">Book</option>
              <option value="website">Website</option>
              <option value="conference">Conference Paper</option>
            </select>

            {/* Authors */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 500 }}>Authors</label>
              {formData.authors.map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                  <input placeholder="First" value={a.first} onChange={e => handleAuthorChange(i, 'first', e.target.value)}
                    style={{ flex: 1, padding: '4px 6px', borderRadius: 3, border: '1px solid var(--border-color, #ccc)', fontSize: 12 }} />
                  <input placeholder="Last" value={a.last} onChange={e => handleAuthorChange(i, 'last', e.target.value)}
                    style={{ flex: 1, padding: '4px 6px', borderRadius: 3, border: '1px solid var(--border-color, #ccc)', fontSize: 12 }} />
                  {formData.authors.length > 1 && (
                    <button onClick={() => removeAuthor(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
              <button onClick={addAuthor} style={{ marginTop: 4, fontSize: 11, color: '#4285f4', background: 'none', border: 'none', cursor: 'pointer' }}>+ Add author</button>
            </div>

            <input placeholder="Title *" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })}
              style={{ padding: '4px 6px', borderRadius: 3, border: '1px solid var(--border-color, #ccc)', fontSize: 12 }} />
            <input placeholder="Year *" value={formData.year} onChange={e => setFormData({ ...formData, year: e.target.value })}
              style={{ padding: '4px 6px', borderRadius: 3, border: '1px solid var(--border-color, #ccc)', fontSize: 12, width: 80 }} />

            {(formData.type === 'journal' || formData.type === 'conference') && (
              <input placeholder={formData.type === 'journal' ? 'Journal' : 'Conference'} value={formData.type === 'journal' ? (formData.journal ?? '') : (formData.conference ?? '')}
                onChange={e => setFormData({ ...formData, [formData.type === 'journal' ? 'journal' : 'conference']: e.target.value })}
                style={{ padding: '4px 6px', borderRadius: 3, border: '1px solid var(--border-color, #ccc)', fontSize: 12 }} />
            )}
            {formData.type === 'book' && (
              <>
                <input placeholder="Publisher" value={formData.publisher ?? ''} onChange={e => setFormData({ ...formData, publisher: e.target.value })}
                  style={{ padding: '4px 6px', borderRadius: 3, border: '1px solid var(--border-color, #ccc)', fontSize: 12 }} />
                <input placeholder="Edition" value={formData.edition ?? ''} onChange={e => setFormData({ ...formData, edition: e.target.value })}
                  style={{ padding: '4px 6px', borderRadius: 3, border: '1px solid var(--border-color, #ccc)', fontSize: 12 }} />
              </>
            )}

            <div style={{ display: 'flex', gap: 4 }}>
              <input placeholder="Volume" value={formData.volume ?? ''} onChange={e => setFormData({ ...formData, volume: e.target.value })}
                style={{ flex: 1, padding: '4px 6px', borderRadius: 3, border: '1px solid var(--border-color, #ccc)', fontSize: 12 }} />
              <input placeholder="Issue" value={formData.issue ?? ''} onChange={e => setFormData({ ...formData, issue: e.target.value })}
                style={{ flex: 1, padding: '4px 6px', borderRadius: 3, border: '1px solid var(--border-color, #ccc)', fontSize: 12 }} />
              <input placeholder="Pages" value={formData.pages ?? ''} onChange={e => setFormData({ ...formData, pages: e.target.value })}
                style={{ flex: 1, padding: '4px 6px', borderRadius: 3, border: '1px solid var(--border-color, #ccc)', fontSize: 12 }} />
            </div>

            <input placeholder="DOI" value={formData.doi ?? ''} onChange={e => setFormData({ ...formData, doi: e.target.value })}
              style={{ padding: '4px 6px', borderRadius: 3, border: '1px solid var(--border-color, #ccc)', fontSize: 12 }} />
            <input placeholder="URL" value={formData.url ?? ''} onChange={e => setFormData({ ...formData, url: e.target.value })}
              style={{ padding: '4px 6px', borderRadius: 3, border: '1px solid var(--border-color, #ccc)', fontSize: 12 }} />

            {formData.type === 'website' && (
              <input placeholder="Accessed date (e.g. January 15, 2024)" value={formData.accessedDate ?? ''} onChange={e => setFormData({ ...formData, accessedDate: e.target.value })}
                style={{ padding: '4px 6px', borderRadius: 3, border: '1px solid var(--border-color, #ccc)', fontSize: 12 }} />
            )}

            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <button onClick={handleSave}
                style={{ padding: '6px 14px', borderRadius: 4, border: 'none', background: '#4285f4', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
                {editingId ? 'Update' : 'Add Citation'}
              </button>
              <button onClick={resetForm}
                style={{ padding: '6px 14px', borderRadius: 4, border: '1px solid var(--border-color, #ccc)', background: 'none', cursor: 'pointer', fontSize: 12 }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Citation list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {citations.length === 0 && !showForm && (
            <div style={{ color: '#999', fontSize: 13, textAlign: 'center', padding: 20 }}>
              No citations yet. Click "Add" to create one.
            </div>
          )}
          {citations.map((c, idx) => {
            const numbered = { ...c, _number: idx + 1 };
            return (
              <div key={c.id} draggable onDragStart={() => handleDragStart(idx)} onDragOver={e => handleDragOver(e, idx)} onDragEnd={handleDragEnd}
                style={{
                  border: '1px solid var(--border-color, #e0e0e0)', borderRadius: 6, padding: '8px 10px', fontSize: 12,
                  background: dragIdx === idx ? 'var(--bg-secondary, #f0f0f0)' : 'var(--bg-primary, #fff)',
                  cursor: 'grab',
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <GripVertical size={12} style={{ color: '#999', flexShrink: 0 }} />
                      <span style={{ fontWeight: 600, color: '#4285f4' }}>{formatCitation(numbered, citationStyle)}</span>
                    </div>
                    <div style={{ marginTop: 4, lineHeight: 1.4 }}
                      dangerouslySetInnerHTML={{ __html: formatBibliographyEntry(numbered, citationStyle) }} />
                  </div>
                  <div style={{ display: 'flex', gap: 2, flexShrink: 0, marginLeft: 4 }}>
                    <button onClick={() => handleInsert(c)} title="Insert at cursor"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#4285f4' }}>
                      <Plus size={14} />
                    </button>
                    <button onClick={() => handleEdit(c)} title="Edit"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                      <Edit3 size={14} />
                    </button>
                    <button onClick={() => handleDelete(c.id)} title="Delete"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#d93025' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CitationPanel;
