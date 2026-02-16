import React, { useState, Suspense, lazy } from 'react';
import { X } from 'lucide-react';

const EnvelopePrinter = lazy(() => import('./EnvelopePrinter'));
const LabelPrinter = lazy(() => import('./LabelPrinter'));

interface Props {
  onClose: () => void;
}

const EnvelopesLabelsDialog: React.FC<Props> = ({ onClose }) => {
  const [tab, setTab] = useState<'envelopes' | 'labels'>('envelopes');

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{ background: 'var(--bg, #fff)', borderRadius: 8, width: 780, maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid #e0e0e0', alignItems: 'center' }}>
          <button onClick={() => setTab('envelopes')} style={{
            padding: '12px 24px', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
            background: 'transparent',
            borderBottom: tab === 'envelopes' ? '2px solid #1a73e8' : '2px solid transparent',
            color: tab === 'envelopes' ? '#1a73e8' : 'inherit',
          }}>Envelopes</button>
          <button onClick={() => setTab('labels')} style={{
            padding: '12px 24px', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
            background: 'transparent',
            borderBottom: tab === 'labels' ? '2px solid #1a73e8' : '2px solid transparent',
            color: tab === 'labels' ? '#1a73e8' : 'inherit',
          }}>Labels</button>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: 12 }}><X size={20} /></button>
        </div>
        <Suspense fallback={null}>
          {tab === 'envelopes' ? <EnvelopePrinter onClose={onClose} /> : <LabelPrinter onClose={onClose} />}
        </Suspense>
      </div>
    </div>
  );
};

export default EnvelopesLabelsDialog;
