import { useState, useCallback } from 'react';
import { NodeViewWrapper } from '@tiptap/react';

interface TimelineEvent {
  id: string;
  date: string;
  title: string;
  description: string;
  color: string;
  icon: string;
}

const COLOR_OPTIONS = ['#1976d2', '#d32f2f', '#388e3c', '#f57c00', '#7b1fa2', '#0097a7'];
const ICON_OPTIONS = ['📌', '🎯', '🚀', '✅', '🔥', '💡', '📅', '⭐'];

function newId() {
  return Math.random().toString(36).slice(2, 8);
}

export function TimelineView({ node, updateAttributes, selected }: any) {
  const events: TimelineEvent[] = node.attrs.events || [];
  const [editingId, setEditingId] = useState<string | null>(null);

  const setEvents = useCallback(
    (evts: TimelineEvent[]) => updateAttributes({ events: evts }),
    [updateAttributes]
  );

  const addEvent = () => {
    setEvents([
      ...events,
      { id: newId(), date: new Date().toISOString().slice(0, 10), title: 'New Event', description: '', color: COLOR_OPTIONS[events.length % COLOR_OPTIONS.length], icon: '📌' },
    ]);
  };

  const deleteEvent = (id: string) => {
    setEvents(events.filter((e) => e.id !== id));
  };

  const updateEvent = (id: string, updates: Partial<TimelineEvent>) => {
    setEvents(events.map((e) => (e.id === id ? { ...e, ...updates } : e)));
  };

  return (
    <NodeViewWrapper
      data-timeline=""
      style={{
        border: selected ? '2px solid #1976d2' : '1px solid #e0e0e0',
        borderRadius: 8,
        padding: 16,
        margin: '8px 0',
        background: '#fafafa',
      }}
    >
      <div style={{ position: 'relative', paddingLeft: 0 }}>
        {events.map((evt, i) => {
          const isLeft = i % 2 === 0;
          const editing = editingId === evt.id;
          return (
            <div
              key={evt.id}
              style={{
                display: 'flex',
                flexDirection: isLeft ? 'row' : 'row-reverse',
                alignItems: 'flex-start',
                marginBottom: 16,
                gap: 12,
              }}
            >
              {/* Content */}
              <div
                style={{
                  flex: 1,
                  textAlign: isLeft ? 'right' : 'left',
                  padding: 8,
                }}
              >
                {editing ? (
                  <div style={{ textAlign: 'left' }}>
                    <input value={evt.date} onChange={(e) => updateEvent(evt.id, { date: e.target.value })} type="date" style={{ marginBottom: 4, fontSize: 12 }} />
                    <input value={evt.title} onChange={(e) => updateEvent(evt.id, { title: e.target.value })} style={{ display: 'block', width: '100%', fontSize: 14, fontWeight: 600, border: '1px solid #ccc', borderRadius: 3, padding: 2, marginBottom: 4 }} />
                    <textarea value={evt.description} onChange={(e) => updateEvent(evt.id, { description: e.target.value })} rows={2} placeholder="Description..." style={{ width: '100%', fontSize: 12, border: '1px solid #ccc', borderRadius: 3, padding: 2, marginBottom: 4, resize: 'vertical' }} />
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
                      {COLOR_OPTIONS.map((c) => (
                        <span key={c} onClick={() => updateEvent(evt.id, { color: c })} style={{ width: 16, height: 16, borderRadius: '50%', background: c, cursor: 'pointer', border: evt.color === c ? '2px solid #333' : '2px solid transparent' }} />
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                      {ICON_OPTIONS.map((ic) => (
                        <span key={ic} onClick={() => updateEvent(evt.id, { icon: ic })} style={{ cursor: 'pointer', opacity: evt.icon === ic ? 1 : 0.4 }}>{ic}</span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setEditingId(null)} style={{ fontSize: 11, cursor: 'pointer' }}>Done</button>
                      <button onClick={() => deleteEvent(evt.id)} style={{ fontSize: 11, cursor: 'pointer', color: '#d32f2f' }}>Delete</button>
                    </div>
                  </div>
                ) : (
                  <div onDoubleClick={() => setEditingId(evt.id)} style={{ cursor: 'pointer' }}>
                    <div style={{ fontSize: 11, color: '#888' }}>{evt.date}</div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{evt.title}</div>
                    {evt.description && <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>{evt.description}</div>}
                  </div>
                )}
              </div>

              {/* Node */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: evt.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                    color: '#fff',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  }}
                >
                  {evt.icon}
                </div>
                {i < events.length - 1 && (
                  <div style={{ width: 2, height: 40, background: '#e0e0e0' }} />
                )}
              </div>

              {/* Spacer */}
              <div style={{ flex: 1 }} />
            </div>
          );
        })}
      </div>

      <button
        onClick={addEvent}
        style={{
          padding: '6px 12px',
          background: 'none',
          border: '1px dashed #ccc',
          borderRadius: 4,
          cursor: 'pointer',
          color: '#888',
          fontSize: 12,
          marginTop: 8,
        }}
      >
        + Add Event
      </button>
    </NodeViewWrapper>
  );
}
