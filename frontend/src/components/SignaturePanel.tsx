import React, { useState, useEffect, useCallback } from 'react';
import { Shield, ShieldCheck, ShieldX, ShieldAlert, Plus, PenLine, CheckCircle, XCircle, AlertTriangle, UserPlus } from 'lucide-react';
import {
  SigningIdentity, VerifiedSignature,
  getActiveIdentity, getStoredIdentities, createSigningIdentity,
  signDocument, verifyDocumentSignatures, setActiveIdentity,
  parseSignaturesFromFrontmatter, signaturesToFrontmatter,
  storeIdentity,
} from '../lib/digitalSignature';
import SignatureCanvas from './SignatureCanvas';
import { parseFrontmatter, serializeFrontmatter } from '../utils/frontmatter';

interface SignaturePanelProps {
  content: string;
  onContentChange: (content: string) => void;
  editor?: any;
}

const statusIcon = (status: VerifiedSignature['status']) => {
  switch (status) {
    case 'valid': return <CheckCircle size={16} color="#16a34a" />;
    case 'invalid': return <XCircle size={16} color="#dc2626" />;
    case 'unverified': return <AlertTriangle size={16} color="#ca8a04" />;
  }
};

const statusLabel = (status: VerifiedSignature['status']) => {
  switch (status) {
    case 'valid': return 'Valid';
    case 'invalid': return 'Invalid (content changed)';
    case 'unverified': return 'Unverified identity';
  }
};

