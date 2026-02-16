import React, { useState, useEffect, useMemo, memo } from 'react';
import { X, Plus, Folder, FileText, Search, Trash2, Copy, Check } from 'lucide-react';

interface Snippet {
  id: string;
  name: string;
  content: string;
  category: string;
  shortcut?: string;
}

interface SnippetManagerProps {
  editor: any;
  onClose: () => void;
}

const STORAGE_KEY = 'md-office-snippets';

const BUILT_IN_SNIPPETS: Snippet[] = [
  {
    id: 'builtin-signature',
    name: 'Signature',
    content: '\n\nBest regards,\n$cursor\n\n---\n',
    category: 'General',
    shortcut: 'sig',
  },
  {
    id: 'builtin-meeting',
    name: 'Meeting Notes',
    content: '# Meeting Notes — $date\n\n**Time:** $time\n**Attendees:** \n\n## Agenda\n\n1. $cursor\n\n## Action Items\n\n- [ ] \n\n## Notes\n\n',
    category: 'Templates',
    shortcut: 'meeting',
  },
  {
    id: 'builtin-email',
    name: 'Email Response',
    content: 'Hi,\n\nThank you for reaching out. $cursor\n\nPlease let me know if you have any questions.\n\nBest regards,\n',
    category: 'Templates',
    shortcut: 'email',
  },
  {
    id: 'builtin-code',
    name: 'Code Block',
    content: '```\n$cursor\n```\n',
    category: 'General',
    shortcut: 'code',
  },
  {
    id: 'builtin-todo',
    name: 'Todo List',
    content: '## TODO — $date\n\n- [ ] $cursor\n- [ ] \n- [ ] \n',
    category: 'Templates',
    shortcut: 'todo',
  },
];

function loadSnippets(): Snippet[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function saveSnippets(snippets: Snippet[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snippets));
}

function processVariables(content: string, fileName?: string): { text: string; cursorOffset: number } {
  const now = new Date();
  let text = content
    .replace(/\$date/g, now.toLocaleDateString())
    .replace(/\$time/g, now.toLocaleTimeString())
    .replace(/\$filename/g, fileName || 'untitled');

  const cursorIdx = text.indexOf('$cursor');
  if (cursorIdx !== -1) {
    text = text.replace('$cursor', '');
  }
  return { text, cursorOffset: cursorIdx };
}

