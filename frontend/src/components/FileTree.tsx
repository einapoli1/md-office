import React, { useState } from 'react';
import { FileSystemItem } from '../types';
import { File, Folder, FolderOpen, Plus, Trash2, Search } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SearchResult {
  filePath: string;
  fileName: string;
  line: number;
  content: string;
}

interface FileTreeProps {
  files: FileSystemItem[];
  onFileSelect: (file: FileSystemItem) => void;
  onCreateFile: (name: string, isDirectory: boolean) => void;
  onDelete: (path: string) => void;
  onMoveFile: (sourcePath: string, targetPath: string) => void;
  activeFile?: string;
}

interface CreateDialogProps {
  onClose: () => void;
  onSubmit: (name: string, isDirectory: boolean) => void;
  parentPath?: string;
}

const SearchBar: React.FC<{
  onSearch: (query: string) => void;
  onClearSearch: () => void;
  isSearching: boolean;
}> = ({ onSearch, onClearSearch, isSearching }) => {
  const [query, setQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  const handleClear = () => {
    setQuery('');
    onClearSearch();
  };

  return (
    <div className="search-bar" style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '4px' }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search files..."
          style={{ flex: 1, fontSize: '14px' }}
        />
        <button type="submit" disabled={!query.trim()}>
          <Search size={16} />
        </button>
        {isSearching && (
          <button type="button" onClick={handleClear}>
            Clear
          </button>
        )}
      </form>
    </div>
  );
};

const SearchResults: React.FC<{
  results: SearchResult[];
  onResultSelect: (result: SearchResult) => void;
}> = ({ results, onResultSelect }) => {
  if (results.length === 0) {
    return (
      <div style={{ padding: '16px', color: '#666', fontSize: '14px' }}>
        No results found.
      </div>
    );
  }

  return (
    <div className="search-results" style={{ maxHeight: '300px', overflowY: 'auto' }}>
      {results.map((result, _index) => (
        <div
          key={`${result.filePath}-${result.line}`}
          className="search-result"
          onClick={() => onResultSelect(result)}
          style={{
            padding: '8px 12px',
            borderBottom: '1px solid #f0f0f0',
            cursor: 'pointer',
            fontSize: '13px'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>
            {result.fileName} (line {result.line})
          </div>
          <div style={{ color: '#666', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {result.content}
          </div>
        </div>
      ))}
    </div>
  );
};

const CreateDialog: React.FC<CreateDialogProps> = ({ onClose, onSubmit, parentPath = '' }) => {
  const [name, setName] = useState('');
  const [isDirectory, setIsDirectory] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    const fullPath = parentPath ? `${parentPath}/${name.trim()}` : name.trim();
    onSubmit(fullPath, isDirectory);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Create New {isDirectory ? 'Folder' : 'File'}</h3>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '10px' }}>
            <label>
              <input
                type="radio"
                checked={!isDirectory}
                onChange={() => setIsDirectory(false)}
                style={{ marginRight: '5px' }}
              />
              File
            </label>
            <label style={{ marginLeft: '15px' }}>
              <input
                type="radio"
                checked={isDirectory}
                onChange={() => setIsDirectory(true)}
                style={{ marginRight: '5px' }}
              />
              Folder
            </label>
          </div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`Enter ${isDirectory ? 'folder' : 'file'} name${!isDirectory ? ' (e.g., document.md)' : ''}`}
            autoFocus
          />
          <div className="dialog-actions">
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary">Create</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const SortableFileTreeItem: React.FC<{
  item: FileSystemItem;
  level: number;
  onFileSelect: (file: FileSystemItem) => void;
  onDelete: (path: string) => void;
  activeFile?: string;
  onCreateInFolder: (folderPath: string) => void;
}> = ({ item, level, onFileSelect, onDelete, activeFile, onCreateInFolder }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: item.path });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <FileTreeItem
        item={item}
        level={level}
        onFileSelect={onFileSelect}
        onDelete={onDelete}
        activeFile={activeFile}
        onCreateInFolder={onCreateInFolder}
        dragHandleProps={listeners}
      />
    </div>
  );
};

