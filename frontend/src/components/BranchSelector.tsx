import { useState, useEffect } from 'react';
import { gitAPI } from '../utils/api';
import { GitBranch } from '../types';
import { GitBranch as GitBranchIcon, ChevronDown, Plus, GitMerge } from 'lucide-react';

interface BranchSelectorProps {
  onBranchChange: () => void;
}

function BranchSelector({ onBranchChange }: BranchSelectorProps) {
  const [branches, setBranches] = useState<GitBranch[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showMergeForm, setShowMergeForm] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [mergeBranchName, setMergeBranchName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadBranches = async () => {
    try {
      const branchData = await gitAPI.getBranches();
      setBranches(branchData);
    } catch (err) {
      console.error('Failed to load branches:', err);
      setBranches([]);
    }
  };

  useEffect(() => {
    loadBranches();
  }, []);

  const currentBranch = branches.find(b => b.isCurrent);

  const handleSwitchBranch = async (branchName: string) => {
    if (currentBranch && branchName === currentBranch.name) {
      setIsOpen(false);
      return;
    }

    try {
      setLoading(true);
      setError('');
      await gitAPI.checkoutBranch(branchName);
      await loadBranches();
      setIsOpen(false);
      onBranchChange(); // Notify parent to reload files
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch branch');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;

    try {
      setLoading(true);
      setError('');
      await gitAPI.createBranch(newBranchName.trim());
      await loadBranches();
      setShowCreateForm(false);
      setNewBranchName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create branch');
    } finally {
      setLoading(false);
    }
  };

  const handleMergeBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mergeBranchName.trim()) return;

    try {
      setLoading(true);
      setError('');
      await gitAPI.mergeBranch(mergeBranchName.trim());
      await loadBranches();
      setShowMergeForm(false);
      setMergeBranchName('');
      onBranchChange(); // Notify parent to reload files
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to merge branch');
    } finally {
      setLoading(false);
    }
  };

  if (branches.length === 0) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        background: '#f8f9fa',
        border: '1px solid #dee2e6',
        borderRadius: '4px',
        fontSize: '14px',
        color: '#6c757d'
      }}>
        <GitBranchIcon size={16} />
        <span>No Git repo</span>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          background: '#f8f9fa',
          border: '1px solid #dee2e6',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '14px',
          minWidth: '150px',
          justifyContent: 'space-between'
        }}
        disabled={loading}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <GitBranchIcon size={16} />
          <span>{currentBranch ? currentBranch.name : 'No branch'}</span>
        </div>
        <ChevronDown size={16} style={{ 
          transform: isOpen ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.2s'
        }} />
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: 'white',
          border: '1px solid #dee2e6',
          borderRadius: '4px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          zIndex: 1000,
          marginTop: '4px',
          minWidth: '200px'
        }}>
          {/* Branch List */}
          <div style={{ 
            maxHeight: '200px', 
            overflowY: 'auto',
            borderBottom: branches.length > 0 ? '1px solid #eee' : 'none'
          }}>
            {branches.map((branch) => (
              <button
                key={branch.name}
                onClick={() => handleSwitchBranch(branch.name)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '12px',
                  border: 'none',
                  background: branch.isCurrent ? '#e7f1ff' : 'transparent',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
                onMouseEnter={(e) => {
                  if (!branch.isCurrent) {
                    e.currentTarget.style.background = '#f8f9fa';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!branch.isCurrent) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <GitBranchIcon size={14} />
                <div style={{ flexGrow: 1 }}>
                  <div style={{ fontWeight: branch.isCurrent ? 500 : 'normal' }}>
                    {branch.name}
                  </div>
                  <div style={{ 
                    fontSize: '12px', 
                    color: '#666',
                    fontFamily: 'monospace'
                  }}>
                    {branch.hash.substring(0, 7)}
                  </div>
                </div>
                {branch.isCurrent && (
                  <div style={{
                    width: '8px',
                    height: '8px',
                    backgroundColor: '#28a745',
                    borderRadius: '50%'
                  }}></div>
                )}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div style={{ padding: '4px 0' }}>
            <button
              onClick={() => {
                setShowCreateForm(true);
                setIsOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '12px',
                border: 'none',
                background: 'transparent',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '14px',
                color: '#007bff'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f8f9fa'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <Plus size={16} />
              <span>Create Branch</span>
            </button>

            <button
              onClick={() => {
                setShowMergeForm(true);
                setIsOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '12px',
                border: 'none',
                background: 'transparent',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '14px',
                color: '#007bff'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f8f9fa'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <GitMerge size={16} />
              <span>Merge Branch</span>
            </button>
          </div>
        </div>
      )}

      {/* Create Branch Modal */}
      {showCreateForm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div style={{
            background: 'white',
            padding: '30px',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            width: '100%',
            maxWidth: '400px'
          }}>
            <h3 style={{ margin: '0 0 20px 0' }}>Create New Branch</h3>
            
            <form onSubmit={handleCreateBranch}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px',
                  fontWeight: 'bold'
                }}>
                  Branch Name
                </label>
                <input
                  type="text"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                  placeholder="feature/my-new-feature"
                />
                <div style={{ 
                  fontSize: '12px', 
                  color: '#666', 
                  marginTop: '4px' 
                }}>
                  Branch will be created from the current branch
                </div>
              </div>

              {error && (
                <div style={{
                  background: '#fee',
                  color: '#c33',
                  padding: '10px',
                  borderRadius: '4px',
                  marginBottom: '20px',
                  fontSize: '14px'
                }}>
                  {error}
                </div>
              )}

              <div style={{ 
                display: 'flex', 
                gap: '10px', 
                justifyContent: 'flex-end' 
              }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewBranchName('');
                    setError('');
                  }}
                  style={{
                    padding: '10px 20px',
                    border: '1px solid #ddd',
                    background: 'white',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.7 : 1
                  }}
                >
                  {loading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Merge Branch Modal */}
      {showMergeForm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div style={{
            background: 'white',
            padding: '30px',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            width: '100%',
            maxWidth: '400px'
          }}>
            <h3 style={{ margin: '0 0 20px 0' }}>Merge Branch</h3>
            
            <form onSubmit={handleMergeBranch}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px',
                  fontWeight: 'bold'
                }}>
                  Select Branch to Merge
                </label>
                <select
                  value={mergeBranchName}
                  onChange={(e) => setMergeBranchName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="">Choose branch to merge</option>
                  {branches
                    .filter(branch => !branch.isCurrent)
                    .map(branch => (
                    <option key={branch.name} value={branch.name}>
                      {branch.name}
                    </option>
                  ))}
                </select>
                <div style={{ 
                  fontSize: '12px', 
                  color: '#666', 
                  marginTop: '4px' 
                }}>
                  This will merge the selected branch into {currentBranch?.name}
                </div>
              </div>

              {error && (
                <div style={{
                  background: '#fee',
                  color: '#c33',
                  padding: '10px',
                  borderRadius: '4px',
                  marginBottom: '20px',
                  fontSize: '14px'
                }}>
                  {error}
                </div>
              )}

              <div style={{ 
                display: 'flex', 
                gap: '10px', 
                justifyContent: 'flex-end' 
              }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowMergeForm(false);
                    setMergeBranchName('');
                    setError('');
                  }}
                  style={{
                    padding: '10px 20px',
                    border: '1px solid #ddd',
                    background: 'white',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.7 : 1
                  }}
                >
                  {loading ? 'Merging...' : 'Merge'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default BranchSelector;