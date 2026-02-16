import { useState, useEffect } from 'react';
import { GitBranch, Github, Globe, Key, ArrowRight, ArrowLeft, Check, Plus, Search, Lock, Unlock, Loader2 } from 'lucide-react';
import {
  oauthAPI,
  gitProviderAPI,
  GitProvider,
  ProviderConnection,
  RemoteRepo,
  RemoteBranch,
} from '../utils/gitProviderApi';

interface OnboardingWizardProps {
  onComplete: (config: {
    provider: GitProvider;
    giteaUrl?: string;
    owner: string;
    repoName: string;
    cloneUrl: string;
    branch: string;
    defaultBranch: string;
    subdirectory?: string;
  }) => void;
  onSkip: () => void;
}

type Step = 'provider' | 'repo' | 'branch' | 'confirm';

function OnboardingWizard({ onComplete, onSkip }: OnboardingWizardProps) {
  const [step, setStep] = useState<Step>('provider');
  const [provider, setProvider] = useState<GitProvider | null>(null);
  const [giteaUrl, setGiteaUrl] = useState('');
  const [connections, setConnections] = useState<ProviderConnection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 2 state
  const [action, setAction] = useState<'new' | 'import'>('import');
  const [repos, setRepos] = useState<RemoteRepo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRepo, setSelectedRepo] = useState<RemoteRepo | null>(null);
  const [newRepoName, setNewRepoName] = useState('');
  const [newRepoDesc, setNewRepoDesc] = useState('');
  const [newRepoPrivate, setNewRepoPrivate] = useState(true);

  // Step 3 state
  const [branches, setBranches] = useState<RemoteBranch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [createWorkingBranch, setCreateWorkingBranch] = useState(false);
  const [workingBranchName, setWorkingBranchName] = useState('md-office/drafts');
  const [subdirectory, setSubdirectory] = useState('');

  // PAT mode for Gitea
  const [usePAT, setUsePAT] = useState(false);
  const [patToken, setPatToken] = useState('');

  useEffect(() => {
    loadConnections();
    // Check URL params for OAuth callback
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === 'true' && params.get('provider')) {
      const p = params.get('provider') as GitProvider;
      setProvider(p);
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const loadConnections = async () => {
    try {
      const conns = await oauthAPI.getConnectedProviders();
      setConnections(conns);
    } catch { /* ignore */ }
  };

  const isProviderConnected = (p: string) =>
    connections.some(c => c.provider === p);

  const handleProviderAuth = async (p: GitProvider) => {
    setProvider(p);
    setError('');

    if (isProviderConnected(p)) {
      setStep('repo');
      return;
    }

    if (p === 'gitea' && usePAT && patToken) {
      try {
        setLoading(true);
        await oauthAPI.savePAT(p, patToken, giteaUrl || undefined);
        await loadConnections();
        setStep('repo');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'PAT validation failed');
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      setLoading(true);
      const url = await oauthAPI.startOAuth(p, p === 'gitea' ? giteaUrl : undefined);
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'OAuth failed');
      setLoading(false);
    }
  };

  const loadRepos = async () => {
    if (!provider) return;
    setLoading(true);
    try {
      const r = await gitProviderAPI.listRepos(provider, 1, 50, searchQuery, giteaUrl || undefined);
      setRepos(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load repos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (step === 'repo' && action === 'import' && provider) {
      loadRepos();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, action, provider, searchQuery]);

  const handleRepoNext = async () => {
    if (action === 'new') {
      if (!newRepoName || !provider) return;
      setLoading(true);
      try {
        const repo = await gitProviderAPI.createRepo(provider, newRepoName, newRepoDesc, newRepoPrivate, giteaUrl || undefined);
        setSelectedRepo(repo);
        setStep('branch');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to create repo');
      } finally {
        setLoading(false);
      }
    } else {
      if (!selectedRepo) return;
      setStep('branch');
    }
  };

  useEffect(() => {
    if (step === 'branch' && selectedRepo && provider) {
      setLoading(true);
      gitProviderAPI.listBranches(provider, selectedRepo.owner, selectedRepo.name, giteaUrl || undefined)
        .then(b => {
          setBranches(b);
          const def = b.find(br => br.isDefault);
          setSelectedBranch(def?.name || b[0]?.name || 'main');
          // Auto-detect if default branch is protected
          if (def?.protected) {
            setCreateWorkingBranch(true);
          }
        })
        .catch(e => setError(e instanceof Error ? e.message : 'Failed to load branches'))
        .finally(() => setLoading(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, selectedRepo, provider]);

  const handleConfirm = () => {
    if (!selectedRepo || !provider) return;
    const branch = createWorkingBranch ? workingBranchName : selectedBranch;
    onComplete({
      provider,
      giteaUrl: giteaUrl || undefined,
      owner: selectedRepo.owner,
      repoName: selectedRepo.name,
      cloneUrl: selectedRepo.cloneUrl,
      branch,
      defaultBranch: selectedRepo.defaultBranch || selectedBranch,
      subdirectory: subdirectory || undefined,
    });
  };

  const steps: Step[] = ['provider', 'repo', 'branch', 'confirm'];
  const stepIdx = steps.indexOf(step);

  const providerInfo: { id: GitProvider; name: string; icon: JSX.Element; color: string }[] = [
    { id: 'github', name: 'GitHub', icon: <Github size={24} />, color: '#333' },
    { id: 'gitlab', name: 'GitLab', icon: <GitBranch size={24} />, color: '#FC6D26' },
    { id: 'bitbucket', name: 'Bitbucket', icon: <Globe size={24} />, color: '#0052CC' },
    { id: 'gitea', name: 'Gitea', icon: <Globe size={24} />, color: '#609926' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 20, background: '#f5f5f5' }}>
      <div style={{ background: 'white', borderRadius: 12, padding: 40, maxWidth: 600, width: '100%', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
        {/* Progress */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 30, justifyContent: 'center' }}>
          {steps.map((s, i) => (
            <div key={s} style={{
              width: 40, height: 4, borderRadius: 2,
              background: i <= stepIdx ? '#007bff' : '#ddd',
            }} />
          ))}
        </div>

        {error && (
          <div style={{ background: '#fee', color: '#c33', padding: 10, borderRadius: 6, marginBottom: 20, fontSize: 14 }}>
            {error}
          </div>
        )}

        {/* Step 1: Provider */}
        {step === 'provider' && (
          <div>
            <h2 style={{ margin: '0 0 8px', textAlign: 'center' }}>Connect Your Git Provider</h2>
            <p style={{ color: '#666', textAlign: 'center', marginBottom: 24 }}>
              Your documents are stored in your own Git repository
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {providerInfo.map(p => (
                <button
                  key={p.id}
                  onClick={() => {
                    if (p.id === 'gitea' && !giteaUrl && !isProviderConnected('gitea')) {
                      setProvider('gitea');
                      return;
                    }
                    handleProviderAuth(p.id);
                  }}
                  disabled={loading}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '16px 20px', border: '2px solid #eee', borderRadius: 8,
                    background: isProviderConnected(p.id) ? '#f0fff0' : 'white',
                    cursor: 'pointer', fontSize: 16, fontWeight: 500,
                    borderColor: provider === p.id ? p.color : '#eee',
                  }}
                >
                  {p.icon}
                  <span>{p.name}</span>
                  {isProviderConnected(p.id) && <Check size={16} color="green" style={{ marginLeft: 'auto' }} />}
                </button>
              ))}
            </div>

            {provider === 'gitea' && !isProviderConnected('gitea') && (
              <div style={{ marginTop: 20 }}>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Gitea Server URL</label>
                <input
                  value={giteaUrl}
                  onChange={e => setGiteaUrl(e.target.value)}
                  placeholder="https://gitea.example.com"
                  style={{ width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 6, boxSizing: 'border-box' }}
                />

                <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input type="checkbox" checked={usePAT} onChange={e => setUsePAT(e.target.checked)} />
                    Use Personal Access Token
                  </label>
                </div>

                {usePAT && (
                  <div style={{ marginTop: 8 }}>
                    <input
                      value={patToken}
                      onChange={e => setPatToken(e.target.value)}
                      placeholder="Paste your personal access token"
                      type="password"
                      style={{ width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 6, boxSizing: 'border-box' }}
                    />
                  </div>
                )}

                <button
                  onClick={() => handleProviderAuth('gitea')}
                  disabled={loading || !giteaUrl}
                  style={{
                    marginTop: 12, padding: '10px 20px', background: '#609926', color: 'white',
                    border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 500,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  {usePAT ? <Key size={16} /> : <Globe size={16} />}
                  {loading ? 'Connecting...' : (usePAT ? 'Validate Token' : 'Connect with OAuth')}
                </button>
              </div>
            )}

            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <button
                onClick={onSkip}
                style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: 14 }}
              >
                Skip — use local mode
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Choose repo */}
        {step === 'repo' && (
          <div>
            <h2 style={{ margin: '0 0 20px' }}>Choose a Repository</h2>

            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <button
                onClick={() => setAction('import')}
                style={{
                  flex: 1, padding: 12, border: '2px solid', borderRadius: 8, cursor: 'pointer',
                  borderColor: action === 'import' ? '#007bff' : '#ddd',
                  background: action === 'import' ? '#f0f7ff' : 'white',
                  fontWeight: 500,
                }}
              >
                <Search size={18} style={{ marginRight: 6 }} />
                Import existing
              </button>
              <button
                onClick={() => setAction('new')}
                style={{
                  flex: 1, padding: 12, border: '2px solid', borderRadius: 8, cursor: 'pointer',
                  borderColor: action === 'new' ? '#007bff' : '#ddd',
                  background: action === 'new' ? '#f0f7ff' : 'white',
                  fontWeight: 500,
                }}
              >
                <Plus size={18} style={{ marginRight: 6 }} />
                Create new
              </button>
            </div>

            {action === 'import' && (
              <div>
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search repositories..."
                  style={{ width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 6, marginBottom: 12, boxSizing: 'border-box' }}
                />
                {loading && <div style={{ textAlign: 'center', padding: 20 }}><Loader2 className="spin" size={24} /></div>}
                <div style={{ maxHeight: 300, overflow: 'auto' }}>
                  {repos.map(repo => (
                    <div
                      key={repo.id}
                      onClick={() => setSelectedRepo(repo)}
                      style={{
                        padding: '10px 12px', borderRadius: 6, cursor: 'pointer', marginBottom: 4,
                        border: '2px solid',
                        borderColor: selectedRepo?.id === repo.id ? '#007bff' : 'transparent',
                        background: selectedRepo?.id === repo.id ? '#f0f7ff' : '#f9f9f9',
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}
                    >
                      {repo.private ? <Lock size={14} color="#666" /> : <Unlock size={14} color="#666" />}
                      <div>
                        <div style={{ fontWeight: 500 }}>{repo.fullName}</div>
                        {repo.description && <div style={{ fontSize: 12, color: '#666' }}>{repo.description}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {action === 'new' && (
              <div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Repository Name</label>
                  <input
                    value={newRepoName}
                    onChange={e => setNewRepoName(e.target.value)}
                    placeholder="my-documents"
                    style={{ width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 6, boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Description</label>
                  <input
                    value={newRepoDesc}
                    onChange={e => setNewRepoDesc(e.target.value)}
                    placeholder="My markdown documents"
                    style={{ width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 6, boxSizing: 'border-box' }}
                  />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={newRepoPrivate} onChange={e => setNewRepoPrivate(e.target.checked)} />
                  Private repository
                </label>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
              <button onClick={() => setStep('provider')} style={navBtnStyle}>
                <ArrowLeft size={16} /> Back
              </button>
              <button
                onClick={handleRepoNext}
                disabled={loading || (action === 'import' && !selectedRepo) || (action === 'new' && !newRepoName)}
                style={{ ...navBtnStyle, background: '#007bff', color: 'white', borderColor: '#007bff' }}
              >
                {loading ? 'Creating...' : 'Next'} <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Branch */}
        {step === 'branch' && (
          <div>
            <h2 style={{ margin: '0 0 8px' }}>Branch Setup</h2>
            <p style={{ color: '#666', marginBottom: 20 }}>
              Choose how you want to work with <strong>{selectedRepo?.fullName}</strong>
            </p>

            {loading ? (
              <div style={{ textAlign: 'center', padding: 20 }}><Loader2 className="spin" size={24} /></div>
            ) : (
              <>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Branch</label>
                  <select
                    value={selectedBranch}
                    onChange={e => setSelectedBranch(e.target.value)}
                    style={{ width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 6 }}
                  >
                    {branches.map(b => (
                      <option key={b.name} value={b.name}>
                        {b.name} {b.isDefault ? '(default)' : ''} {b.protected ? '🔒' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {branches.find(b => b.name === selectedBranch)?.protected && (
                  <div style={{ background: '#fff3cd', padding: 12, borderRadius: 6, marginBottom: 16, fontSize: 14 }}>
                    <strong>⚠️ Protected branch:</strong> This branch is protected. Changes will need to be submitted as a pull request.
                  </div>
                )}

                <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={createWorkingBranch}
                    onChange={e => setCreateWorkingBranch(e.target.checked)}
                  />
                  Create a working branch (recommended for protected branches)
                </label>

                {createWorkingBranch && (
                  <input
                    value={workingBranchName}
                    onChange={e => setWorkingBranchName(e.target.value)}
                    placeholder="md-office/drafts"
                    style={{ width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 6, marginBottom: 12, boxSizing: 'border-box' }}
                  />
                )}

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>
                    Subdirectory <span style={{ fontWeight: 'normal', color: '#999' }}>(optional)</span>
                  </label>
                  <input
                    value={subdirectory}
                    onChange={e => setSubdirectory(e.target.value)}
                    placeholder="docs/"
                    style={{ width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 6, boxSizing: 'border-box' }}
                  />
                </div>
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
              <button onClick={() => setStep('repo')} style={navBtnStyle}>
                <ArrowLeft size={16} /> Back
              </button>
              <button onClick={() => setStep('confirm')} style={{ ...navBtnStyle, background: '#007bff', color: 'white', borderColor: '#007bff' }}>
                Next <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Confirm */}
        {step === 'confirm' && (
          <div>
            <h2 style={{ margin: '0 0 20px', textAlign: 'center' }}>Ready to Go!</h2>

            <div style={{ background: '#f9f9f9', padding: 20, borderRadius: 8, marginBottom: 20 }}>
              <div style={{ marginBottom: 8 }}>
                <span style={{ color: '#666' }}>Provider:</span>{' '}
                <strong>{provider}</strong>
              </div>
              <div style={{ marginBottom: 8 }}>
                <span style={{ color: '#666' }}>Repository:</span>{' '}
                <strong>{selectedRepo?.fullName}</strong>
              </div>
              <div style={{ marginBottom: 8 }}>
                <span style={{ color: '#666' }}>Branch:</span>{' '}
                <strong>{createWorkingBranch ? workingBranchName : selectedBranch}</strong>
                {createWorkingBranch && (
                  <span style={{ color: '#666', fontSize: 12 }}> (new, from {selectedBranch})</span>
                )}
              </div>
              {subdirectory && (
                <div style={{ marginBottom: 8 }}>
                  <span style={{ color: '#666' }}>Subdirectory:</span>{' '}
                  <strong>{subdirectory}</strong>
                </div>
              )}
              {createWorkingBranch && (
                <div style={{ marginTop: 12, padding: 10, background: '#e8f4f8', borderRadius: 6, fontSize: 13 }}>
                  💡 Your changes will be committed to <strong>{workingBranchName}</strong>.
                  When ready, create a pull request to merge into <strong>{selectedBranch}</strong>.
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button onClick={() => setStep('branch')} style={navBtnStyle}>
                <ArrowLeft size={16} /> Back
              </button>
              <button
                onClick={handleConfirm}
                style={{ ...navBtnStyle, background: '#28a745', color: 'white', borderColor: '#28a745', fontWeight: 600 }}
              >
                <Check size={16} /> Connect & Start Editing
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const navBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '10px 20px',
  border: '1px solid #ddd',
  borderRadius: 6,
  background: 'white',
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 500,
};

export default OnboardingWizard;
