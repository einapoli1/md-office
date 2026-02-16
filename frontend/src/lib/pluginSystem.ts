// Plugin system for MD Office
import { commandRegistry, CommandCategory } from './commandRegistry';

// ── Plugin interfaces ──

export interface PluginMeta {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
}

export interface Plugin extends PluginMeta {
  activate(api: PluginAPI): void | Promise<void>;
  deactivate(): void | Promise<void>;
}

export interface PluginSetting {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  default: unknown;
  options?: { label: string; value: unknown }[];
}

export interface SidebarPanel {
  pluginId: string;
  icon: string;
  title: string;
  render: () => string; // returns HTML string
}

export interface StatusBarItem {
  id: string;
  pluginId: string;
  text: string;
  tooltip?: string;
  position: 'left' | 'center' | 'right';
  priority?: number;
  onClick?: () => void;
}

export type PluginEventType =
  | 'onDocOpen'
  | 'onSave'
  | 'onSelectionChange'
  | 'onContentChange'
  | 'onThemeChange';

export type PluginEventHandler = (...args: unknown[]) => void;

// ── Plugin API ──

export interface PluginAPI {
  // Editor
  getContent(): string;
  setContent(content: string): void;
  getSelection(): string;
  insertText(text: string): void;

  // Commands & menus
  registerCommand(id: string, label: string, category: CommandCategory, execute: () => void, shortcut?: string): void;
  unregisterCommand(id: string): void;
  registerMenuItem(menu: string, label: string, action: () => void, position?: number): void;
  unregisterMenuItem(menu: string, label: string): void;

  // Sidebar
  registerSidebarPanel(icon: string, title: string, renderFn: () => string): void;
  unregisterSidebarPanel(title: string): void;

  // Status bar
  registerStatusBarItem(id: string, text: string, position?: 'left' | 'center' | 'right', tooltip?: string, onClick?: () => void): void;
  updateStatusBarItem(id: string, text: string, tooltip?: string): void;
  unregisterStatusBarItem(id: string): void;

  // Keyboard shortcuts
  registerShortcut(keys: string, action: () => void): void;
  unregisterShortcut(keys: string): void;

  // Events
  on(event: PluginEventType, handler: PluginEventHandler): void;
  off(event: PluginEventType, handler: PluginEventHandler): void;

  // Settings
  registerSettings(settings: PluginSetting[]): void;
  getSetting<T = unknown>(key: string): T;
  setSetting(key: string, value: unknown): void;

  // Notifications
  showNotification(message: string, type?: 'info' | 'success' | 'warning' | 'error'): void;
}

// ── Plugin state ──

export interface PluginState {
  meta: PluginMeta;
  enabled: boolean;
  factory: () => Plugin;
  instance?: Plugin;
  settings: Record<string, unknown>;
  registeredSettings: PluginSetting[];
}

// ── Plugin Manager (singleton) ──

type ManagerListener = () => void;

class PluginManager {
  private plugins: Map<string, PluginState> = new Map();
  private sidebarPanels: SidebarPanel[] = [];
  private statusBarItems: StatusBarItem[] = [];
  private menuItems: Map<string, { label: string; action: () => void; position: number }[]> = new Map();
  private eventHandlers: Map<PluginEventType, Set<PluginEventHandler>> = new Map();
  private shortcuts: Map<string, () => void> = new Map();
  private listeners: Set<ManagerListener> = new Set();
  private editorRef: { getContent: () => string; setContent: (c: string) => void; getSelection: () => string; insertText: (t: string) => void } | null = null;

  // ── Listener management ──
  subscribe(fn: ManagerListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    this.listeners.forEach(fn => fn());
  }

  // ── Editor bridge ──
  setEditorBridge(bridge: typeof this.editorRef) {
    this.editorRef = bridge;
  }

  // ── Install / Uninstall ──
  install(factory: () => Plugin): void {
    const p = factory();
    if (this.plugins.has(p.id)) return;
    const saved = this.loadPersistedState(p.id);
    this.plugins.set(p.id, {
      meta: { id: p.id, name: p.name, version: p.version, author: p.author, description: p.description },
      enabled: saved?.enabled ?? true,
      factory,
      settings: saved?.settings ?? {},
      registeredSettings: [],
    });
    if (saved?.enabled !== false) {
      this.activate(p.id);
    }
    this.notify();
  }

  uninstall(id: string): void {
    this.deactivate(id);
    this.plugins.delete(id);
    localStorage.removeItem(`mdoffice-plugin-${id}`);
    this.notify();
  }

  // ── Activate / Deactivate ──
  activate(id: string): void {
    const state = this.plugins.get(id);
    if (!state || state.instance) return;
    const plugin = state.factory();
    state.instance = plugin;
    state.enabled = true;
    const api = this.createAPI(id);
    try {
      plugin.activate(api);
    } catch (e) {
      console.error(`Plugin ${id} activation failed:`, e);
      state.instance = undefined;
      state.enabled = false;
    }
    this.persistState(id);
    this.notify();
  }

  deactivate(id: string): void {
    const state = this.plugins.get(id);
    if (!state || !state.instance) return;
    try {
      state.instance.deactivate();
    } catch (e) {
      console.error(`Plugin ${id} deactivation failed:`, e);
    }
    // Clean up registrations
    this.sidebarPanels = this.sidebarPanels.filter(p => p.pluginId !== id);
    this.statusBarItems = this.statusBarItems.filter(i => i.pluginId !== id);
    this.menuItems.forEach(items => {
      const idx = items.findIndex(i => i.label.startsWith(`[${id}]`));
      if (idx >= 0) items.splice(idx, 1);
    });
    state.instance = undefined;
    state.enabled = false;
    state.registeredSettings = [];
    this.persistState(id);
    this.notify();
  }

