import { useState, useCallback } from 'react';
import { NodeViewWrapper } from '@tiptap/react';

interface TabItem {
  id: string;
  label: string;
  content: string;
}

function newId() {
  return Math.random().toString(36).slice(2, 8);
}

export function TabsView({ node, updateAttributes, selected }: any) {
  const tabs: TabItem[] = node.attrs.tabs || [];
  const [activeTab, setActiveTab] = useState<string>(tabs[0]?.id || '');
  const [editingLabel, setEditingLabel] = useState<string | null>(null);

  const setTabs = useCallback(
    (t: TabItem[]) => updateAttributes({ tabs: t }),
    [updateAttributes]
  );

  const addTab = () => {
    const newTab = { id: newId(), label: `Tab ${tabs.length + 1}`, content: '' };
    setTabs([...tabs, newTab]);
    setActiveTab(newTab.id);
  };

  const deleteTab = (id: string) => {
    const filtered = tabs.filter((t) => t.id !== id);
    setTabs(filtered);
    if (activeTab === id) setActiveTab(filtered[0]?.id || '');
  };

  const renameTab = (id: string, label: string) => {
    setTabs(tabs.map((t) => (t.id === id ? { ...t, label } : t)));
  };

  const updateContent = (id: string, content: string) => {
    setTabs(tabs.map((t) => (t.id === id ? { ...t, content } : t)));
  };

  const moveTab = (id: string, dir: -1 | 1) => {
    const idx = tabs.findIndex((t) => t.id === id);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= tabs.length) return;
    const copy = [...tabs];
    [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
    setTabs(copy);
  };

  const active = tabs.find((t) => t.id === activeTab);

  return (
    <NodeViewWrapper
      data-tabs-block=""
      style={{
        border: selected ? '2px solid #1976d2' : '1px solid #e0e0e0',
        borderRadius: 8,
        margin: '8px 0',
        background: '#fff',
        overflow: 'hidden',
      }}
    >
      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          background: '#f5f5f5',
          borderBottom: '1px solid #e0e0e0',
          overflowX: 'auto',
        }}
      >
        {tabs.map((tab) => (
          <div
            key={tab.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '6px 12px',
              cursor: 'pointer',
              borderBottom: activeTab === tab.id ? '2px solid #1976d2' : '2px solid transparent',
              background: activeTab === tab.id ? '#fff' : 'transparent',
              fontSize: 13,
              fontWeight: activeTab === tab.id ? 600 : 400,
              gap: 4,
              whiteSpace: 'nowrap',
            }}
            onClick={() => setActiveTab(tab.id)}
          >
            {editingLabel === tab.id ? (
              <input
                value={tab.label}
                onChange={(e) => renameTab(tab.id, e.target.value)}
                onBlur={() => setEditingLabel(null)}
                onKeyDown={(e) => e.key === 'Enter' && setEditingLabel(null)}
                autoFocus
                style={{ fontSize: 13, width: 80, border: '1px solid #ccc', borderRadius: 2, padding: '0 2px' }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span onDoubleClick={() => setEditingLabel(tab.id)}>{tab.label}</span>
            )}
            {activeTab === tab.id && (
              <span style={{ display: 'flex', gap: 2 }}>
                <button onClick={(e) => { e.stopPropagation(); moveTab(tab.id, -1); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: '#888' }}>◀</button>
                <button onClick={(e) => { e.stopPropagation(); moveTab(tab.id, 1); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: '#888' }}>▶</button>
                {tabs.length > 1 && (
                  <button onClick={(e) => { e.stopPropagation(); deleteTab(tab.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#d32f2f' }}>×</button>
                )}
              </span>
            )}
          </div>
        ))}
        <button
          onClick={addTab}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '6px 12px',
            color: '#888',
            fontSize: 14,
          }}
        >
          +
        </button>
      </div>

      {/* Tab content */}
      <div style={{ padding: 12, minHeight: 60 }}>
        {active ? (
          <textarea
            value={active.content}
            onChange={(e) => updateContent(active.id, e.target.value)}
            placeholder="Type content here..."
            style={{
              width: '100%',
              minHeight: 80,
              border: 'none',
              outline: 'none',
              resize: 'vertical',
              fontSize: 14,
              lineHeight: 1.6,
              fontFamily: 'inherit',
            }}
          />
        ) : (
          <div style={{ color: '#999', fontSize: 13 }}>Click + to add a tab</div>
        )}
      </div>
    </NodeViewWrapper>
  );
}
