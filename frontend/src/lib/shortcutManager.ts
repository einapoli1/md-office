// Keyboard shortcut manager for MD Office
// Supports single keys, modifier combos, and multi-chord sequences

import { commandRegistry } from './commandRegistry';

export interface ShortcutBinding {
  commandId: string;
  keys: string; // e.g. "Cmd+Shift+P", "Cmd+K Cmd+C" (multi-chord)
  context?: ('docs' | 'sheets' | 'slides' | 'draw' | 'database')[];
  when?: string; // optional condition identifier
}

interface ParsedKey {
  key: string;
  meta: boolean;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
}

function parseKeyCombo(combo: string): ParsedKey {
  const parts = combo.toLowerCase().split('+').map(s => s.trim());
  const result: ParsedKey = { key: '', meta: false, ctrl: false, shift: false, alt: false };
  for (const p of parts) {
    if (p === 'cmd' || p === 'meta' || p === '⌘') result.meta = true;
    else if (p === 'ctrl') result.ctrl = true;
    else if (p === 'shift' || p === '⇧') result.shift = true;
    else if (p === 'alt' || p === 'opt' || p === 'option') result.alt = true;
    else result.key = p;
  }
  return result;
}

function eventMatchesParsed(e: KeyboardEvent, parsed: ParsedKey): boolean {
  const key = e.key.toLowerCase();
  const matchKey = key === parsed.key ||
    (parsed.key === '\\' && key === '\\') ||
    (parsed.key === '/' && key === '/') ||
    (parsed.key === '.' && key === '.') ||
    (parsed.key === ';' && key === ';') ||
    (parsed.key === 'enter' && key === 'enter') ||
    (parsed.key === 'escape' && key === 'escape') ||
    (parsed.key === 'space' && key === ' ') ||
    // Number keys
    (/^\d$/.test(parsed.key) && key === parsed.key) ||
    // Letter keys
    (/^[a-z]$/.test(parsed.key) && key === parsed.key) ||
    // Arrow keys
    (parsed.key === 'up' && key === 'arrowup') ||
    (parsed.key === 'down' && key === 'arrowdown') ||
    (parsed.key === 'left' && key === 'arrowleft') ||
    (parsed.key === 'right' && key === 'arrowright');

  return matchKey &&
    e.metaKey === parsed.meta &&
    e.ctrlKey === parsed.ctrl &&
    e.shiftKey === parsed.shift &&
    e.altKey === parsed.alt;
}

class ShortcutManager {
  private bindings: ShortcutBinding[] = [];
  private customOverrides: Map<string, string> = new Map(); // commandId -> keys
  private pendingChord: ParsedKey | null = null;
  private pendingTimeout: ReturnType<typeof setTimeout> | null = null;
  private currentContext: 'docs' | 'sheets' | 'slides' | 'draw' | 'database' = 'docs';
  private enabled = true;

  constructor() {
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.loadCustomBindings();
  }

  install(): void {
    window.addEventListener('keydown', this.handleKeyDown, true);
  }

  uninstall(): void {
    window.removeEventListener('keydown', this.handleKeyDown, true);
  }

  setContext(ctx: 'docs' | 'sheets' | 'slides' | 'draw' | 'database' | 'database'): void {
    this.currentContext = ctx;
  }

  getContext(): string {
    return this.currentContext;
  }

  setEnabled(v: boolean): void {
    this.enabled = v;
  }

  registerBinding(binding: ShortcutBinding): void {
    // Remove existing binding for same command
    this.bindings = this.bindings.filter(b => b.commandId !== binding.commandId);
    this.bindings.push(binding);
  }

  unregisterBinding(commandId: string): void {
    this.bindings = this.bindings.filter(b => b.commandId !== commandId);
  }

  setCustomBinding(commandId: string, keys: string): void {
    this.customOverrides.set(commandId, keys);
    this.saveCustomBindings();
  }

