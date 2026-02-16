import axios from 'axios';
import { 
  FileSystemItem, 
  FileContent, 
  GitHistory, 
  GitBranch,
  APIResponse,
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  User,
  WorkspaceListResponse,
  CreateWorkspaceRequest,
  SwitchWorkspaceRequest,
  WorkspaceMember,
  InviteUserRequest
} from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Redirect to login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Authentication API
export const authAPI = {
  register: async (credentials: RegisterRequest): Promise<AuthResponse> => {
    const response = await api.post<APIResponse<AuthResponse>>('/auth/register', credentials);
    if (response.data.error) throw new Error(response.data.error);
    return response.data.data!;
  },

  login: async (credentials: LoginRequest): Promise<AuthResponse> => {
    const response = await api.post<APIResponse<AuthResponse>>('/auth/login', credentials);
    if (response.data.error) throw new Error(response.data.error);
    return response.data.data!;
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await api.get<APIResponse<User>>('/auth/me');
    if (response.data.error) throw new Error(response.data.error);
    return response.data.data!;
  }
};

// Workspace API
export const workspaceAPI = {
  getWorkspaces: async (): Promise<WorkspaceListResponse> => {
    const response = await api.get<APIResponse<WorkspaceListResponse>>('/workspaces');
    if (response.data.error) throw new Error(response.data.error);
    return response.data.data!;
  },

  createWorkspace: async (workspace: CreateWorkspaceRequest): Promise<any> => {
    const response = await api.post<APIResponse<any>>('/workspaces', workspace);
    if (response.data.error) throw new Error(response.data.error);
    return response.data.data!;
  },

  switchWorkspace: async (request: SwitchWorkspaceRequest): Promise<void> => {
    const response = await api.post<APIResponse<void>>('/workspaces/switch', request);
    if (response.data.error) throw new Error(response.data.error);
  },

  getMembers: async (workspaceId: string): Promise<WorkspaceMember[]> => {
    const response = await api.get<APIResponse<WorkspaceMember[]>>(`/workspaces/${workspaceId}/members`);
    if (response.data.error) throw new Error(response.data.error);
    return response.data.data!;
  },

  inviteUser: async (workspaceId: string, invite: InviteUserRequest): Promise<WorkspaceMember> => {
    const response = await api.post<APIResponse<WorkspaceMember>>(`/workspaces/${workspaceId}/members`, invite);
    if (response.data.error) throw new Error(response.data.error);
    return response.data.data!;
  },

  removeUser: async (workspaceId: string, userId: string): Promise<void> => {
    const response = await api.delete<APIResponse<void>>(`/workspaces/${workspaceId}/members/${userId}`);
    if (response.data.error) throw new Error(response.data.error);
  }
};

// File API
export const fileAPI = {
  // Get file tree structure
  getFiles: async (): Promise<FileSystemItem[]> => {
    const response = await api.get<APIResponse<FileSystemItem[]>>('/files');
    if (response.data.error) throw new Error(response.data.error);
    return response.data.data || [];
  },

  // Get file content
  getFile: async (path: string): Promise<FileContent> => {
    const response = await api.get<APIResponse<FileContent>>(`/files/${encodeURIComponent(path)}`);
    if (response.data.error) throw new Error(response.data.error);
    return response.data.data!;
  },

  // Save file content
  saveFile: async (path: string, content: string): Promise<void> => {
    const response = await api.post<APIResponse<void>>('/files', { path, content });
    if (response.data.error) throw new Error(response.data.error);
  },

  // Create new file
  createFile: async (path: string, content: string = ''): Promise<void> => {
    const response = await api.post<APIResponse<void>>('/files/create', { path, content });
    if (response.data.error) throw new Error(response.data.error);
  },

  // Create directory
  createDirectory: async (path: string): Promise<void> => {
    const response = await api.post<APIResponse<void>>('/files/mkdir', { path });
    if (response.data.error) throw new Error(response.data.error);
  },

  // Delete file or directory
  deleteItem: async (path: string): Promise<void> => {
    const response = await api.delete<APIResponse<void>>(`/files/${encodeURIComponent(path)}`);
    if (response.data.error) throw new Error(response.data.error);
  },

  // Rename file or directory
  renameItem: async (oldPath: string, newPath: string): Promise<void> => {
    const response = await api.put<APIResponse<void>>('/files/rename', { oldPath, newPath });
    if (response.data.error) throw new Error(response.data.error);
  }
};

// Git API
export const gitAPI = {
  // Get commit history for a file
  getHistory: async (path?: string): Promise<GitHistory> => {
    const url = path ? `/git/history?path=${encodeURIComponent(path)}` : '/git/history';
    const response = await api.get<APIResponse<GitHistory>>(url);
    if (response.data.error) throw new Error(response.data.error);
    return response.data.data!;
  },

  // Revert to a specific commit
  revertToCommit: async (hash: string, path?: string): Promise<void> => {
    const response = await api.post<APIResponse<void>>('/git/revert', { hash, path });
    if (response.data.error) throw new Error(response.data.error);
  },

  // Branch operations
  getBranches: async (): Promise<GitBranch[]> => {
    const response = await api.get<APIResponse<GitBranch[]>>('/git/branches');
    if (response.data.error) throw new Error(response.data.error);
    return response.data.data!;
  },

  createBranch: async (name: string): Promise<void> => {
    const response = await api.post<APIResponse<void>>('/git/branches', { name });
    if (response.data.error) throw new Error(response.data.error);
  },

  checkoutBranch: async (name: string): Promise<void> => {
    const response = await api.post<APIResponse<void>>('/git/checkout', { name });
    if (response.data.error) throw new Error(response.data.error);
  },

  mergeBranch: async (branch: string): Promise<void> => {
    const response = await api.post<APIResponse<void>>('/git/merge', { branch });
    if (response.data.error) throw new Error(response.data.error);
  },

  deleteBranch: async (name: string): Promise<void> => {
    const response = await api.post<APIResponse<void>>('/git/branches', { name, delete: true });
    if (response.data.error) throw new Error(response.data.error);
  },

  getDiff: async (from: string, to: string): Promise<{ from: string; to: string; changes: { file: string; type: string; additions: number; deletions: number; content?: string }[] }> => {
    const response = await api.get<APIResponse<{ from: string; to: string; changes: { file: string; type: string; additions: number; deletions: number; content?: string }[] }>>(`/git/diff?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
    if (response.data.error) throw new Error(response.data.error);
    return response.data.data!;
  },

  getFileAtCommit: async (hash: string, path: string): Promise<string> => {
    const response = await api.get<APIResponse<{ content: string }>>(`/git/file-at?hash=${encodeURIComponent(hash)}&path=${encodeURIComponent(path)}`);
    if (response.data.error) throw new Error(response.data.error);
    return response.data.data?.content || '';
  },

  createTag: async (name: string, hash: string): Promise<void> => {
    const response = await api.post<APIResponse<void>>('/git/tag', { name, hash });
    if (response.data.error) throw new Error(response.data.error);
  },
};