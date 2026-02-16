import { useState, useEffect, useCallback, useRef } from 'react';
import {
  oauthAPI,
  gitProviderAPI,
  GitProvider,
  ProviderConnection,
  SyncStatus,
} from '../utils/gitProviderApi';

export interface GitProviderState {
  connected: boolean;
  provider: GitProvider | null;
  giteaUrl: string;
  providerUsername: string;
  connections: ProviderConnection[];
  syncStatus: SyncStatus | null;
  repoConnected: boolean;
  branch: string;
  defaultBranch: string;
  loading: boolean;
}

export function useGitProvider() {
  const [state, setState] = useState<GitProviderState>({
    connected: false,
    provider: null,
    giteaUrl: '',
    providerUsername: '',
    connections: [],
    syncStatus: null,
    repoConnected: false,
    branch: '',
    defaultBranch: '',
    loading: false,
  });

  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshConnections = useCallback(async () => {
    try {
      const connections = await oauthAPI.getConnectedProviders();
      setState(prev => ({
        ...prev,
        connections,
        connected: connections.length > 0,
        provider: connections.length > 0 ? (connections[0].provider as GitProvider) : null,
        providerUsername: connections.length > 0 ? connections[0].username : '',
        giteaUrl: connections.length > 0 ? (connections[0].giteaUrl || '') : '',
      }));
    } catch {
      // Not authenticated or no connections
    }
  }, []);

  const refreshSyncStatus = useCallback(async () => {
    try {
      const status = await gitProviderAPI.getSyncStatus();
      setState(prev => ({
        ...prev,
        syncStatus: status,
        repoConnected: status.state !== 'disconnected',
      }));
    } catch {
      // ignore
    }
  }, []);

  // Start OAuth flow
  const startOAuth = useCallback(async (provider: GitProvider, giteaUrl?: string) => {
    const url = await oauthAPI.startOAuth(provider, giteaUrl);
    window.location.href = url;
  }, []);

  // Save PAT (Gitea fallback)
  const savePAT = useCallback(async (provider: GitProvider, token: string, giteaUrl?: string) => {
    await oauthAPI.savePAT(provider, token, giteaUrl);
    await refreshConnections();
  }, [refreshConnections]);

  // Connect a repo
  const connectRepo = useCallback(async (config: Parameters<typeof gitProviderAPI.connectRepo>[0]) => {
    setState(prev => ({ ...prev, loading: true }));
    try {
      const result = await gitProviderAPI.connectRepo(config);
      setState(prev => ({
        ...prev,
        repoConnected: true,
        branch: result.branch,
        loading: false,
      }));
      return result;
    } catch (e) {
      setState(prev => ({ ...prev, loading: false }));
      throw e;
    }
  }, []);

  // Debounced save + commit
  const saveAndCommit = useCallback(async (path: string, content: string) => {
    await gitProviderAPI.saveFile(path, content);

    // Debounce the commit+push
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        setState(prev => ({ ...prev, syncStatus: { ...prev.syncStatus!, state: 'pushing' } }));
        await gitProviderAPI.commit(`Update ${path}`);
        setState(prev => ({ ...prev, syncStatus: { ...prev.syncStatus!, state: 'synced', lastSync: new Date().toISOString() } }));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Push failed';
        const isConflict = message.includes('conflict');
        setState(prev => ({
          ...prev,
          syncStatus: {
            ...prev.syncStatus!,
            state: isConflict ? 'conflict' : 'error',
            message,
          },
        }));
      }
    }, 3000); // 3s debounce
  }, []);

  // Initial load
  useEffect(() => {
    refreshConnections();
    refreshSyncStatus();
  }, [refreshConnections, refreshSyncStatus]);

  // Periodic sync status polling
  useEffect(() => {
    if (state.repoConnected) {
      syncTimerRef.current = setInterval(refreshSyncStatus, 30000);
    }
    return () => {
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);
    };
  }, [state.repoConnected, refreshSyncStatus]);

  return {
    ...state,
    startOAuth,
    savePAT,
    connectRepo,
    saveAndCommit,
    refreshConnections,
    refreshSyncStatus,
    createBranch: gitProviderAPI.createBranch,
    createPR: gitProviderAPI.createPR,
    sync: gitProviderAPI.sync,
  };
}
