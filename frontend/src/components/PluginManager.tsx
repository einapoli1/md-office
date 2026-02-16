import React, { useState, useEffect } from 'react';
import { X, Search, Power, PowerOff } from 'lucide-react';
import { pluginManager, PluginState } from '../lib/pluginSystem';

interface PluginManagerProps {
  onClose: () => void;
}

const PluginManager: React.FC<PluginManagerProps> = ({ onClose }) => {
  const [plugins, setPlugins] = useState<PluginState[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const refresh = () => setPlugins([...pluginManager.getPlugins()]);
    refresh();
    const unsub = pluginManager.subscribe(refresh);
    return unsub;
  }, []);

  const filtered = plugins.filter(p =>
    !search || p.meta.name.toLowerCase().includes(search.toLowerCase()) ||
    p.meta.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-primary, #fff)', borderRadius: 12, width: 520, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', color: 'var(--text-primary, #202124)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border-color, #e0e0e0)' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Extensions</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'inherit' }}><X size={18} /></button>
        </div>

        {/* Search */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-color, #e0e0e0)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-secondary, #f1f3f4)', borderRadius: 8, padding: '6px 12px' }}>
            <Search size={14} style={{ opacity: 0.5 }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search extensions..." style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, fontSize: 14, color: 'inherit' }} />
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 32, opacity: 0.5, fontSize: 14 }}>No extensions found</div>
          )}
          {filtered.map(p => (
            <div key={p.meta.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--border-color, #f0f0f0)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{p.meta.name}</span>
                  <span style={{ fontSize: 11, opacity: 0.5 }}>v{p.meta.version}</span>
                </div>
                <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>by {p.meta.author}</div>
                <div style={{ fontSize: 13, marginTop: 4, lineHeight: 1.4 }}>{p.meta.description}</div>
                {p.enabled && p.registeredSettings.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
                    {p.registeredSettings.map(s => (
                      <div key={s.key} style={{ marginTop: 2 }}>
                        ⚙ {s.label}: <strong>{String(p.settings[s.key] ?? s.default)}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => pluginManager.toggle(p.meta.id)}
                title={p.enabled ? 'Disable' : 'Enable'}
                style={{
                  background: p.enabled ? '#1a73e8' : 'var(--bg-secondary, #e0e0e0)',
                  color: p.enabled ? '#fff' : 'var(--text-primary, #666)',
                  border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 500, flexShrink: 0,
                }}
              >
                {p.enabled ? <Power size={13} /> : <PowerOff size={13} />}
                {p.enabled ? 'On' : 'Off'}
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-color, #e0e0e0)', fontSize: 12, opacity: 0.5, textAlign: 'center' }}>
          {plugins.length} extension{plugins.length !== 1 ? 's' : ''} installed · {plugins.filter(p => p.enabled).length} active
        </div>
      </div>
    </div>
  );
};

export default PluginManager;
