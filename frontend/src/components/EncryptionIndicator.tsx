import React from 'react';
import { Lock } from 'lucide-react';

interface EncryptionIndicatorProps {
  isEncrypted: boolean;
  onClick?: () => void;
}

const EncryptionIndicator: React.FC<EncryptionIndicatorProps> = ({ isEncrypted, onClick }) => {
  if (!isEncrypted) return null;

  return (
    <button
      onClick={onClick}
      title="Document is password-protected. Click to change or remove password."
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 11,
        color: '#d32f2f',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '2px 6px',
        borderRadius: 4,
      }}
    >
      <Lock size={12} />
      <span>Protected</span>
    </button>
  );
};

export default EncryptionIndicator;
