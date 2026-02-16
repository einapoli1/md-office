// embedSync.ts — Tracks staleness of embedded content

import { embedRegistry } from './embedRegistry';

const STALE_KEY = 'md-office-embed-stale';

function loadStale(): Set<string> {
  try {
    const raw = localStorage.getItem(STALE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveStale(set: Set<string>) {
  localStorage.setItem(STALE_KEY, JSON.stringify([...set]));
}

let staleIds = loadStale();
const listeners = new Set<() => void>();

function notify() {
  saveStale(staleIds);
  listeners.forEach(fn => fn());
}

export const embedSync = {
  /** Mark all embeds from a given source file as stale */
  markSourceStale(sourceFile: string) {
    const embeds = embedRegistry.getBySource(sourceFile);
    for (const e of embeds) {
      staleIds.add(e.id);
    }
    if (embeds.length > 0) notify();
  },

  /** Mark a specific embed as stale */
  markStale(id: string) {
    staleIds.add(id);
    notify();
  },

  /** Check if an embed is stale */
  isStale(id: string): boolean {
    return staleIds.has(id);
  },

  /** Clear stale flag (after refresh) */
  clearStale(id: string) {
    if (staleIds.delete(id)) notify();
  },

  /** Refresh an embed — update its snapshot and clear stale */
  refresh(id: string, newSnapshot: string) {
    embedRegistry.update(id, newSnapshot);
    staleIds.delete(id);
    notify();
  },

  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  /** Get all stale IDs */
  getStaleIds(): Set<string> {
    return new Set(staleIds);
  },
};

// Listen for sheet changes and mark embeds stale
window.addEventListener('sheet-data-changed', ((e: CustomEvent<{ filePath: string }>) => {
  if (e.detail?.filePath) {
    embedSync.markSourceStale(e.detail.filePath);
  }
}) as EventListener);
