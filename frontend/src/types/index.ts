export interface FileSystemItem {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileSystemItem[];
}

export interface FileContent {
  path: string;
  content: string;
  lastModified: string;
}

export interface GitCommit {
  hash: string;
  message: string;
  author: string;
  date: string;
}

export interface GitHistory {
  commits: GitCommit[];
}

export interface GitBranch {
  name: string;
  isCurrent: boolean;
  hash: string;
}

export interface APIResponse<T> {
  data?: T;
  error?: string;
}

// Authentication types
export interface User {
  id: string;
  username: string;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
}

// Workspace types
export interface WorkspaceMember {
  userId: string;
  username: string;
  permission: string; // owner, editor, viewer
  joinedAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  path: string;
  owner: string;
  createdAt: string;
  members: WorkspaceMember[];
  permissions: { [userId: string]: string };
}

export interface WorkspaceListResponse {
  workspaces: Workspace[];
  active: string;
}

export interface CreateWorkspaceRequest {
  name: string;
  path: string;
}

export interface SwitchWorkspaceRequest {
  workspaceId: string;
}

// Branch management types
export interface CreateBranchRequest {
  name: string;
}

export interface CheckoutBranchRequest {
  name: string;
}

export interface MergeBranchRequest {
  branch: string;
}

// Member management types
export interface InviteUserRequest {
  username: string;
  permission: string;
}

// Comment system types
export interface Comment {
  id: string;
  author: string;
  text: string;
  from: number;
  to: number;
  createdAt: string;
  resolved: boolean;
}

export interface CommentsFile {
  path: string;
  comments: Comment[];
}

// Suggestion system types
export interface Suggestion {
  id: string;
  author: string;
  type: 'insert' | 'delete';
  text: string;
  from: number;
  to: number;
  createdAt: string;
  accepted?: boolean;
}

export interface SuggestionsFile {
  path: string;
  suggestions: Suggestion[];
}

// Git diff types
export interface GitDiff {
  hash: string;
  diff: string;
  files: string[];
}