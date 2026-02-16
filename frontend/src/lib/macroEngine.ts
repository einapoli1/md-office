/**
 * Macro Engine — sandboxed JavaScript execution for MD Office macros.
 */

export interface MacroContext {
  /** Get full document text */
  getDocText: () => string;
  /** Insert text at optional position (append if omitted) */
  insertText: (text: string, position?: number) => void;
  /** Replace all occurrences */
  replaceAll: (search: string, replace: string) => void;
  /** Get selected text */
  getSelection: () => string;
  /** Sheet cell getter */
  getCell: (col: number, row: number) => unknown;
  /** Sheet cell setter */
  setCell: (col: number, row: number, value: unknown) => void;
  /** Sheet range getter */
  getRange: (startCol: number, startRow: number, endCol: number, endRow: number) => unknown[][];
  /** Show alert */
  alert: (message: string) => void;
  /** Show prompt (returns promise) */
  prompt: (message: string) => Promise<string | null>;
  /** Show toast */
  toast: (message: string) => void;
  /** Console log capture */
  log: (message: string) => void;
}

export interface MacroResult {
  returnValue: unknown;
  logs: string[];
  error?: string;
}

const BLOCKED_GLOBALS = [
  'window', 'document', 'globalThis', 'self',
  'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource',
  'eval', 'Function', 'importScripts',
  'setTimeout', 'setInterval', 'requestAnimationFrame',
  'localStorage', 'sessionStorage', 'indexedDB',
  'navigator', 'location', 'history',
  'alert', 'confirm', 'prompt',
  'Worker', 'SharedWorker', 'ServiceWorker',
  'Notification', 'postMessage',
];

export async function runMacro(code: string, context: MacroContext): Promise<MacroResult> {
  const logs: string[] = [];

  const md = {
    doc: {
      getText: () => context.getDocText(),
      insertText: (text: string, position?: number) => context.insertText(text, position),
      replaceAll: (search: string, replace: string) => context.replaceAll(search, replace),
      getSelection: () => context.getSelection(),
    },
    sheet: {
      getCell: (col: number, row: number) => context.getCell(col, row),
      setCell: (col: number, row: number, value: unknown) => context.setCell(col, row, value),
      getRange: (startCol: number, startRow: number, endCol: number, endRow: number) =>
        context.getRange(startCol, startRow, endCol, endRow),
    },
    ui: {
      alert: (message: string) => context.alert(message),
      prompt: (message: string) => context.prompt(message),
      toast: (message: string) => context.toast(message),
    },
  };

  const console_proxy = {
    log: (...args: unknown[]) => {
      const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
      logs.push(msg);
      context.log(msg);
    },
    warn: (...args: unknown[]) => console_proxy.log('[warn]', ...args),
    error: (...args: unknown[]) => console_proxy.log('[error]', ...args),
    info: (...args: unknown[]) => console_proxy.log('[info]', ...args),
  };

  // Build blocked global overrides
  const blockedParams = BLOCKED_GLOBALS.join(',');
  const blockedArgs = BLOCKED_GLOBALS.map(() => 'undefined');

  // Wrap user code in an async IIFE so await works
  const wrappedCode = `
    "use strict";
    return (async () => {
      ${code}
    })();
  `;

  try {
    // Use Function constructor with blocked globals as parameters set to undefined
    // eslint-disable-next-line no-new-func
    const factory = new Function('md', 'console', blockedParams, wrappedCode);

    // Timeout via AbortController pattern with Promise.race
    const timeout = 5000;
    let timer: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Macro timed out (5s limit)')), timeout);
    });

    const execPromise = factory(md, console_proxy, ...blockedArgs);
    const returnValue = await Promise.race([execPromise, timeoutPromise]);
    clearTimeout(timer!);

    return { returnValue, logs };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return { returnValue: undefined, logs, error };
  }
}

/** Saved macro */
export interface SavedMacro {
  name: string;
  code: string;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = 'md-office-macros';

export function loadSavedMacros(): SavedMacro[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveMacro(macro: SavedMacro): void {
  const macros = loadSavedMacros();
  const idx = macros.findIndex(m => m.name === macro.name);
  if (idx >= 0) {
    macros[idx] = macro;
  } else {
    macros.push(macro);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(macros));
}

export function deleteMacro(name: string): void {
  const macros = loadSavedMacros().filter(m => m.name !== name);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(macros));
}

export const EXAMPLE_MACROS: Record<string, string> = {
  'Word Count Alert': `const text = md.doc.getText();
const words = text.trim().split(/\\s+/).filter(w => w.length > 0).length;
const chars = text.length;
md.ui.alert(\`Words: \${words}\\nCharacters: \${chars}\`);`,

  'Title Case Selection': `const sel = md.doc.getSelection();
if (!sel) { md.ui.toast('No text selected'); return; }
const titled = sel.replace(/\\w\\S*/g, t =>
  t.charAt(0).toUpperCase() + t.substr(1).toLowerCase()
);
md.doc.replaceAll(sel, titled);
md.ui.toast('Converted to title case');`,

  'Insert Date': `const now = new Date();
const date = now.toLocaleDateString('en-US', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
});
md.doc.insertText(date);
md.ui.toast('Date inserted');`,

  'Sort Lines': `const text = md.doc.getText();
const sorted = text.split('\\n').sort((a, b) => a.localeCompare(b)).join('\\n');
md.doc.replaceAll(text, sorted);
md.ui.toast('Lines sorted');`,

  'Remove Duplicates': `const text = md.doc.getText();
const lines = text.split('\\n');
const unique = [...new Set(lines)];
md.doc.replaceAll(text, unique.join('\\n'));
md.ui.toast(\`Removed \${lines.length - unique.length} duplicate lines\`);`,
};
