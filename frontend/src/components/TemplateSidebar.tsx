import React, { useState, useEffect } from 'react';
import { X, Plus, FileText, Trash2 } from 'lucide-react';

interface SavedTemplate {
  id: string;
  name: string;
  category: string;
  content: string;
  createdAt: number;
}

const CATEGORIES = ['Letter', 'Invoice', 'Report', 'Resume', 'Custom'] as const;
const STORAGE_KEY = 'md-office-templates';

function loadTemplates(): SavedTemplate[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveTemplates(templates: SavedTemplate[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

interface TemplateSidebarProps {
  onClose: () => void;
  currentContent: string;
  onUseTemplate: (content: string) => void;
}

const TemplateSidebar: React.FC<TemplateSidebarProps> = ({ onClose, currentContent, onUseTemplate }) => {
  const [templates, setTemplates] = useState<SavedTemplate[]>(loadTemplates());
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<string>('Custom');

  useEffect(() => {
    saveTemplates(templates);
  }, [templates]);

  const handleSave = () => {
    if (!newName.trim()) return;
    const tpl: SavedTemplate = {
      id: Date.now().toString(36),
      name: newName.trim(),
      category: newCategory,
      content: currentContent,
      createdAt: Date.now(),
    };
    setTemplates(prev => [tpl, ...prev]);
    setShowSaveDialog(false);
    setNewName('');
  };

  const handleDelete = (id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
  };

  const filtered = activeCategory === 'All'
    ? templates
    : templates.filter(t => t.category === activeCategory);

  return (
    <div style={{
      position: 'fixed', right: 0, top: 0, bottom: 0, width: 340,
      background: 'var(--bg-primary, #fff)', borderLeft: '1px solid var(--border-color, #e0e0e0)',
      display: 'flex', flexDirection: 'column', zIndex: 50,
      boxShadow: '-2px 0 8px rgba(0,0,0,0.1)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderBottom: '1px solid var(--border-color, #e0e0e0)',
      }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Templates</h3>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => setShowSaveDialog(true)}
            title="Save current doc as template"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            <Plus size={18} />
          </button>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Save dialog */}
      {showSaveDialog && (
        <div style={{ padding: 16, borderBottom: '1px solid #e0e0e0', background: '#fafafa' }}>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Template name"
            autoFocus
            style={{ width: '100%', padding: '6px 8px', fontSize: 13, border: '1px solid #ddd', borderRadius: 4, marginBottom: 8, boxSizing: 'border-box' }}
          />
          <select
            value={newCategory}
            onChange={e => setNewCategory(e.target.value)}
            style={{ width: '100%', padding: '6px 8px', fontSize: 13, border: '1px solid #ddd', borderRadius: 4, marginBottom: 8 }}
          >
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleSave} style={{
              flex: 1, padding: '6px 12px', background: '#1a73e8', color: '#fff',
              border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13,
            }}>Save</button>
            <button onClick={() => setShowSaveDialog(false)} style={{
              flex: 1, padding: '6px 12px', background: '#f0f0f0',
              border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer', fontSize: 13,
            }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Category tabs */}
      <div style={{ display: 'flex', gap: 4, padding: '8px 16px', flexWrap: 'wrap' }}>
        {['All', ...CATEGORIES].map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            style={{
              padding: '4px 10px', fontSize: 12, borderRadius: 12,
              border: '1px solid #ddd', cursor: 'pointer',
              background: activeCategory === cat ? '#1a73e8' : '#fff',
              color: activeCategory === cat ? '#fff' : '#555',
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Template list */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 16px' }}>
        {filtered.length === 0 ? (
          <p style={{ fontSize: 13, color: '#999', textAlign: 'center', marginTop: 32 }}>
            No templates saved yet. Click + to save the current document as a template.
          </p>
        ) : (
          filtered.map(tpl => (
            <div
              key={tpl.id}
              style={{
                padding: '10px 12px', marginBottom: 8, border: '1px solid #e0e0e0',
                borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
              }}
            >
              <FileText size={18} style={{ color: '#1a73e8', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {tpl.name}
                </div>
                <div style={{ fontSize: 11, color: '#888' }}>
                  {tpl.category} · {new Date(tpl.createdAt).toLocaleDateString()}
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onUseTemplate(tpl.content); }}
                style={{
                  padding: '4px 10px', fontSize: 12, background: '#e8f0fe', color: '#1a73e8',
                  border: 'none', borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                Use
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(tpl.id); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#999' }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TemplateSidebar;