const FileTreeItem: React.FC<{
  item: FileSystemItem;
  level: number;
  onFileSelect: (file: FileSystemItem) => void;
  onDelete: (path: string) => void;
  activeFile?: string;
  onCreateInFolder: (folderPath: string) => void;
  dragHandleProps?: any;
}> = ({ item, level, onFileSelect, onDelete, activeFile, onCreateInFolder, dragHandleProps }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showActions, setShowActions] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);

  const handleClick = () => {
    if (item.isDirectory) {
      setIsExpanded(!isExpanded);
    } else {
      onFileSelect(item);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete ${item.name}?`)) {
      onDelete(item.path);
    }
  };

  const handleCreateInFolder = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCreateInFolder(item.path);
    setShowContextMenu(false);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (item.isDirectory) {
      e.preventDefault();
      setShowContextMenu(true);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <div
        className={`file-item ${!item.isDirectory && activeFile === item.path ? 'active' : ''}`}
        style={{ paddingLeft: `${level * 16 + 8}px`, display: 'flex', alignItems: 'center' }}
        onClick={handleClick}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
        onContextMenu={handleContextMenu}
        {...(dragHandleProps || {})}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px', flex: 1, cursor: 'pointer' }}>
          {item.isDirectory ? (
            isExpanded ? <FolderOpen size={16} /> : <Folder size={16} />
          ) : (
            <File size={16} />
          )}
          {item.name}
        </span>
        
        {showActions && (
          <div style={{ display: 'flex', gap: '2px' }}>
            {item.isDirectory && (
              <button
                onClick={handleCreateInFolder}
                style={{ padding: '2px', minWidth: 'auto' }}
                title="Create new file/folder"
              >
                <Plus size={12} />
              </button>
            )}
            <button
              onClick={handleDelete}
              style={{ padding: '2px', minWidth: 'auto' }}
              title="Delete"
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>

      {showContextMenu && item.isDirectory && (
        <div 
          style={{
            position: 'absolute',
            top: '100%',
            left: `${level * 16 + 24}px`,
            background: 'white',
            border: '1px solid #ddd',
            borderRadius: '4px',
            padding: '4px 0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            zIndex: 1000,
            minWidth: '120px'
          }}
          onMouseLeave={() => setShowContextMenu(false)}
        >
          <button
            onClick={handleCreateInFolder}
            style={{
              width: '100%',
              padding: '6px 12px',
              border: 'none',
              background: 'transparent',
              textAlign: 'left',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Plus size={14} style={{ marginRight: '6px' }} />
            New File/Folder
          </button>
        </div>
      )}
      
      {item.isDirectory && isExpanded && item.children && (
        <SortableContext items={item.children.map(child => child.path)} strategy={verticalListSortingStrategy}>
          {item.children.map((child) => (
            <SortableFileTreeItem
              key={child.path}
              item={child}
              level={level + 1}
              onFileSelect={onFileSelect}
              onDelete={onDelete}
              activeFile={activeFile}
              onCreateInFolder={onCreateInFolder}
            />
          ))}
        </SortableContext>
      )}
    </div>
  );
};

const FileTree: React.FC<FileTreeProps> = ({ files, onFileSelect, onCreateFile, onDelete, onMoveFile, activeFile }) => {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createInFolder, setCreateInFolder] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [_searchQuery, setSearchQuery] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleCreate = () => {
    setCreateInFolder('');
    setShowCreateDialog(true);
  };

  const handleCreateInFolder = (folderPath: string) => {
    setCreateInFolder(folderPath);
    setShowCreateDialog(true);
  };

  const handleCreateSubmit = (name: string, isDirectory: boolean) => {
    onCreateFile(name, isDirectory);
  };

  const handleSearch = async (query: string) => {
    try {
      setSearchQuery(query);
      setIsSearching(true);
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      
      if (data.error) {
        console.error('Search error:', data.error);
        setSearchResults([]);
      } else {
        setSearchResults(data.data.results || []);
      }
    } catch (error) {
      console.error('Failed to search:', error);
      setSearchResults([]);
    }
  };

  const handleClearSearch = () => {
    setSearchResults([]);
    setIsSearching(false);
    setSearchQuery('');
  };

  const handleSearchResultSelect = (result: SearchResult) => {
    onFileSelect({
      name: result.fileName,
      path: result.filePath,
      isDirectory: false
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const activeItem = findItemByPath(files, active.id as string);
      const overItem = findItemByPath(files, over?.id as string);

      if (activeItem && overItem && overItem.isDirectory) {
        const targetPath = `${overItem.path}/${activeItem.name}`;
        onMoveFile(activeItem.path, targetPath);
      }
    }
  };

  const findItemByPath = (items: FileSystemItem[], path: string): FileSystemItem | null => {
    for (const item of items) {
      if (item.path === path) {
        return item;
      }
      if (item.children) {
        const found = findItemByPath(item.children, path);
        if (found) return found;
      }
    }
    return null;
  };

  return (
    <div className="file-tree">
      <SearchBar 
        onSearch={handleSearch}
        onClearSearch={handleClearSearch}
        isSearching={isSearching}
      />

      <div className="toolbar">
        <button onClick={handleCreate} title="Create new file/folder">
          <Plus size={16} />
          New
        </button>
      </div>

      {isSearching ? (
        <SearchResults 
          results={searchResults}
          onResultSelect={handleSearchResultSelect}
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={files.map(file => file.path)} strategy={verticalListSortingStrategy}>
            {files.map((file) => (
              <SortableFileTreeItem
                key={file.path}
                item={file}
                level={0}
                onFileSelect={onFileSelect}
                onDelete={onDelete}
                activeFile={activeFile}
                onCreateInFolder={handleCreateInFolder}
              />
            ))}
          </SortableContext>
        </DndContext>
      )}
      
      {showCreateDialog && (
        <CreateDialog
          onClose={() => setShowCreateDialog(false)}
          onSubmit={handleCreateSubmit}
          parentPath={createInFolder}
        />
      )}
    </div>
  );
};

export default FileTree;