const SignaturePanel: React.FC<SignaturePanelProps> = ({ content, onContentChange, editor }) => {
  const [identities, setIdentities] = useState<SigningIdentity[]>([]);
  const [activeIdentity, setActiveIdentityState] = useState<SigningIdentity | null>(null);
  const [signatures, setSignatures] = useState<VerifiedSignature[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showCanvasDialog, setShowCanvasDialog] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newOrg, setNewOrg] = useState('');
  const [loading, setLoading] = useState(false);

  // Load identities
  useEffect(() => {
    setIdentities(getStoredIdentities());
    setActiveIdentityState(getActiveIdentity());
  }, []);

  // Verify existing signatures whenever content changes
  const verifySignatures = useCallback(async () => {
    const { metadata, content: bodyContent } = parseFrontmatter(content);
    const sigs = parseSignaturesFromFrontmatter(metadata);
    if (sigs.length === 0) { setSignatures([]); return; }
    const verified = await verifyDocumentSignatures(bodyContent, sigs);
    setSignatures(verified);
  }, [content]);

  useEffect(() => { verifySignatures(); }, [verifySignatures]);

  // Create signing identity
  const handleCreateIdentity = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      const identity = await createSigningIdentity(newName.trim(), newEmail.trim(), newOrg.trim());
      setIdentities(getStoredIdentities());
      setActiveIdentityState(identity);
      setShowCreateDialog(false);
      setNewName(''); setNewEmail(''); setNewOrg('');
    } finally {
      setLoading(false);
    }
  };

  // Sign document
  const handleSign = async () => {
    if (!activeIdentity) { setShowCreateDialog(true); return; }
    setLoading(true);
    try {
      const { metadata, content: bodyContent } = parseFrontmatter(content);
      const sig = await signDocument(bodyContent, activeIdentity);
      const existingSigs = parseSignaturesFromFrontmatter(metadata);
      // Replace existing sig from same identity or append
      const idx = existingSigs.findIndex(s => s.publicKeyFingerprint === activeIdentity.fingerprint);
      if (idx >= 0) existingSigs[idx] = sig;
      else existingSigs.push(sig);
      const newMetadata = { ...metadata, signatures: signaturesToFrontmatter(existingSigs) };
      const newContent = serializeFrontmatter(newMetadata, bodyContent);
      onContentChange(newContent);
    } finally {
      setLoading(false);
    }
  };

  // Insert visual signature block into editor
  const handleInsertBlock = () => {
    if (!editor || !activeIdentity) return;
    editor.chain().focus().insertContent({
      type: 'signatureBlock',
      attrs: {
        signerName: activeIdentity.name,
        signerOrg: activeIdentity.organization,
        date: new Date().toISOString().split('T')[0],
        fingerprint: activeIdentity.fingerprint,
        signatureImage: activeIdentity.signatureImage || '',
      },
    }).run();
  };

  const handleSaveCanvas = (dataUrl: string) => {
    if (!activeIdentity) return;
    activeIdentity.signatureImage = dataUrl;
    storeIdentity(activeIdentity);
    setShowCanvasDialog(false);
  };

  const overallStatus = signatures.length === 0 ? 'none'
    : signatures.every(s => s.status === 'valid') ? 'valid'
    : signatures.some(s => s.status === 'invalid') ? 'invalid' : 'unverified';

  return (
    <div style={{ padding: 16, borderLeft: '1px solid #e0e0e0', width: 300, overflowY: 'auto', fontSize: 13 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        {overallStatus === 'valid' ? <ShieldCheck size={20} color="#16a34a" /> :
         overallStatus === 'invalid' ? <ShieldX size={20} color="#dc2626" /> :
         overallStatus === 'unverified' ? <ShieldAlert size={20} color="#ca8a04" /> :
         <Shield size={20} color="#6b7280" />}
        <h3 style={{ margin: 0, fontSize: 15 }}>Signatures</h3>
      </div>

      {/* Active Identity */}
      <div style={{ marginBottom: 12, padding: 8, background: '#f8f9fa', borderRadius: 6 }}>
        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Signing Identity</div>
        {activeIdentity ? (
          <div>
            <div style={{ fontWeight: 600 }}>{activeIdentity.name}</div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>{activeIdentity.email} • {activeIdentity.organization}</div>
            <div style={{ fontSize: 10, color: '#9ca3af', fontFamily: 'monospace' }}>{activeIdentity.fingerprint}</div>
          </div>
        ) : (
          <div style={{ color: '#9ca3af' }}>No identity configured</div>
        )}
        <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
          <button onClick={() => setShowCreateDialog(true)} style={btnStyle}>
            <UserPlus size={12} /> New
          </button>
          {activeIdentity && (
            <button onClick={() => setShowCanvasDialog(true)} style={btnStyle}>
              <PenLine size={12} /> Signature
            </button>
          )}
          {identities.length > 1 && (
            <select
              value={activeIdentity?.fingerprint || ''}
              onChange={e => { setActiveIdentity(e.target.value); setActiveIdentityState(identities.find(i => i.fingerprint === e.target.value) || null); }}
              style={{ fontSize: 11, padding: '2px 4px', borderRadius: 4, border: '1px solid #ccc' }}
            >
              {identities.map(i => <option key={i.fingerprint} value={i.fingerprint}>{i.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        <button onClick={handleSign} disabled={loading} style={{ ...actionBtnStyle, background: '#1a73e8', color: '#fff' }}>
          <PenLine size={14} /> Sign Document
        </button>
        {editor && (
          <button onClick={handleInsertBlock} disabled={!activeIdentity} style={actionBtnStyle}>
            <Plus size={14} /> Insert Block
          </button>
        )}
      </div>

      {/* Signature list */}
      {signatures.length > 0 ? (
        <div>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>Document Signatures</div>
          {signatures.map((sig, i) => (
            <div key={i} style={{
              padding: 8, marginBottom: 6, borderRadius: 6,
              border: `1px solid ${sig.status === 'valid' ? '#bbf7d0' : sig.status === 'invalid' ? '#fecaca' : '#fef08a'}`,
              background: sig.status === 'valid' ? '#f0fdf4' : sig.status === 'invalid' ? '#fef2f2' : '#fefce8',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {statusIcon(sig.status)}
                <span style={{ fontWeight: 600 }}>{sig.signerName}</span>
              </div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                {sig.signerOrg && <span>{sig.signerOrg} • </span>}
                {new Date(sig.date).toLocaleDateString()}
              </div>
              <div style={{ fontSize: 10, color: '#9ca3af' }}>{statusLabel(sig.status)}</div>
              <div style={{ fontSize: 9, color: '#d1d5db', fontFamily: 'monospace', marginTop: 2 }}>
                {sig.signature.slice(0, 24)}...
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ color: '#9ca3af', textAlign: 'center', padding: 20 }}>No signatures yet</div>
      )}

      {/* Create Identity Dialog */}
      {showCreateDialog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: 20, width: 360 }}>
            <h3 style={{ margin: '0 0 12px' }}>Create Signing Identity</h3>
            <input placeholder="Full Name *" value={newName} onChange={e => setNewName(e.target.value)} style={inputStyle} />
            <input placeholder="Email" value={newEmail} onChange={e => setNewEmail(e.target.value)} style={inputStyle} />
            <input placeholder="Organization" value={newOrg} onChange={e => setNewOrg(e.target.value)} style={inputStyle} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button onClick={() => setShowCreateDialog(false)} style={btnStyle}>Cancel</button>
              <button onClick={handleCreateIdentity} disabled={!newName.trim() || loading} style={{ ...btnStyle, background: '#1a73e8', color: '#fff' }}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Signature Canvas Dialog */}
      {showCanvasDialog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <SignatureCanvas
            onSave={handleSaveCanvas}
            onCancel={() => setShowCanvasDialog(false)}
            initialImage={activeIdentity?.signatureImage}
          />
        </div>
      )}
    </div>
  );
};

const btnStyle: React.CSSProperties = {
  padding: '4px 10px', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer',
  background: '#fff', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4,
};

const actionBtnStyle: React.CSSProperties = {
  padding: '6px 12px', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer',
  background: '#fff', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500,
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', border: '1px solid #ccc', borderRadius: 4,
  marginBottom: 8, fontSize: 13,
};

export default SignaturePanel;