  removeCustomBinding(commandId: string): void {
    this.customOverrides.delete(commandId);
    this.saveCustomBindings();
  }

  getEffectiveKey(binding: ShortcutBinding): string {
    return this.customOverrides.get(binding.commandId) ?? binding.keys;
  }

  getAllBindings(): ShortcutBinding[] {
    return this.bindings.map(b => ({
      ...b,
      keys: this.getEffectiveKey(b),
    }));
  }

  detectConflicts(): Array<{ key: string; commands: string[] }> {
    const map = new Map<string, string[]>();
    for (const b of this.bindings) {
      const key = this.getEffectiveKey(b).toLowerCase();
      const ctx = b.context?.join(',') ?? 'all';
      const mapKey = `${key}|${ctx}`;
      const arr = map.get(mapKey) ?? [];
      arr.push(b.commandId);
      map.set(mapKey, arr);
    }
    const conflicts: Array<{ key: string; commands: string[] }> = [];
    for (const [key, cmds] of map) {
      if (cmds.length > 1) {
        conflicts.push({ key: key.split('|')[0], commands: cmds });
      }
    }
    return conflicts;
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.enabled) return;

    // Don't intercept when typing in inputs (except for global shortcuts)
    const target = e.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

    for (const binding of this.bindings) {
      // Context filter
      if (binding.context && !binding.context.includes(this.currentContext)) continue;

      const effectiveKeys = this.getEffectiveKey(binding);
      const chords = effectiveKeys.split(' ').map(s => s.trim()).filter(Boolean);

      if (chords.length === 2) {
        // Multi-chord shortcut
        const [first, second] = chords.map(parseKeyCombo);
        if (this.pendingChord) {
          // Check second chord
          if (eventMatchesParsed(e, second) && this.chordMatches(this.pendingChord, first)) {
            e.preventDefault();
            e.stopPropagation();
            this.clearPending();
            commandRegistry.executeCommand(binding.commandId);
            return;
          }
        } else if (eventMatchesParsed(e, first)) {
          // Start chord sequence
          e.preventDefault();
          e.stopPropagation();
          this.pendingChord = first;
          this.pendingTimeout = setTimeout(() => this.clearPending(), 2000);
          return;
        }
      } else if (chords.length === 1) {
        if (this.pendingChord) continue; // In chord mode, skip single shortcuts
        const parsed = parseKeyCombo(chords[0]);
        // If in input and no modifier, skip (let normal typing through)
        if (isInput && !parsed.meta && !parsed.ctrl && !parsed.alt) continue;
        if (eventMatchesParsed(e, parsed)) {
          e.preventDefault();
          e.stopPropagation();
          commandRegistry.executeCommand(binding.commandId);
          return;
        }
      }
    }

    // If we had a pending chord and nothing matched, clear it
    if (this.pendingChord) {
      this.clearPending();
    }
  }

  private chordMatches(a: ParsedKey, b: ParsedKey): boolean {
    return a.key === b.key && a.meta === b.meta && a.ctrl === b.ctrl && a.shift === b.shift && a.alt === b.alt;
  }

  private clearPending(): void {
    this.pendingChord = null;
    if (this.pendingTimeout) {
      clearTimeout(this.pendingTimeout);
      this.pendingTimeout = null;
    }
  }

  private loadCustomBindings(): void {
    try {
      const raw = localStorage.getItem('md-office-custom-keys');
      if (raw) {
        const data = JSON.parse(raw) as Record<string, string>;
        for (const [k, v] of Object.entries(data)) {
          this.customOverrides.set(k, v);
        }
      }
    } catch {
      // ignore
    }
  }

  private saveCustomBindings(): void {
    try {
      const obj: Record<string, string> = {};
      for (const [k, v] of this.customOverrides) {
        obj[k] = v;
      }
      localStorage.setItem('md-office-custom-keys', JSON.stringify(obj));
    } catch {
      // ignore
    }
  }
}

export const shortcutManager = new ShortcutManager();
