import { FileSystemItem, FileContent } from '../types';

// Local storage-based API for guest mode
const LOCAL_STORAGE_PREFIX = 'md-office-local-';
const FILES_KEY = `${LOCAL_STORAGE_PREFIX}files`;
const FILE_CONTENT_PREFIX = `${LOCAL_STORAGE_PREFIX}file-`;

// Helper to generate unique file paths
function generateUniqueFileName(baseName: string, existingFiles: FileSystemItem[]): string {
  const existingPaths = existingFiles.map(f => f.path);
  
  if (!existingPaths.includes(baseName)) {
    return baseName;
  }
  
  let counter = 1;
  const basePath = baseName.replace(/\.md$/, '');
  while (existingPaths.includes(`${basePath}_${counter}.md`)) {
    counter++;
  }
  
  return `${basePath}_${counter}.md`;
}

export const localFileAPI = {
  // Get file tree structure
  getFiles: async (): Promise<FileSystemItem[]> => {
    const filesJson = localStorage.getItem(FILES_KEY);
    return filesJson ? JSON.parse(filesJson) : [];
  },

  // Get file content
  getFile: async (path: string): Promise<FileContent> => {
    const content = localStorage.getItem(`${FILE_CONTENT_PREFIX}${path}`) || '';
    return {
      path,
      content,
      lastModified: new Date().toISOString()
    };
  },

  // Save file content
  saveFile: async (path: string, content: string): Promise<void> => {
    localStorage.setItem(`${FILE_CONTENT_PREFIX}${path}`, content);
    
    // Update file listing
    const files = await localFileAPI.getFiles();
    const existingIndex = files.findIndex(f => f.path === path);
    
    if (existingIndex === -1) {
      // Add new file to listing
      files.push({
        name: path.split('/').pop() || path,
        path: path,
        isDirectory: false
      });
      localStorage.setItem(FILES_KEY, JSON.stringify(files));
    }
  },

  // Create new file
  createFile: async (path: string, content: string = ''): Promise<void> => {
    const files = await localFileAPI.getFiles();
    const uniquePath = generateUniqueFileName(path, files);
    
    // Save file content
    localStorage.setItem(`${FILE_CONTENT_PREFIX}${uniquePath}`, content);
    
    // Add to file listing
    files.push({
      name: uniquePath.split('/').pop() || uniquePath,
      path: uniquePath,
      isDirectory: false
    });
    localStorage.setItem(FILES_KEY, JSON.stringify(files));
    
    return Promise.resolve();
  },

  // Create directory (not really needed for local mode, but keeping for consistency)
  createDirectory: async (path: string): Promise<void> => {
    const files = await localFileAPI.getFiles();
    files.push({
      name: path.split('/').pop() || path,
      path: path,
      isDirectory: true
    });
    localStorage.setItem(FILES_KEY, JSON.stringify(files));
  },

  // Delete file or directory
  deleteItem: async (path: string): Promise<void> => {
    // Remove file content
    localStorage.removeItem(`${FILE_CONTENT_PREFIX}${path}`);
    
    // Remove from file listing
    const files = await localFileAPI.getFiles();
    const updatedFiles = files.filter(f => f.path !== path);
    localStorage.setItem(FILES_KEY, JSON.stringify(updatedFiles));
  },

  // Rename file or directory
  renameItem: async (oldPath: string, newPath: string): Promise<void> => {
    // Get old content
    const content = localStorage.getItem(`${FILE_CONTENT_PREFIX}${oldPath}`) || '';
    
    // Save with new path
    localStorage.setItem(`${FILE_CONTENT_PREFIX}${newPath}`, content);
    
    // Remove old file
    localStorage.removeItem(`${FILE_CONTENT_PREFIX}${oldPath}`);
    
    // Update file listing
    const files = await localFileAPI.getFiles();
    const fileIndex = files.findIndex(f => f.path === oldPath);
    if (fileIndex !== -1) {
      files[fileIndex] = {
        ...files[fileIndex],
        name: newPath.split('/').pop() || newPath,
        path: newPath
      };
      localStorage.setItem(FILES_KEY, JSON.stringify(files));
    }
  }
};

// Initialize local storage with a sample document if empty
export const initializeLocalStorage = () => {
  const files = localStorage.getItem(FILES_KEY);
  if (!files) {
    const sampleFiles = [
      {
        name: 'Welcome.md',
        path: 'Welcome.md',
        isDirectory: false
      }
    ];
    
    const sampleContent = `# Welcome to MD Office

This is your local workspace! You're currently using MD Office in **guest mode**, which means your documents are stored locally in your browser.

## Features Available

- ✅ Rich text editing with the Google Docs-style toolbar
- ✅ Markdown support
- ✅ Local storage (documents saved in browser)
- ✅ Dark/light theme
- ✅ Document templates

## Create Your First Document

Click the **"Blank document"** button in the sidebar to create a new document.

## Need More Features?

For cloud storage, collaboration, and version history, you can create an account using the login option.

---

*Happy writing! 🚀*
`;
    
    localStorage.setItem(FILES_KEY, JSON.stringify(sampleFiles));
    localStorage.setItem(`${FILE_CONTENT_PREFIX}Welcome.md`, sampleContent);
  }
};