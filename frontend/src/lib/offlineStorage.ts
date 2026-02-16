// Thin IndexedDB wrapper for offline document storage — no external deps

const DB_NAME = 'md-office';
const DB_VERSION = 1;
const DOC_STORE = 'documents';
const QUEUE_STORE = 'syncQueue';

interface StoredDocument {
  path: string;
  content: string;
  title: string;
  type: string; // docs | sheets | slides | draw
  lastModified: number;
  dirty: boolean; // needs sync
}

interface SyncQueueItem {
  id?: number;
  path: string;
  content: string;
  timestamp: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DOC_STORE)) {
        db.createObjectStore(DOC_STORE, { keyPath: 'path' });
      }
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(storeName: string, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(storeName, mode);
        const store = t.objectStore(storeName);
        const req = fn(store);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

export async function saveDocument(path: string, content: string, title: string, type: string): Promise<void> {
  const doc: StoredDocument = { path, content, title, type, lastModified: Date.now(), dirty: true };
  await tx(DOC_STORE, 'readwrite', (s) => s.put(doc));
}

export async function getDocument(path: string): Promise<StoredDocument | undefined> {
  return tx(DOC_STORE, 'readonly', (s) => s.get(path));
}

export async function getAllDocuments(): Promise<StoredDocument[]> {
  return tx(DOC_STORE, 'readonly', (s) => s.getAll());
}

export async function markClean(path: string): Promise<void> {
  const doc = await getDocument(path);
  if (doc) {
    doc.dirty = false;
    await tx(DOC_STORE, 'readwrite', (s) => s.put(doc));
  }
}

export async function enqueueSync(path: string, content: string): Promise<void> {
  const item: SyncQueueItem = { path, content, timestamp: Date.now() };
  await tx(QUEUE_STORE, 'readwrite', (s) => s.add(item));
}

export async function drainSyncQueue(): Promise<SyncQueueItem[]> {
  const items = await tx<SyncQueueItem[]>(QUEUE_STORE, 'readonly', (s) => s.getAll());
  if (items.length > 0) {
    await tx(QUEUE_STORE, 'readwrite', (s) => s.clear() as unknown as IDBRequest<SyncQueueItem[]>);
  }
  return items;
}

// Auto-save helper: call from editor, debounced externally
let _autoSaveTimer: ReturnType<typeof setInterval> | null = null;
let _pendingContent: { path: string; content: string; title: string; type: string } | null = null;

export function scheduleAutoSave(path: string, content: string, title: string, type: string): void {
  _pendingContent = { path, content, title, type };
  if (!_autoSaveTimer) {
    _autoSaveTimer = setInterval(async () => {
      if (_pendingContent) {
        const p = _pendingContent;
        _pendingContent = null;
        await saveDocument(p.path, p.content, p.title, p.type);
        if (!navigator.onLine) {
          await enqueueSync(p.path, p.content);
        }
      }
    }, 5000);
  }
}

export function stopAutoSave(): void {
  if (_autoSaveTimer) {
    clearInterval(_autoSaveTimer);
    _autoSaveTimer = null;
  }
  _pendingContent = null;
}

// On reconnect, flush pending changes
export async function syncPendingChanges(saveFn: (path: string, content: string) => Promise<void>): Promise<number> {
  const items = await drainSyncQueue();
  let synced = 0;
  for (const item of items) {
    try {
      await saveFn(item.path, item.content);
      await markClean(item.path);
      synced++;
    } catch {
      // re-enqueue on failure
      await enqueueSync(item.path, item.content);
    }
  }
  return synced;
}

export type { StoredDocument, SyncQueueItem };
