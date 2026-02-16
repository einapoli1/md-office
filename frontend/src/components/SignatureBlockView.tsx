import React from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import { CheckCircle, XCircle, Clock, PenLine } from 'lucide-react';

const statusConfig = {
  pending: { icon: Clock, color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb', label: 'Pending' },
  signed: { icon: PenLine, color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', label: 'Signed' },
  verified: { icon: CheckCircle, color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', label: 'Verified' },
  invalid: { icon: XCircle, color: '#dc2626', bg: '#fef2f2', border: '#fecaca', label: 'Invalid' },
} as const;

type StatusKey = keyof typeof statusConfig;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SignatureBlockView: React.FC<any> = ({ node }) => {
  const attrs = node.attrs as {
    signerName: string; signerOrg: string; date: string;
    fingerprint: string; signatureImage: string; status: StatusKey;
  };
  const { signerName, signerOrg, date, fingerprint, signatureImage, status } = attrs;
  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <NodeViewWrapper>
      <div
        style={{
          border: `2px solid ${config.border}`,
          borderRadius: 8,
          padding: 16,
          margin: '12px 0',
          background: config.bg,
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          maxWidth: 400,
        }}
        contentEditable={false}
      >
        {/* Signature image or placeholder */}
        <div style={{
          width: 120, height: 60, border: '1px dashed #ccc', borderRadius: 4,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#fff', flexShrink: 0, overflow: 'hidden',
        }}>
          {signatureImage ? (
            <img src={signatureImage} alt="Signature" style={{ maxWidth: '100%', maxHeight: '100%' }} />
          ) : (
            <PenLine size={24} color="#d1d5db" />
          )}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon size={14} color={config.color} />
            <span style={{ fontWeight: 600, fontSize: 14 }}>{signerName || 'Unsigned'}</span>
          </div>
          {signerOrg && <div style={{ fontSize: 12, color: '#6b7280' }}>{signerOrg}</div>}
          {date && <div style={{ fontSize: 11, color: '#9ca3af' }}>{date}</div>}
          {fingerprint && (
            <div style={{ fontSize: 9, color: '#d1d5db', fontFamily: 'monospace', marginTop: 2 }}>
              {fingerprint}
            </div>
          )}
          <div style={{ fontSize: 10, color: config.color, fontWeight: 500, marginTop: 2 }}>{config.label}</div>
        </div>
      </div>
    </NodeViewWrapper>
  );
};

export default SignatureBlockView;
