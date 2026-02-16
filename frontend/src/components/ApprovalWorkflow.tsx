import React, { useState } from 'react';
import { X, UserPlus, Check, XCircle, AlertCircle, Clock, Shield, FileCheck } from 'lucide-react';

export type DocumentStatus = 'draft' | 'in-review' | 'approved' | 'final';

export interface Approver {
  id: string;
  name: string;
  role: string;
  decision?: 'approved' | 'changes-requested' | 'rejected';
  decidedAt?: string;
  comment?: string;
}

export interface SignOffEntry {
  approverName: string;
  action: string;
  timestamp: string;
  comment?: string;
}

export interface ApprovalState {
  status: DocumentStatus;
  approvers: Approver[];
  signOffLog: SignOffEntry[];
  requestedAt?: string;
}

interface ApprovalWorkflowProps {
  state: ApprovalState;
  onUpdateState: (state: ApprovalState) => void;
  onClose: () => void;
}

const STATUS_CONFIG: Record<DocumentStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  'draft': { label: 'Draft', color: '#5f6368', bg: '#f1f3f4', icon: <Clock size={14} /> },
  'in-review': { label: 'In Review', color: '#e8710a', bg: '#fef7e0', icon: <AlertCircle size={14} /> },
  'approved': { label: 'Approved', color: '#34a853', bg: '#e6f4ea', icon: <Check size={14} /> },
  'final': { label: 'Final', color: '#1a73e8', bg: '#e8f0fe', icon: <Shield size={14} /> },
};

export const ApprovalStatusBadge: React.FC<{ status: DocumentStatus }> = ({ status }) => {
  const config = STATUS_CONFIG[status];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
      color: config.color, background: config.bg,
    }}>
      {config.icon} {config.label}
    </span>
  );
};

