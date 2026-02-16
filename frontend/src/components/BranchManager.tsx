import React, { useState, useEffect, useCallback } from 'react';
import { gitAPI } from '../utils/api';
import { GitBranch } from '../types';
import {
  X, GitBranch as BranchIcon, Plus, GitMerge, Trash2, Check,
  AlertTriangle, RefreshCw, ChevronRight
} from 'lucide-react';

interface BranchManagerProps {
  onClose: () => void;
  onBranchChange: () => void;
  hasUnsavedChanges?: boolean;
}

const BranchManager: React.FC<BranchManagerProps> = ({ onClose, onBranchChange, hasUnsavedChanges }) => {
  const [branches, setBranches] = useState<GitBranch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [sourceBranch, setSourceBranch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmSwitch, setConfirmSwitch] = useState<string | null>(null);
  const [merging, setMerging] = useState<string | null>(null);

  const currentBranch = branches.find(b => b.isCurrent);

  const loadBranches = useCallback(async () => {
    try {
      const data = await gitAPI.getBranches();
      setBranches(data);
    } catch {
      setBranches([]);
    }
  }, []);

  useEffect(() => { loadBranches(); }, [loadBranches]);

  const clearMessages = () => { setError(''); setSuccess(''); };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    clearMessages();
    setLoading(true);
    try {
      await gitAPI.createBranch(newName.trim());
      setSuccess(`Branch "${newName.trim()}" created`);
      setNewName('');
      setShowCreate(false);
      await loadBranches();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create branch');
    } finally { setLoading(false); }
  };

  const handleSwitch = async (name: string) => {
    if (hasUnsavedChanges && !confirmSwitch) {
      setConfirmSwitch(name);
      return;
    }
    clearMessages();
    setConfirmSwitch(null);
    setLoading(true);
    try {
      await gitAPI.checkoutBranch(name);
      setSuccess(`Switched to "${name}"`);
      await loadBranches();
      onBranchChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch branch');
    } finally { setLoading(false); }
  };

  const handleMerge = async (name: string) => {
    clearMessages();
    setMerging(null);
    setLoading(true);
    try {
      await gitAPI.mergeBranch(name);
      setSuccess(`Merged "${name}" into "${currentBranch?.name}"`);
      await loadBranches();
      onBranchChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Merge conflict or error');
    } finally { setLoading(false); }
  };

  const handleDelete = async (name: string) => {
    clearMessages();
    setConfirmDelete(null);
    setLoading(true);
    try {
      await gitAPI.deleteBranch(name);
      setSuccess(`Deleted "${name}"`);
      await loadBranches();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete branch');
    } finally { setLoading(false); }
  };

  const otherBranches = branches.filter(b => !b.isCurrent);

  return (
    <div className="branch-manager-overlay" onClick={onClose}>
      <div className="branch-manager-panel" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bm-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BranchIcon size={18} />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Branches</h3>
          </div>
          <button className="bm-icon-btn" onClick={onClose} title="Close"><X size={18} /></button>
        </div>

        {/* Messages */}
        {error && (
          <div className="bm-message bm-error">
            <AlertTriangle size={14} /> {error}
            <button onClick={() => setError('')} className="bm-msg-close"><X size={12} /></button>
          </div>
        )}
        {success && (
          <div className="bm-message bm-success">
            <Check size={14} /> {success}
            <button onClick={() => setSuccess('')} className="bm-msg-close"><X size={12} /></button>
          </div>
        )}

        {/* Current branch */}
        {currentBranch && (
          <div className="bm-current">
            <div className="bm-current-label">Current branch</div>
            <div className="bm-current-name">
              <BranchIcon size={16} style={{ color: '#1a73e8' }} />
              <span>{currentBranch.name}</span>
              <span className="bm-badge">HEAD</span>
            </div>
          </div>
        )}

        {/* Actions bar */}
        <div className="bm-actions">
          <button className="bm-btn bm-btn-primary" onClick={() => { setShowCreate(!showCreate); clearMessages(); }}>
            <Plus size={14} /> New branch
          </button>
          <button className="bm-icon-btn" onClick={loadBranches} title="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Create form */}
        {showCreate && (
          <form className="bm-create-form" onSubmit={handleCreate}>
            <input
              className="bm-input"
              placeholder="Branch name (e.g., draft-v2)"
              value={newName}
              onChange={e => setNewName(e.target.value.replace(/[^a-zA-Z0-9._/-]/g, '-'))}
              autoFocus
            />
            <select
              className="bm-select"
              value={sourceBranch}
              onChange={e => setSourceBranch(e.target.value)}
            >
              <option value="">From: current branch</option>
              {branches.map(b => (
                <option key={b.name} value={b.name}>From: {b.name}</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="bm-btn bm-btn-primary" disabled={loading || !newName.trim()}>
                Create
              </button>
              <button type="button" className="bm-btn" onClick={() => setShowCreate(false)}>Cancel</button>
            </div>
          </form>
        )}

        {/* Branch list */}
        <div className="bm-list">
          {otherBranches.length === 0 && (
            <div className="bm-empty">No other branches. Create one to start working on a draft.</div>
          )}
          {otherBranches.map(b => (
            <div key={b.name} className="bm-branch-item">
              <div className="bm-branch-info">
                <BranchIcon size={14} style={{ color: '#5f6368', flexShrink: 0 }} />
                <span className="bm-branch-name">{b.name}</span>
                <span className="bm-branch-hash">{b.hash?.slice(0, 7)}</span>
              </div>
              <div className="bm-branch-actions">
                {confirmSwitch === b.name ? (
                  <div className="bm-confirm">
                    <span style={{ fontSize: 11, color: '#e37400' }}>Unsaved changes will be lost</span>
                    <button className="bm-btn bm-btn-warn" onClick={() => handleSwitch(b.name)}>Switch anyway</button>
                    <button className="bm-btn" onClick={() => setConfirmSwitch(null)}>Cancel</button>
                  </div>
                ) : confirmDelete === b.name ? (
                  <div className="bm-confirm">
                    <span style={{ fontSize: 11, color: '#d93025' }}>Delete this branch?</span>
                    <button className="bm-btn bm-btn-danger" onClick={() => handleDelete(b.name)}>Delete</button>
                    <button className="bm-btn" onClick={() => setConfirmDelete(null)}>Cancel</button>
                  </div>
                ) : merging === b.name ? (
                  <div className="bm-confirm">
                    <span style={{ fontSize: 11 }}>Merge into {currentBranch?.name}?</span>
                    <button className="bm-btn bm-btn-primary" onClick={() => handleMerge(b.name)}>Merge</button>
                    <button className="bm-btn" onClick={() => setMerging(null)}>Cancel</button>
                  </div>
                ) : (
                  <>
                    <button className="bm-btn bm-btn-sm" onClick={() => handleSwitch(b.name)} title="Switch to this branch">
                      <ChevronRight size={12} /> Switch
                    </button>
                    <button className="bm-btn bm-btn-sm" onClick={() => setMerging(b.name)} title="Merge into current">
                      <GitMerge size={12} /> Merge
                    </button>
                    <button className="bm-icon-btn bm-btn-sm-icon" onClick={() => setConfirmDelete(b.name)} title="Delete branch">
                      <Trash2 size={12} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Simple branch graph */}
        {branches.length > 1 && (
          <div className="bm-graph">
            <div className="bm-graph-label">Branch timeline</div>
            <svg width="100%" height={Math.max(60, branches.length * 32 + 20)} viewBox={`0 0 300 ${Math.max(60, branches.length * 32 + 20)}`}>
              {branches.map((b, i) => {
                const y = 16 + i * 32;
                const isCurrent = b.isCurrent;
                return (
                  <g key={b.name}>
                    {/* Branch line */}
                    <line x1={24} y1={y} x2={280} y2={y} stroke={isCurrent ? '#1a73e8' : '#dadce0'} strokeWidth={2} />
                    {/* Branch dot */}
                    <circle cx={24} cy={y} r={6} fill={isCurrent ? '#1a73e8' : '#5f6368'} />
                    {/* Connect to main */}
                    {!isCurrent && (
                      <line x1={24} y1={16} x2={24} y2={y} stroke="#dadce0" strokeWidth={1} strokeDasharray="3,3" />
                    )}
                    {/* HEAD marker */}
                    {isCurrent && (
                      <circle cx={280} cy={y} r={4} fill="#1a73e8" stroke="#fff" strokeWidth={2} />
                    )}
                    {/* Label */}
                    <text x={36} y={y + 4} fontSize={11} fill={isCurrent ? '#1a73e8' : '#5f6368'} fontWeight={isCurrent ? 600 : 400}>
                      {b.name}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        )}

        {loading && <div className="bm-loading">Working...</div>}
      </div>

      <style>{`
        .branch-manager-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 1000;
          display: flex; align-items: flex-start; justify-content: center; padding-top: 60px;
        }
        .branch-manager-panel {
          background: #fff; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.18);
          width: 480px; max-height: 80vh; overflow-y: auto; padding: 0;
          font-family: 'Google Sans', -apple-system, sans-serif;
        }
        .bm-header {
          display: flex; justify-content: space-between; align-items: center;
          padding: 16px 20px; border-bottom: 1px solid #e8eaed;
        }
        .bm-message {
          display: flex; align-items: center; gap: 8; padding: 8px 20px; font-size: 13px;
        }
        .bm-error { background: #fce8e6; color: #d93025; }
        .bm-success { background: #e6f4ea; color: #137333; }
        .bm-msg-close { background: none; border: none; cursor: pointer; margin-left: auto; opacity: 0.6; }
        .bm-current {
          padding: 16px 20px; background: #f8f9fa; border-bottom: 1px solid #e8eaed;
        }
        .bm-current-label { font-size: 11px; color: #5f6368; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
        .bm-current-name {
          display: flex; align-items: center; gap: 8; font-size: 15px; font-weight: 600; color: #1a73e8;
        }
        .bm-badge {
          font-size: 10px; background: #1a73e8; color: #fff; padding: 1px 6px;
          border-radius: 4px; font-weight: 500;
        }
        .bm-actions {
          display: flex; align-items: center; gap: 8; padding: 12px 20px;
          border-bottom: 1px solid #e8eaed;
        }
        .bm-btn {
          display: inline-flex; align-items: center; gap: 4; padding: 6px 12px;
          border: 1px solid #dadce0; border-radius: 6px; background: #fff;
          font-size: 13px; cursor: pointer; color: #3c4043; transition: all 0.15s;
        }
        .bm-btn:hover { background: #f1f3f4; }
        .bm-btn-primary { background: #1a73e8; color: #fff; border-color: #1a73e8; }
        .bm-btn-primary:hover { background: #1557b0; }
        .bm-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .bm-btn-warn { background: #e37400; color: #fff; border-color: #e37400; }
        .bm-btn-danger { background: #d93025; color: #fff; border-color: #d93025; }
        .bm-btn-sm { padding: 3px 8px; font-size: 12px; }
        .bm-icon-btn {
          display: inline-flex; align-items: center; justify-content: center;
          width: 28px; height: 28px; border: none; border-radius: 6px;
          background: transparent; cursor: pointer; color: #5f6368;
        }
        .bm-icon-btn:hover { background: #f1f3f4; }
        .bm-btn-sm-icon { width: 24px; height: 24px; }
        .bm-create-form {
          padding: 12px 20px; display: flex; flex-direction: column; gap: 8;
          border-bottom: 1px solid #e8eaed; background: #f8f9fa;
        }
        .bm-input, .bm-select {
          padding: 8px 12px; border: 1px solid #dadce0; border-radius: 6px;
          font-size: 13px; outline: none;
        }
        .bm-input:focus, .bm-select:focus { border-color: #1a73e8; }
        .bm-list { padding: 8px 0; }
        .bm-empty { padding: 20px; text-align: center; color: #5f6368; font-size: 13px; }
        .bm-branch-item {
          padding: 8px 20px; display: flex; flex-direction: column; gap: 6;
          border-bottom: 1px solid #f1f3f4;
        }
        .bm-branch-item:hover { background: #f8f9fa; }
        .bm-branch-info { display: flex; align-items: center; gap: 8; }
        .bm-branch-name { font-size: 14px; font-weight: 500; color: #202124; }
        .bm-branch-hash { font-size: 11px; color: #80868b; font-family: monospace; }
        .bm-branch-actions { display: flex; align-items: center; gap: 6; margin-left: 22px; }
        .bm-confirm { display: flex; align-items: center; gap: 6; flex-wrap: wrap; }
        .bm-graph { padding: 12px 20px; border-top: 1px solid #e8eaed; }
        .bm-graph-label { font-size: 11px; color: #5f6368; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
        .bm-loading { padding: 8px 20px; font-size: 12px; color: #5f6368; text-align: center; }
      `}</style>
    </div>
  );
};

export default BranchManager;
