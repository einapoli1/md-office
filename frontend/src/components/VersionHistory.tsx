import React from 'react';
import { GitCommit } from '../types';
import { GitBranch, RotateCcw, Eye } from 'lucide-react';

interface VersionHistoryProps {
  commits: GitCommit[];
  onRevert: (commit: GitCommit) => void;
  onViewDiff: (commit: GitCommit) => void;
}

const VersionHistory: React.FC<VersionHistoryProps> = ({ commits, onRevert, onViewDiff }) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const handleRevert = (commit: GitCommit, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to revert to this version?\n\nCommit: ${commit.message}\nDate: ${formatDate(commit.date)}`)) {
      onRevert(commit);
    }
  };

  const handleViewDiff = (commit: GitCommit, e: React.MouseEvent) => {
    e.stopPropagation();
    onViewDiff(commit);
  };

  return (
    <div className="version-history">
      <h4 style={{ display: 'flex', alignItems: 'center', gap: '5px', margin: '0 0 10px 0', color: '#666' }}>
        <GitBranch size={16} />
        Version History
      </h4>
      
      {commits.length === 0 ? (
        <div style={{ fontSize: '12px', color: '#999', textAlign: 'center', padding: '20px 0' }}>
          No version history
        </div>
      ) : (
        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
          {commits.slice(0, 10).map((commit) => (
            <div key={commit.hash} className="version-item">
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'flex-start',
                marginBottom: '4px'
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ 
                    fontWeight: 'bold', 
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {commit.message || 'Auto-save'}
                  </div>
                  <div style={{ color: '#666', fontSize: '10px' }}>
                    {commit.author} • {formatDate(commit.date)}
                  </div>
                  <div style={{ color: '#999', fontSize: '10px', fontFamily: 'monospace' }}>
                    {commit.hash.substring(0, 7)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '2px' }}>
                  <button
                    onClick={(e) => handleViewDiff(commit, e)}
                    style={{ 
                      padding: '2px 4px', 
                      fontSize: '10px',
                      minWidth: 'auto'
                    }}
                    title="View diff"
                  >
                    <Eye size={10} />
                  </button>
                  <button
                    onClick={(e) => handleRevert(commit, e)}
                    style={{ 
                      padding: '2px 4px', 
                      fontSize: '10px',
                      minWidth: 'auto'
                    }}
                    title="Revert to this version"
                  >
                    <RotateCcw size={10} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          
          {commits.length > 10 && (
            <div style={{ fontSize: '10px', color: '#999', textAlign: 'center', marginTop: '10px' }}>
              Showing 10 most recent commits
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VersionHistory;