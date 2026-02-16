import { useState, useCallback } from 'react';
import { NodeViewWrapper } from '@tiptap/react';

interface KanbanCard {
  id: string;
  title: string;
  description: string;
  label: string;
}

interface KanbanColumn {
  id: string;
  title: string;
  cards: KanbanCard[];
}

const LABEL_COLORS: Record<string, string> = {
  red: '#ffcdd2',
  blue: '#bbdefb',
  green: '#c8e6c9',
  yellow: '#fff9c4',
  purple: '#e1bee7',
  orange: '#ffe0b2',
  '': 'transparent',
};

function newId() {
  return Math.random().toString(36).slice(2, 8);
}

export function KanbanView({ node, updateAttributes, selected }: any) {
  const columns: KanbanColumn[] = node.attrs.columns || [];
  const [dragCard, setDragCard] = useState<{ colId: string; cardId: string } | null>(null);
  const [editingCard, setEditingCard] = useState<string | null>(null);

  const setColumns = useCallback(
    (cols: KanbanColumn[]) => updateAttributes({ columns: cols }),
    [updateAttributes]
  );

  const addColumn = () => {
    setColumns([...columns, { id: newId(), title: 'New Column', cards: [] }]);
  };

  const deleteColumn = (colId: string) => {
    setColumns(columns.filter((c) => c.id !== colId));
  };

  const renameColumn = (colId: string, title: string) => {
    setColumns(columns.map((c) => (c.id === colId ? { ...c, title } : c)));
  };

  const addCard = (colId: string) => {
    setColumns(
      columns.map((c) =>
        c.id === colId
          ? { ...c, cards: [...c.cards, { id: newId(), title: 'New Card', description: '', label: '' }] }
          : c
      )
    );
  };

  const deleteCard = (colId: string, cardId: string) => {
    setColumns(
      columns.map((c) =>
        c.id === colId ? { ...c, cards: c.cards.filter((cd) => cd.id !== cardId) } : c
      )
    );
  };

  const updateCard = (colId: string, cardId: string, updates: Partial<KanbanCard>) => {
    setColumns(
      columns.map((c) =>
        c.id === colId
          ? { ...c, cards: c.cards.map((cd) => (cd.id === cardId ? { ...cd, ...updates } : cd)) }
          : c
      )
    );
  };

  const handleDragStart = (colId: string, cardId: string) => {
    setDragCard({ colId, cardId });
  };

  const handleDrop = (targetColId: string) => {
    if (!dragCard) return;
    const srcCol = columns.find((c) => c.id === dragCard.colId);
    const card = srcCol?.cards.find((cd) => cd.id === dragCard.cardId);
    if (!card) return;

    setColumns(
      columns.map((c) => {
        if (c.id === dragCard.colId) {
          return { ...c, cards: c.cards.filter((cd) => cd.id !== dragCard.cardId) };
        }
        if (c.id === targetColId) {
          return { ...c, cards: [...c.cards, card] };
        }
        return c;
      })
    );
    setDragCard(null);
  };

  return (
    <NodeViewWrapper
      data-kanban-board=""
      style={{
        border: selected ? '2px solid #1976d2' : '1px solid #e0e0e0',
        borderRadius: 8,
        padding: 12,
        margin: '8px 0',
        background: '#fafafa',
      }}
    >
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', minHeight: 120 }}>
        {columns.map((col) => (
          <div
            key={col.id}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(col.id)}
            style={{
              minWidth: 200,
              maxWidth: 280,
              flex: '1 0 200px',
              background: '#fff',
              borderRadius: 6,
              padding: 8,
              border: '1px solid #e0e0e0',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <input
                value={col.title}
                onChange={(e) => renameColumn(col.id, e.target.value)}
                style={{
                  fontWeight: 700,
                  fontSize: 14,
                  border: 'none',
                  background: 'transparent',
                  width: '100%',
                  outline: 'none',
                }}
              />
              <button
                onClick={() => deleteColumn(col.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', fontSize: 14 }}
              >
                ×
              </button>
            </div>

            {col.cards.map((card) => (
              <div
                key={card.id}
                draggable
                onDragStart={() => handleDragStart(col.id, card.id)}
                style={{
                  background: LABEL_COLORS[card.label] || '#fff',
                  border: '1px solid #e0e0e0',
                  borderRadius: 4,
                  padding: 8,
                  marginBottom: 6,
                  cursor: 'grab',
                  fontSize: 13,
                }}
              >
                {editingCard === card.id ? (
                  <div>
                    <input
                      value={card.title}
                      onChange={(e) => updateCard(col.id, card.id, { title: e.target.value })}
                      onBlur={() => setEditingCard(null)}
                      onKeyDown={(e) => e.key === 'Enter' && setEditingCard(null)}
                      autoFocus
                      style={{ width: '100%', border: '1px solid #ccc', borderRadius: 3, padding: 2, fontSize: 13, marginBottom: 4 }}
                    />
                    <textarea
                      value={card.description}
                      onChange={(e) => updateCard(col.id, card.id, { description: e.target.value })}
                      placeholder="Description..."
                      rows={2}
                      style={{ width: '100%', border: '1px solid #ccc', borderRadius: 3, padding: 2, fontSize: 12, resize: 'vertical' }}
                    />
                    <select
                      value={card.label}
                      onChange={(e) => updateCard(col.id, card.id, { label: e.target.value })}
                      style={{ fontSize: 11, marginTop: 4 }}
                    >
                      <option value="">No label</option>
                      {Object.keys(LABEL_COLORS).filter(Boolean).map((l) => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div onDoubleClick={() => setEditingCard(card.id)}>
                      <div style={{ fontWeight: 500 }}>{card.title}</div>
                      {card.description && (
                        <div style={{ color: '#666', fontSize: 11, marginTop: 2 }}>{card.description}</div>
                      )}
                    </div>
                    <button
                      onClick={() => deleteCard(col.id, card.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', fontSize: 12, flexShrink: 0 }}
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
            ))}

            <button
              onClick={() => addCard(col.id)}
              style={{
                width: '100%',
                padding: '4px 8px',
                background: 'none',
                border: '1px dashed #ccc',
                borderRadius: 4,
                cursor: 'pointer',
                color: '#888',
                fontSize: 12,
              }}
            >
              + Add Card
            </button>
          </div>
        ))}

        <button
          onClick={addColumn}
          style={{
            minWidth: 120,
            padding: '8px 16px',
            background: 'none',
            border: '2px dashed #ccc',
            borderRadius: 6,
            cursor: 'pointer',
            color: '#888',
            alignSelf: 'flex-start',
          }}
        >
          + Column
        </button>
      </div>
    </NodeViewWrapper>
  );
}
