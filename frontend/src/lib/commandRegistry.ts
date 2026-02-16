// Central command registry for MD Office

export type CommandCategory = 'File' | 'Edit' | 'View' | 'Insert' | 'Format' | 'Tools' | 'Navigate' | 'Sheets' | 'Slides' | 'General';

export interface Command {
  id: string;
  label: string;
  category: CommandCategory;
  execute: () => void;
  shortcut?: string;
  icon?: string;
  context?: ('docs' | 'sheets' | 'slides' | 'draw')[];
  pinned?: boolean;
}

interface CommandEntry extends Command {
  useCount: number;
  lastUsed: number;
}

class CommandRegistry {
  private commands: Map<string, CommandEntry> = new Map();
  private listeners: Set<() => void> = new Set();

  registerCommand(
    id: string,
    label: string,
    category: CommandCategory,
    execute: () => void,
    shortcut?: string,
    icon?: string,
    context?: ('docs' | 'sheets' | 'slides' | 'draw')[]
  ): void {
    const existing = this.commands.get(id);
    this.commands.set(id, {
      id,
      label,
      category,
      execute,
      shortcut,
      icon,
      context,
      pinned: existing?.pinned ?? false,
      useCount: existing?.useCount ?? 0,
      lastUsed: existing?.lastUsed ?? 0,
    });
    this.notify();
  }

  unregisterCommand(id: string): void {
    this.commands.delete(id);
    this.notify();
  }

  executeCommand(id: string): boolean {
    const cmd = this.commands.get(id);
    if (!cmd) return false;
    cmd.useCount++;
    cmd.lastUsed = Date.now();
    this.saveUsageStats();
    cmd.execute();
    return true;
  }

  getCommand(id: string): Command | undefined {
    return this.commands.get(id);
  }

  getAllCommands(): Command[] {
    return Array.from(this.commands.values());
  }

  getCommandsByCategory(category: CommandCategory): Command[] {
    return this.getAllCommands().filter(c => c.category === category);
  }

  getRecentCommands(limit = 10): Command[] {
    return Array.from(this.commands.values())
      .filter(c => c.lastUsed > 0)
      .sort((a, b) => b.lastUsed - a.lastUsed)
      .slice(0, limit);
  }

  togglePin(id: string): void {
    const cmd = this.commands.get(id);
    if (cmd) {
      cmd.pinned = !cmd.pinned;
      this.notify();
    }
  }

  searchCommands(query: string, contextMode?: string): Command[] {
    if (!query.trim()) {
      // Return recent + pinned when empty
      const pinned = Array.from(this.commands.values()).filter(c => c.pinned);
      const recent = this.getRecentCommands(10);
      const seen = new Set(pinned.map(c => c.id));
      const merged: Command[] = [...pinned];
      for (const c of recent) {
        if (!seen.has(c.id)) {
          merged.push(c);
          seen.add(c.id);
        }
      }
      return merged.length > 0 ? merged : Array.from(this.commands.values()).slice(0, 20);
    }

    const results: { cmd: Command; score: number }[] = [];
    const q = query.toLowerCase();

    for (const cmd of this.commands.values()) {
      // Filter by context if provided
      if (contextMode && cmd.context && !cmd.context.includes(contextMode as 'docs' | 'sheets' | 'slides' | 'draw')) {
        continue;
      }
      const score = fuzzyScore(q, cmd.label.toLowerCase());
      if (score > 0) {
        // Boost recently used
        const entry = cmd as CommandEntry;
        const recencyBoost = entry.lastUsed > 0 ? Math.min(20, (Date.now() - entry.lastUsed) < 3600000 ? 20 : 5) : 0;
        results.push({ cmd, score: score + recencyBoost + (cmd.pinned ? 10 : 0) });
      }
    }

    return results.sort((a, b) => b.score - a.score).map(r => r.cmd);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach(l => l());
  }

  private saveUsageStats(): void {
    try {
      const stats: Record<string, { useCount: number; lastUsed: number }> = {};
      for (const [id, cmd] of this.commands) {
        if (cmd.useCount > 0) {
          stats[id] = { useCount: cmd.useCount, lastUsed: cmd.lastUsed };
        }
      }
      localStorage.setItem('md-office-cmd-stats', JSON.stringify(stats));
    } catch {
      // ignore
    }
  }

  loadUsageStats(): void {
    try {
      const raw = localStorage.getItem('md-office-cmd-stats');
      if (!raw) return;
      const stats = JSON.parse(raw) as Record<string, { useCount: number; lastUsed: number }>;
      for (const [id, s] of Object.entries(stats)) {
        const cmd = this.commands.get(id);
        if (cmd) {
          cmd.useCount = s.useCount;
          cmd.lastUsed = s.lastUsed;
        }
      }
    } catch {
      // ignore
    }
  }
}

// Simple fuzzy match scoring — no external deps
function fuzzyScore(query: string, target: string): number {
  if (query.length === 0) return 1;
  if (target.includes(query)) return 100 + (query.length / target.length) * 50;

  let qi = 0;
  let score = 0;
  let consecutive = 0;
  let prevMatch = -2;

  for (let ti = 0; ti < target.length && qi < query.length; ti++) {
    if (target[ti] === query[qi]) {
      qi++;
      score += 10;
      if (ti === prevMatch + 1) {
        consecutive++;
        score += consecutive * 5;
      } else {
        consecutive = 0;
      }
      // Bonus for matching at word boundary
      if (ti === 0 || target[ti - 1] === ' ' || target[ti - 1] === ':') {
        score += 15;
      }
      prevMatch = ti;
    }
  }

  return qi === query.length ? score : 0;
}

export const commandRegistry = new CommandRegistry();
