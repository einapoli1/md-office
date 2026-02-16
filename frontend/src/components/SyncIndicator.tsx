import { Cloud, CloudOff, AlertTriangle, Loader2, Check, GitBranch } from 'lucide-react';
import { SyncStatus, GitProvider } from '../utils/gitProviderApi';

interface SyncIndicatorProps {
  syncStatus: SyncStatus | null;
  branch: string;
  defaultBranch: string;
  provider: GitProvider | null;
  onCreatePR?: () => void;
  onSync?: () => void;
}

function SyncIndicator({ syncStatus, branch, defaultBranch, provider, onCreatePR, onSync }: SyncIndicatorProps) {
  if (!syncStatus || syncStatus.state === 'disconnected') {
    return null;
  }

  const stateConfig: Record<string, { icon: JSX.Element; label: string; color: string }> = {
    synced: { icon: <Check size={14} />, label: 'Synced', color: '#28a745' },
    pushing: { icon: <Loader2 size={14} className="spin" />, label: 'Pushing...', color: '#007bff' },
    pulling: { icon: <Loader2 size={14} className="spin" />, label: 'Pulling...', color: '#007bff' },
    conflict: { icon: <AlertTriangle size={14} />, label: 'Conflict', color: '#dc3545' },
    error: { icon: <CloudOff size={14} />, label: 'Error', color: '#dc3545' },
    dirty: { icon: <Cloud size={14} />, label: 'Unsaved', color: '#ffc107' },
  };

  const config = stateConfig[syncStatus.state] || stateConfig.error;
  const isOnWorkingBranch = branch && branch !== defaultBranch;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#666' }}>
      {/* Branch indicator */}
      {branch && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: '#f0f0f0', borderRadius: 10 }}>
          <GitBranch size={12} />
          {branch}
        </span>
      )}

      {/* Sync status */}
      <span
        style={{ display: 'flex', alignItems: 'center', gap: 4, color: config.color, cursor: onSync ? 'pointer' : 'default' }}
        onClick={onSync}
        title={syncStatus.message || config.label}
      >
        {config.icon}
        {config.label}
      </span>

      {/* Create PR button */}
      {isOnWorkingBranch && onCreatePR && (
        <button
          onClick={onCreatePR}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '2px 10px', background: '#007bff', color: 'white',
            border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 11, fontWeight: 500,
          }}
          title={`Create pull request from ${branch} to ${defaultBranch}`}
        >
          Create PR
        </button>
      )}

      {/* Provider badge */}
      {provider && (
        <span style={{ fontSize: 10, color: '#999', textTransform: 'capitalize' }}>
          {provider}
        </span>
      )}
    </div>
  );
}

export default SyncIndicator;
