import { useState, useEffect, useCallback } from 'react';

interface APIKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsed?: string;
  revokedAt?: string;
}

interface WebhookSub {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: string;
}

interface DeliveryLog {
  id: string;
  subscriptionId: string;
  event: string;
  url: string;
  statusCode: number;
  success: boolean;
  attempt: number;
  error?: string;
  timestamp: string;
}

const EVENTS = [
  'doc.created', 'doc.updated', 'doc.deleted',
  'sheet.updated', 'slide.updated', 'db.updated',
];

const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'apikeys' | 'webhooks'>('apikeys');

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: '#fff', borderRadius: 8, width: 700, maxHeight: '80vh',
        overflow: 'auto', padding: 24, boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>Settings</h2>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <TabBtn active={tab === 'apikeys'} onClick={() => setTab('apikeys')}>API Keys</TabBtn>
          <TabBtn active={tab === 'webhooks'} onClick={() => setTab('webhooks')}>Webhooks</TabBtn>
        </div>

        {tab === 'apikeys' ? <APIKeysTab /> : <WebhooksTab />}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 16px', borderRadius: 4, border: '1px solid #ddd', cursor: 'pointer',
        background: active ? '#1a73e8' : '#fff', color: active ? '#fff' : '#333',
      }}
    >
      {children}
    </button>
  );
}

