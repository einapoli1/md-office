import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Types
export type GitProvider = 'github' | 'gitlab' | 'bitbucket' | 'gitea';

export interface ProviderConnection {
  provider: string;
  username: string;
  avatarUrl: string;
  giteaUrl?: string;
}

export interface RemoteRepo {
  id: string;
  name: string;
  fullName: string;
  description: string;
  private: boolean;
  defaultBranch: string;
  cloneUrl: string;
  htmlUrl: string;
  owner: string;
}

export interface RemoteBranch {
  name: string;
  protected: boolean;
  isDefault: boolean;
}

export interface PRResponse {
  id: number;
  number: number;
  htmlUrl: string;
  title: string;
}

export interface SyncStatus {
  state: 'synced' | 'pushing' | 'pulling' | 'conflict' | 'error' | 'dirty' | 'disconnected';
  message?: string;
  lastSync?: string;
  behind: number;
  ahead: number;
}

export interface RepoFile {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modified: string;
}

// OAuth API
export const oauthAPI = {
  startOAuth: async (provider: GitProvider, giteaUrl?: string): Promise<string> => {
    const params = giteaUrl ? `?gitea_url=${encodeURIComponent(giteaUrl)}` : '';
    const resp = await api.get(`/auth/${provider}${params}`);
    return resp.data.url;
  },

  getConnectedProviders: async (): Promise<ProviderConnection[]> => {
    const resp = await api.get('/auth/providers/connected');
    return resp.data.data || [];
  },

  disconnectProvider: async (provider: string, giteaUrl?: string): Promise<void> => {
    const params = giteaUrl ? `?gitea_url=${encodeURIComponent(giteaUrl)}` : '';
    await api.delete(`/auth/providers/${provider}${params}`);
  },

  savePAT: async (provider: string, token: string, giteaUrl?: string): Promise<ProviderConnection> => {
    const resp = await api.post('/auth/providers/pat', { provider, token, giteaUrl: giteaUrl || '' });
    return resp.data.data;
  },
};

// Git Provider API
export const gitProviderAPI = {
  listRepos: async (provider: GitProvider, page = 1, perPage = 20, search = '', giteaUrl?: string): Promise<RemoteRepo[]> => {
    const params = new URLSearchParams({
      provider,
      page: String(page),
      per_page: String(perPage),
      search,
    });
    if (giteaUrl) params.set('gitea_url', giteaUrl);
    const resp = await api.get(`/git-provider/repos?${params}`);
    return resp.data.data || [];
  },

  createRepo: async (provider: GitProvider, name: string, description: string, isPrivate: boolean, giteaUrl?: string): Promise<RemoteRepo> => {
    const params = new URLSearchParams({ provider });
    if (giteaUrl) params.set('gitea_url', giteaUrl);
    const resp = await api.post(`/git-provider/repos?${params}`, { name, description, private: isPrivate });
    return resp.data.data;
  },

  listBranches: async (provider: GitProvider, owner: string, name: string, giteaUrl?: string): Promise<RemoteBranch[]> => {
    const params = new URLSearchParams({ provider });
    if (giteaUrl) params.set('gitea_url', giteaUrl);
    const resp = await api.get(`/git-provider/repos/${owner}/${name}/branches?${params}`);
    return resp.data.data || [];
  },

  connectRepo: async (config: {
    provider: GitProvider;
    giteaUrl?: string;
    owner: string;
    repoName: string;
    cloneUrl: string;
    branch: string;
    defaultBranch: string;
    subdirectory?: string;
  }): Promise<{ connected: boolean; localPath: string; branch: string }> => {
    const resp = await api.post('/git-provider/connect', config);
    return resp.data.data;
  },

  getSyncStatus: async (): Promise<SyncStatus> => {
    const resp = await api.get('/git-provider/status');
    return resp.data.data;
  },

  sync: async (): Promise<void> => {
    await api.post('/git-provider/sync');
  },

  commit: async (message?: string): Promise<void> => {
    await api.post('/git-provider/commit', { message });
  },

  createBranch: async (name: string, checkout = true): Promise<void> => {
    await api.post('/git-provider/create-branch', { name, checkout });
  },

  createPR: async (provider: GitProvider, title: string, body: string, giteaUrl?: string): Promise<PRResponse> => {
    const params = new URLSearchParams({ provider });
    if (giteaUrl) params.set('gitea_url', giteaUrl);
    const resp = await api.post(`/git-provider/create-pr?${params}`, { title, body });
    return resp.data.data;
  },

  listFiles: async (): Promise<RepoFile[]> => {
    const resp = await api.get('/git-provider/files');
    return resp.data.data || [];
  },

  getFile: async (path: string): Promise<{ path: string; content: string; lastModified: string }> => {
    const resp = await api.get(`/git-provider/file/${encodeURIComponent(path)}`);
    return resp.data.data;
  },

  saveFile: async (path: string, content: string): Promise<void> => {
    await api.post('/git-provider/file', { path, content });
  },
};