const SnippetManager: React.FC<SnippetManagerProps> = ({ editor, onClose }) => {
  const [userSnippets, setUserSnippets] = useState<Snippet[]>(() => loadSnippets());
  const [filter, setFilter] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState('General');
  const [newShortcut, setNewShortcut] = useState('');

  const allSnippets = useMemo(() => [...BUILT_IN_SNIPPETS, ...userSnippets], [userSnippets]);

  const categories = useMemo(() => {
    const cats = new Set(allSnippets.map(s => s.category));
    return Array.from(cats).sort();
  }, [allSnippets]);

  const filtered = useMemo(() => {
    return allSnippets.filter(s => {
      if (selectedCategory && s.category !== selectedCategory) return false;
      if (filter) {
        const q = filter.toLowerCase();
        return s.name.toLowerCase().includes(q) || s.content.toLowerCase().includes(q) || (s.shortcut && s.shortcut.toLowerCase().includes(q));
      }
      return true;
    });
  }, [allSnippets, filter, selectedCategory]);

  // Save user snippets when they change
  useEffect(() => { saveSnippets(userSnippets); }, [userSnippets]);

  const insertSnippet = (snippet: Snippet) => {
    if (!editor) return;
    const { text } = processVariables(snippet.content);
    editor.chain().focus().insertContent(text).run();
  };

  const addSnippet = () => {
    if (!newName.trim() || !newContent.trim()) return;
    const snippet: Snippet = {
      id: `user-${Date.now()}`,
      name: newName.trim(),
      content: newContent,
      category: newCategory || 'General',
      shortcut: newShortcut.trim() || undefined,
    };
    setUserSnippets(prev => [...prev, snippet]);
    setShowAdd(false);
    setNewName('');
    setNewContent('');
    setNewShortcut('');
  };

  const deleteSnippet = (id: string) => {
    setUserSnippets(prev => prev.filter(s => s.id !== id));
  };

  const saveFromSelection = () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    if (from === to) return;
    const selectedText = editor.state.doc.textBetween(from, to, '\n');
    setNewContent(selectedText);
    setShowAdd(true);
  };

  // Register slash-command handler for snippets
  useEffect(() => {
    if (!editor) return;

    const handleKeyDown = (view: any, event: KeyboardEvent) => {
      if (event.key !== 'Tab') return false;
      const { state } = view;
      const { $from } = state.selection;
      const textBefore = $from.parent.textBetween(0, $from.parentOffset);
      const match = textBefore.match(/\/(\w+)$/);
      if (!match) return false;

      const shortcutName = match[1].toLowerCase();
      const snippet = allSnippets.find(s => s.shortcut?.toLowerCase() === shortcutName);
      if (!snippet) return false;

      event.preventDefault();
      // Delete the /shortcut text
      const deleteFrom = $from.pos - match[0].length;
      const { tr } = state;
      tr.delete(deleteFrom, $from.pos);
      view.dispatch(tr);

      // Insert snippet content
      setTimeout(() => {
        const { text } = processVariables(snippet.content);
        editor.chain().focus().insertContent(text).run();
      }, 0);

      return true;
    };

    // Add to editor's keydown handler
    const plugin = editor.view.dom;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        const result = handleKeyDown(editor.view, e);
        if (result) e.preventDefault();
      }
    };
    plugin.addEventListener('keydown', handler, true);
    return () => plugin.removeEventListener('keydown', handler, true);
  }, [editor, allSnippets]);

  const isBuiltIn = (id: string) => id.startsWith('builtin-');

  return (
    <div style={{
      position: 'fixed',
      top: 80,
      right: 16,
      width: 400,
      maxHeight: 'calc(100vh - 120px)',
      background: 'var(--bg-primary, white)',
      border: '1px solid var(--border-color, #ddd)',
      borderRadius: 10,
      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-color, #eee)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14 }}>
          <Copy size={16} /> Snippets
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={saveFromSelection} title="Save selection as snippet" style={iconBtnStyle}>
            <Plus size={14} />
          </button>
          <button onClick={onClose} style={iconBtnStyle}><X size={16} /></button>
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color, #eee)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-secondary, #f5f5f5)', borderRadius: 6, padding: '4px 8px' }}>
          <Search size={14} style={{ opacity: 0.5 }} />
          <input
            type="text"
            placeholder="Search snippets or type /name + Tab..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 12, width: '100%', padding: '4px 0' }}
          />
        </div>
      </div>

      {/* Categories */}
      <div style={{ display: 'flex', gap: 4, padding: '8px 12px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setSelectedCategory(null)}
          style={catBtnStyle(!selectedCategory)}
        >
          All
        </button>
        {categories.map(cat => (
          <button key={cat} onClick={() => setSelectedCategory(cat)} style={catBtnStyle(selectedCategory === cat)}>
            <Folder size={10} /> {cat}
          </button>
        ))}
      </div>

      {/* Add Snippet Form */}
      {showAdd && (
        <div style={{ padding: '12px', borderBottom: '1px solid var(--border-color, #eee)', background: 'var(--bg-secondary, #f8f9fa)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>New Snippet</div>
          <input
            type="text"
            placeholder="Name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            style={inputStyle}
          />
          <textarea
            placeholder="Content (use $cursor, $date, $time, $filename)"
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
            rows={3}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: 11 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              placeholder="Category"
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
            <input
              type="text"
              placeholder="Shortcut (e.g. sig)"
              value={newShortcut}
              onChange={e => setNewShortcut(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={addSnippet} style={{ ...btnStyle, background: '#4285f4', color: 'white' }}>
              <Check size={12} /> Save
            </button>
            <button onClick={() => setShowAdd(false)} style={btnStyle}>Cancel</button>
          </div>
        </div>
      )}

      {/* Snippet List */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px' }}>
        {!showAdd && (
          <button onClick={() => setShowAdd(true)} style={{ ...btnStyle, width: '100%', marginBottom: 8, justifyContent: 'center' }}>
            <Plus size={14} /> Add Snippet
          </button>
        )}
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: '#888', fontSize: 13 }}>
            No snippets found
          </div>
        ) : (
          filtered.map(snippet => (
            <div
              key={snippet.id}
              style={{
                padding: '10px 12px',
                borderRadius: 6,
                border: '1px solid var(--border-color, #e0e0e0)',
                marginBottom: 6,
                cursor: 'pointer',
                transition: 'background 0.15s',
                fontSize: 13,
              }}
              onClick={() => insertSnippet(snippet)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
                  <FileText size={14} style={{ color: '#4285f4' }} />
                  {snippet.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {snippet.shortcut && (
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--bg-secondary, #eee)', fontFamily: 'monospace' }}>
                      /{snippet.shortcut}
                    </span>
                  )}
                  {!isBuiltIn(snippet.id) && (
                    <button
                      onClick={e => { e.stopPropagation(); deleteSnippet(snippet.id); }}
                      style={{ ...iconBtnStyle, color: '#d32f2f' }}
                      title="Delete snippet"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
              <div style={{ fontSize: 11, color: '#888', fontFamily: 'monospace', whiteSpace: 'pre', overflow: 'hidden', textOverflow: 'ellipsis', maxHeight: 40 }}>
                {snippet.content.slice(0, 100)}
              </div>
              <div style={{ fontSize: 10, color: '#aaa', marginTop: 4 }}>
                {snippet.category} {isBuiltIn(snippet.id) ? '• Built-in' : ''}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const iconBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: 4,
  borderRadius: 4,
  display: 'flex',
  alignItems: 'center',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  fontSize: 12,
  border: '1px solid var(--border-color, #ddd)',
  borderRadius: 4,
  marginBottom: 6,
  outline: 'none',
  boxSizing: 'border-box',
};

const btnStyle: React.CSSProperties = {
  padding: '6px 12px',
  fontSize: 12,
  borderRadius: 6,
  border: '1px solid var(--border-color, #ddd)',
  background: 'var(--bg-secondary, #f5f5f5)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
};

const catBtnStyle = (active: boolean): React.CSSProperties => ({
  padding: '3px 8px',
  fontSize: 11,
  borderRadius: 10,
  border: active ? '1px solid #4285f4' : '1px solid var(--border-color, #ddd)',
  background: active ? '#e8f0fe' : 'transparent',
  color: active ? '#4285f4' : 'inherit',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
});

export default memo(SnippetManager);