const ApprovalWorkflow: React.FC<ApprovalWorkflowProps> = ({ state, onUpdateState, onClose }) => {
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');
  const [decisionComment, setDecisionComment] = useState('');

  const addApprover = () => {
    if (!newName.trim()) return;
    const approver: Approver = {
      id: `approver-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: newName.trim(),
      role: newRole.trim() || 'Reviewer',
    };
    onUpdateState({ ...state, approvers: [...state.approvers, approver] });
    setNewName('');
    setNewRole('');
  };

  const removeApprover = (id: string) => {
    onUpdateState({ ...state, approvers: state.approvers.filter(a => a.id !== id) });
  };

  const submitDecision = (approverId: string, decision: 'approved' | 'changes-requested' | 'rejected') => {
    const now = new Date().toISOString();
    const updatedApprovers = state.approvers.map(a =>
      a.id === approverId ? { ...a, decision, decidedAt: now, comment: decisionComment || undefined } : a
    );
    const approver = state.approvers.find(a => a.id === approverId);
    const logEntry: SignOffEntry = {
      approverName: approver?.name || 'Unknown',
      action: decision,
      timestamp: now,
      comment: decisionComment || undefined,
    };

    // Auto-update status
    let newStatus = state.status;
    const allDecided = updatedApprovers.every(a => a.decision);
    const anyRejected = updatedApprovers.some(a => a.decision === 'rejected');
    const anyChangesReq = updatedApprovers.some(a => a.decision === 'changes-requested');
    const allApproved = updatedApprovers.every(a => a.decision === 'approved');

    if (allDecided) {
      if (anyRejected) newStatus = 'draft';
      else if (anyChangesReq) newStatus = 'draft';
      else if (allApproved) newStatus = 'approved';
    }

    onUpdateState({
      ...state,
      approvers: updatedApprovers,
      signOffLog: [...state.signOffLog, logEntry],
      status: newStatus,
    });
    setDecisionComment('');
  };

  const requestApproval = () => {
    if (state.approvers.length === 0) return;
    const now = new Date().toISOString();
    onUpdateState({
      ...state,
      status: 'in-review',
      requestedAt: now,
      signOffLog: [...state.signOffLog, { approverName: 'System', action: 'Review requested', timestamp: now }],
    });
  };

  const markFinal = () => {
    const now = new Date().toISOString();
    onUpdateState({
      ...state,
      status: 'final',
      signOffLog: [...state.signOffLog, { approverName: 'System', action: 'Marked as final', timestamp: now }],
    });
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const decisionIcon = (d?: string) => {
    if (d === 'approved') return <Check size={14} style={{ color: '#34a853' }} />;
    if (d === 'changes-requested') return <AlertCircle size={14} style={{ color: '#e8710a' }} />;
    if (d === 'rejected') return <XCircle size={14} style={{ color: '#ea4335' }} />;
    return <Clock size={14} style={{ color: '#999' }} />;
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--bg-primary, #fff)', borderRadius: 8, width: 520,
        maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid #e0e0e0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <FileCheck size={18} />
            <h3 style={{ margin: 0, fontSize: 16 }}>Approval Workflow</h3>
            <ApprovalStatusBadge status={state.status} />
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
          {/* Add approver */}
          <div style={{ marginBottom: 20 }}>
            <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600 }}>Approvers</h4>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Name"
                style={{ flex: 1, fontSize: 13, padding: '6px 10px', borderRadius: 4, border: '1px solid #ccc' }} />
              <input value={newRole} onChange={e => setNewRole(e.target.value)} placeholder="Role"
                style={{ width: 120, fontSize: 13, padding: '6px 10px', borderRadius: 4, border: '1px solid #ccc' }} />
              <button onClick={addApprover} disabled={!newName.trim()}
                style={{ fontSize: 12, padding: '6px 12px', borderRadius: 4, border: 'none', background: '#1a73e8', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <UserPlus size={12} /> Add
              </button>
            </div>

            {/* Approver list */}
            {state.approvers.map(a => (
              <div key={a.id} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
                borderRadius: 6, border: '1px solid #e0e0e0', marginBottom: 8,
              }}>
                {decisionIcon(a.decision)}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{a.name}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>{a.role}</div>
                  {a.comment && <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>"{a.comment}"</div>}
                </div>
                {a.decision ? (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: a.decision === 'approved' ? '#34a853' : a.decision === 'rejected' ? '#ea4335' : '#e8710a' }}>
                      {a.decision === 'approved' ? 'Approved' : a.decision === 'rejected' ? 'Rejected' : 'Changes Requested'}
                    </div>
                    {a.decidedAt && <div style={{ fontSize: 10, color: '#999' }}>{formatDate(a.decidedAt)}</div>}
                  </div>
                ) : state.status === 'in-review' ? (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => submitDecision(a.id, 'approved')} title="Approve"
                      style={{ padding: 4, borderRadius: 4, border: '1px solid #34a853', background: '#e6f4ea', cursor: 'pointer' }}>
                      <Check size={12} style={{ color: '#34a853' }} />
                    </button>
                    <button onClick={() => submitDecision(a.id, 'changes-requested')} title="Request Changes"
                      style={{ padding: 4, borderRadius: 4, border: '1px solid #e8710a', background: '#fef7e0', cursor: 'pointer' }}>
                      <AlertCircle size={12} style={{ color: '#e8710a' }} />
                    </button>
                    <button onClick={() => submitDecision(a.id, 'rejected')} title="Reject"
                      style={{ padding: 4, borderRadius: 4, border: '1px solid #ea4335', background: '#fce8e6', cursor: 'pointer' }}>
                      <XCircle size={12} style={{ color: '#ea4335' }} />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => removeApprover(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}>
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}

            {state.approvers.length === 0 && (
              <div style={{ padding: 16, textAlign: 'center', color: '#888', fontSize: 13, border: '1px dashed #ccc', borderRadius: 6 }}>
                Add approvers to start the review process
              </div>
            )}
          </div>

          {/* Decision comment */}
          {state.status === 'in-review' && (
            <div style={{ marginBottom: 16 }}>
              <input value={decisionComment} onChange={e => setDecisionComment(e.target.value)}
                placeholder="Add a comment with your decision (optional)"
                style={{ width: '100%', fontSize: 12, padding: '6px 10px', borderRadius: 4, border: '1px solid #ccc', boxSizing: 'border-box' }} />
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {state.status === 'draft' && state.approvers.length > 0 && (
              <button onClick={requestApproval}
                style={{ fontSize: 13, padding: '8px 16px', borderRadius: 6, border: 'none', background: '#1a73e8', color: '#fff', cursor: 'pointer' }}>
                Request Approval
              </button>
            )}
            {state.status === 'approved' && (
              <button onClick={markFinal}
                style={{ fontSize: 13, padding: '8px 16px', borderRadius: 6, border: 'none', background: '#34a853', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Shield size={14} /> Mark as Final
              </button>
            )}
          </div>

          {/* Sign-off log */}
          {state.signOffLog.length > 0 && (
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600 }}>Sign-off Log</h4>
              <div style={{ fontSize: 12, border: '1px solid #e0e0e0', borderRadius: 6, overflow: 'hidden' }}>
                {state.signOffLog.map((entry, i) => (
                  <div key={i} style={{
                    padding: '8px 12px', borderBottom: i < state.signOffLog.length - 1 ? '1px solid #e0e0e0' : 'none',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <span style={{ fontWeight: 600, minWidth: 80 }}>{entry.approverName}</span>
                    <span style={{
                      padding: '1px 6px', borderRadius: 3, fontSize: 11,
                      background: entry.action === 'approved' ? '#e6f4ea' : entry.action === 'rejected' ? '#fce8e6' : '#f1f3f4',
                      color: entry.action === 'approved' ? '#34a853' : entry.action === 'rejected' ? '#ea4335' : '#5f6368',
                    }}>
                      {entry.action}
                    </span>
                    <span style={{ color: '#999', fontSize: 11, marginLeft: 'auto' }}>{formatDate(entry.timestamp)}</span>
                    {entry.comment && <span style={{ color: '#555', fontSize: 11 }}>— {entry.comment}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ApprovalWorkflow;