function APIKeysTab() {
  const [keys, setKeys] = useState<APIKey[]>([]);
  const [newName, setNewName] = useState('');
  const [newKey, setNewKey] = useState('');
  const [loading, setLoading] = useState(false);

  const loadKeys = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/keys', { headers: getHeaders() });
      const data = await res.json();
      if (data.data) setKeys(data.data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadKeys(); }, [loadKeys]);

  const createKey = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/v1/keys', {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ name: newName }),
      });
      const data = await res.json();
      if (data.data?.key) {
        setNewKey(data.data.key);
        setNewName('');
        loadKeys();
      }
    } finally { setLoading(false); }
  };

  const revokeKey = async (id: string) => {
    await fetch(`/api/v1/keys/${id}`, { method: 'DELETE', headers: getHeaders() });
    loadKeys();
  };

  return (
    <div>
      <p style={{ color: '#666', fontSize: 13, marginBottom: 12 }}>
        API keys allow programmatic access to the <code>/api/v1/</code> endpoints.
      </p>

      {newKey && (
        <div style={{ background: '#e8f5e9', padding: 12, borderRadius: 4, marginBottom: 12, wordBreak: 'break-all' }}>
          <strong>New key (copy now, won't be shown again):</strong><br />
          <code>{newKey}</code>
          <button onClick={() => { navigator.clipboard.writeText(newKey); }} style={{ marginLeft: 8, cursor: 'pointer' }}>Copy</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          placeholder="Key name" value={newName} onChange={e => setNewName(e.target.value)}
          style={{ flex: 1, padding: '6px 10px', border: '1px solid #ddd', borderRadius: 4 }}
          onKeyDown={e => e.key === 'Enter' && createKey()}
        />
        <button onClick={createKey} disabled={loading} style={{
          padding: '6px 16px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer',
        }}>Generate</button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #ddd' }}>
            <th style={{ textAlign: 'left', padding: 6 }}>Name</th>
            <th style={{ textAlign: 'left', padding: 6 }}>Prefix</th>
            <th style={{ textAlign: 'left', padding: 6 }}>Created</th>
            <th style={{ textAlign: 'left', padding: 6 }}>Last Used</th>
            <th style={{ padding: 6 }}></th>
          </tr>
        </thead>
        <tbody>
          {keys.filter(k => !k.revokedAt).map(k => (
            <tr key={k.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: 6 }}>{k.name}</td>
              <td style={{ padding: 6 }}><code>{k.prefix}...</code></td>
              <td style={{ padding: 6 }}>{new Date(k.createdAt).toLocaleDateString()}</td>
              <td style={{ padding: 6 }}>{k.lastUsed ? new Date(k.lastUsed).toLocaleDateString() : '—'}</td>
              <td style={{ padding: 6 }}>
                <button onClick={() => revokeKey(k.id)} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer' }}>Revoke</button>
              </td>
            </tr>
          ))}
          {keys.filter(k => !k.revokedAt).length === 0 && (
            <tr><td colSpan={5} style={{ padding: 12, textAlign: 'center', color: '#999' }}>No API keys yet</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function WebhooksTab() {
  const [subs, setSubs] = useState<WebhookSub[]>([]);
  const [logs, setLogs] = useState<DeliveryLog[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [formUrl, setFormUrl] = useState('');
  const [formSecret, setFormSecret] = useState('');
  const [formEvents, setFormEvents] = useState<string[]>([]);

  const loadSubs = useCallback(async () => {
    try {
      const res = await fetch('/api/webhooks', { headers: getHeaders() });
      const data = await res.json();
      if (data.data) setSubs(data.data);
    } catch { /* ignore */ }
  }, []);

  const loadLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/webhooks/logs/recent?limit=50', { headers: getHeaders() });
      const data = await res.json();
      if (data.data) setLogs(data.data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadSubs(); }, [loadSubs]);

  const createSub = async () => {
    if (!formUrl || formEvents.length === 0) return;
    await fetch('/api/webhooks', {
      method: 'POST', headers: getHeaders(),
      body: JSON.stringify({ url: formUrl, events: formEvents, secret: formSecret }),
    });
    setShowForm(false);
    setFormUrl('');
    setFormSecret('');
    setFormEvents([]);
    loadSubs();
  };

  const deleteSub = async (id: string) => {
    await fetch(`/api/webhooks/${id}`, { method: 'DELETE', headers: getHeaders() });
    loadSubs();
  };

  const toggleEvent = (e: string) => {
    setFormEvents(prev => prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e]);
  };

  return (
    <div>
      <p style={{ color: '#666', fontSize: 13, marginBottom: 12 }}>
        Webhooks notify external services when documents change.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={() => setShowForm(!showForm)} style={{
          padding: '6px 16px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer',
        }}>+ Add Webhook</button>
        <button onClick={() => { setShowLogs(!showLogs); if (!showLogs) loadLogs(); }} style={{
          padding: '6px 16px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer',
        }}>{showLogs ? 'Hide' : 'Show'} Delivery Log</button>
      </div>

      {showForm && (
        <div style={{ background: '#f9f9f9', padding: 12, borderRadius: 4, marginBottom: 16 }}>
          <input
            placeholder="Webhook URL" value={formUrl} onChange={e => setFormUrl(e.target.value)}
            style={{ width: '100%', padding: '6px 10px', border: '1px solid #ddd', borderRadius: 4, marginBottom: 8 }}
          />
          <input
            placeholder="Secret (optional)" value={formSecret} onChange={e => setFormSecret(e.target.value)}
            style={{ width: '100%', padding: '6px 10px', border: '1px solid #ddd', borderRadius: 4, marginBottom: 8 }}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {EVENTS.map(e => (
              <label key={e} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                <input type="checkbox" checked={formEvents.includes(e)} onChange={() => toggleEvent(e)} />
                {e}
              </label>
            ))}
          </div>
          <button onClick={createSub} style={{
            padding: '6px 16px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer',
          }}>Create</button>
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #ddd' }}>
            <th style={{ textAlign: 'left', padding: 6 }}>URL</th>
            <th style={{ textAlign: 'left', padding: 6 }}>Events</th>
            <th style={{ textAlign: 'left', padding: 6 }}>Active</th>
            <th style={{ padding: 6 }}></th>
          </tr>
        </thead>
        <tbody>
          {subs.map(s => (
            <tr key={s.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: 6, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.url}</td>
              <td style={{ padding: 6, fontSize: 11 }}>{s.events.join(', ')}</td>
              <td style={{ padding: 6 }}>{s.active ? '✅' : '❌'}</td>
              <td style={{ padding: 6 }}>
                <button onClick={() => deleteSub(s.id)} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer' }}>Delete</button>
              </td>
            </tr>
          ))}
          {subs.length === 0 && (
            <tr><td colSpan={4} style={{ padding: 12, textAlign: 'center', color: '#999' }}>No webhooks configured</td></tr>
          )}
        </tbody>
      </table>

      {showLogs && (
        <div style={{ marginTop: 16 }}>
          <h3 style={{ fontSize: 14, marginBottom: 8 }}>Recent Deliveries</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #ddd' }}>
                <th style={{ textAlign: 'left', padding: 4 }}>Time</th>
                <th style={{ textAlign: 'left', padding: 4 }}>Event</th>
                <th style={{ textAlign: 'left', padding: 4 }}>Status</th>
                <th style={{ textAlign: 'left', padding: 4 }}>Attempt</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id} style={{ borderBottom: '1px solid #eee', background: l.success ? '#f0fff0' : '#fff0f0' }}>
                  <td style={{ padding: 4 }}>{new Date(l.timestamp).toLocaleString()}</td>
                  <td style={{ padding: 4 }}>{l.event}</td>
                  <td style={{ padding: 4 }}>{l.statusCode || l.error}</td>
                  <td style={{ padding: 4 }}>{l.attempt}/3</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={4} style={{ padding: 8, textAlign: 'center', color: '#999' }}>No deliveries yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