  toggle(id: string): void {
    const state = this.plugins.get(id);
    if (!state) return;
    if (state.enabled) this.deactivate(id);
    else this.activate(id);
  }

  // ── API factory ──
  private createAPI(pluginId: string): PluginAPI {
    const mgr = this;
    return {
      getContent: () => mgr.editorRef?.getContent() ?? '',
      setContent: (c) => mgr.editorRef?.setContent(c),
      getSelection: () => mgr.editorRef?.getSelection() ?? '',
      insertText: (t) => mgr.editorRef?.insertText(t),

      registerCommand(id, label, category, execute, shortcut) {
        commandRegistry.registerCommand(`plugin.${pluginId}.${id}`, label, category, execute, shortcut);
      },
      unregisterCommand(id) {
        commandRegistry.unregisterCommand(`plugin.${pluginId}.${id}`);
      },

      registerMenuItem(menu, label, action, position = 100) {
        if (!mgr.menuItems.has(menu)) mgr.menuItems.set(menu, []);
        mgr.menuItems.get(menu)!.push({ label, action, position });
        mgr.notify();
      },
      unregisterMenuItem(menu, label) {
        const items = mgr.menuItems.get(menu);
        if (items) {
          const idx = items.findIndex(i => i.label === label);
          if (idx >= 0) items.splice(idx, 1);
          mgr.notify();
        }
      },

      registerSidebarPanel(icon, title, renderFn) {
        mgr.sidebarPanels.push({ pluginId, icon, title, render: renderFn });
        mgr.notify();
      },
      unregisterSidebarPanel(title) {
        mgr.sidebarPanels = mgr.sidebarPanels.filter(p => !(p.pluginId === pluginId && p.title === title));
        mgr.notify();
      },

      registerStatusBarItem(id, text, position = 'right', tooltip, onClick) {
        mgr.statusBarItems.push({ id: `${pluginId}.${id}`, pluginId, text, position, tooltip, onClick });
        mgr.notify();
      },
      updateStatusBarItem(id, text, tooltip) {
        const item = mgr.statusBarItems.find(i => i.id === `${pluginId}.${id}`);
        if (item) { item.text = text; if (tooltip !== undefined) item.tooltip = tooltip; mgr.notify(); }
      },
      unregisterStatusBarItem(id) {
        mgr.statusBarItems = mgr.statusBarItems.filter(i => i.id !== `${pluginId}.${id}`);
        mgr.notify();
      },

      registerShortcut(keys, action) {
        mgr.shortcuts.set(`${pluginId}:${keys}`, action);
      },
      unregisterShortcut(keys) {
        mgr.shortcuts.delete(`${pluginId}:${keys}`);
      },

      on(event, handler) {
        if (!mgr.eventHandlers.has(event)) mgr.eventHandlers.set(event, new Set());
        mgr.eventHandlers.get(event)!.add(handler);
      },
      off(event, handler) {
        mgr.eventHandlers.get(event)?.delete(handler);
      },

      registerSettings(settings) {
        const state = mgr.plugins.get(pluginId);
        if (state) {
          state.registeredSettings = settings;
          for (const s of settings) {
            if (!(s.key in state.settings)) state.settings[s.key] = s.default;
          }
          mgr.notify();
        }
      },
      getSetting<T = unknown>(key: string): T {
        const state = mgr.plugins.get(pluginId);
        return (state?.settings[key] ?? undefined) as T;
      },
      setSetting(key, value) {
        const state = mgr.plugins.get(pluginId);
        if (state) { state.settings[key] = value; mgr.persistState(pluginId); mgr.notify(); }
      },

      showNotification(message, type = 'info') {
        window.dispatchEvent(new CustomEvent('plugin-notification', { detail: { message, type } }));
      },
    };
  }

  // ── Event dispatch ──
  emit(event: PluginEventType, ...args: unknown[]): void {
    this.eventHandlers.get(event)?.forEach(handler => {
      try { handler(...args); } catch (e) { console.error(`Plugin event handler error (${event}):`, e); }
    });
  }

  // ── Getters ──
  getPlugins(): PluginState[] {
    return Array.from(this.plugins.values());
  }

  getPlugin(id: string): PluginState | undefined {
    return this.plugins.get(id);
  }

  getSidebarPanels(): SidebarPanel[] {
    return [...this.sidebarPanels];
  }

  getStatusBarItems(position?: 'left' | 'center' | 'right'): StatusBarItem[] {
    if (position) return this.statusBarItems.filter(i => i.position === position);
    return [...this.statusBarItems];
  }

  getMenuItems(menu: string): { label: string; action: () => void; position: number }[] {
    return (this.menuItems.get(menu) ?? []).sort((a, b) => a.position - b.position);
  }

  // ── Persistence ──
  private persistState(id: string): void {
    const state = this.plugins.get(id);
    if (!state) return;
    localStorage.setItem(`mdoffice-plugin-${id}`, JSON.stringify({ enabled: state.enabled, settings: state.settings }));
  }

  private loadPersistedState(id: string): { enabled: boolean; settings: Record<string, unknown> } | null {
    try {
      const raw = localStorage.getItem(`mdoffice-plugin-${id}`);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
}

export const pluginManager = new PluginManager();
