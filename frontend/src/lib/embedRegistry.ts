// embedRegistry.ts — Registry for embeddable content from Sheets

export type EmbedType = 'chart' | 'range';

export interface EmbedEntry {
  id: string;
  sourceFile: string;       // path to .sheet.md file
  embedType: EmbedType;
  label: string;            // human-readable name (e.g. "Sales Chart", "A1:D10")
  snapshot: string;         // rendered SVG or HTML string
  updatedAt: number;        // timestamp of last snapshot
}

const STORAGE_KEY = 'md-office-embeds';

function load(): Map<string, EmbedEntry> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    const arr: EmbedEntry[] = JSON.parse(raw);
    return new Map(arr.map(e => [e.id, e]));
  } catch {
    return new Map();
  }
}

function save(map: Map<string, EmbedEntry>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...map.values()]));
}

let registry = load();
const listeners = new Set<() => void>();

function notify() {
  save(registry);
  listeners.forEach(fn => fn());
}

export const embedRegistry = {
  getAll(): EmbedEntry[] {
    return [...registry.values()];
  },

  get(id: string): EmbedEntry | undefined {
    return registry.get(id);
  },

  register(entry: EmbedEntry) {
    registry.set(entry.id, entry);
    notify();
  },

  update(id: string, snapshot: string) {
    const entry = registry.get(id);
    if (entry) {
      entry.snapshot = snapshot;
      entry.updatedAt = Date.now();
      notify();
    }
  },

  remove(id: string) {
    registry.delete(id);
    notify();
  },

  getBySource(sourceFile: string): EmbedEntry[] {
    return [...registry.values()].filter(e => e.sourceFile === sourceFile);
  },

  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  /** Generate a unique embed ID */
  generateId(): string {
    return `embed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  },

  /** Reload from storage (useful after external changes) */
  reload() {
    registry = load();
    listeners.forEach(fn => fn());
  },
};
