import { AppMode } from '../App';

export interface Command {
  id: string;
  label: string;
  icon: string;
  category: 'format' | 'insert' | 'navigation' | 'view' | 'edit' | 'slide' | 'sheet';
  appModes: AppMode[];
  execute: (editor: any, context: CommandContext) => void;
}

export interface CommandContext {
  appMode: AppMode;
  editor: any;
  /** Cycle state for commands that cycle through options */
  cycleState?: Record<string, number>;
}

// Shared cycle state stored in memory
const cycleStates: Record<string, number> = {};

function nextCycle(key: string, max: number): number {
  const current = (cycleStates[key] ?? -1) + 1;
  cycleStates[key] = current >= max ? 0 : current;
  return cycleStates[key];
}

const commands: Command[] = [
  // === FORMAT ===
  { id: 'bold', label: 'Bold', icon: 'B', category: 'format', appModes: ['docs', 'sheets', 'slides'],
    execute: (editor) => editor?.chain().focus().toggleBold().run() },
  { id: 'italic', label: 'Italic', icon: 'I', category: 'format', appModes: ['docs', 'sheets', 'slides'],
    execute: (editor) => editor?.chain().focus().toggleItalic().run() },
  { id: 'underline', label: 'Underline', icon: 'U', category: 'format', appModes: ['docs', 'sheets', 'slides'],
    execute: (editor) => editor?.chain().focus().toggleUnderline().run() },
  { id: 'strikethrough', label: 'Strikethrough', icon: 'S̶', category: 'format', appModes: ['docs', 'sheets', 'slides'],
    execute: (editor) => editor?.chain().focus().toggleStrike().run() },
  { id: 'superscript', label: 'Superscript', icon: 'x²', category: 'format', appModes: ['docs'],
    execute: (editor) => editor?.chain().focus().toggleSuperscript().run() },
  { id: 'subscript', label: 'Subscript', icon: 'x₂', category: 'format', appModes: ['docs'],
    execute: (editor) => editor?.chain().focus().toggleSubscript().run() },
  { id: 'highlight', label: 'Highlight', icon: '🖍', category: 'format', appModes: ['docs'],
    execute: (editor) => editor?.chain().focus().toggleHighlight().run() },
  { id: 'clear-format', label: 'Clear formatting', icon: '⌀', category: 'format', appModes: ['docs', 'sheets', 'slides'],
    execute: (editor) => editor?.chain().focus().clearNodes().unsetAllMarks().run() },
  { id: 'text-color-red', label: 'Red text', icon: 'A', category: 'format', appModes: ['docs'],
    execute: (editor) => editor?.chain().focus().setColor('#d93025').run() },
  { id: 'text-color-blue', label: 'Blue text', icon: 'A', category: 'format', appModes: ['docs'],
    execute: (editor) => editor?.chain().focus().setColor('#1a73e8').run() },

  // === HEADING (docs) ===
  { id: 'heading-cycle', label: 'Heading', icon: 'H', category: 'format', appModes: ['docs'],
    execute: (editor) => {
      const levels: (1|2|3)[] = [1, 2, 3];
      const idx = nextCycle('heading', levels.length);
      editor?.chain().focus().toggleHeading({ level: levels[idx] }).run();
    }},
  { id: 'heading-1', label: 'Heading 1', icon: 'H1', category: 'format', appModes: ['docs'],
    execute: (editor) => editor?.chain().focus().toggleHeading({ level: 1 }).run() },
  { id: 'heading-2', label: 'Heading 2', icon: 'H2', category: 'format', appModes: ['docs'],
    execute: (editor) => editor?.chain().focus().toggleHeading({ level: 2 }).run() },
  { id: 'heading-3', label: 'Heading 3', icon: 'H3', category: 'format', appModes: ['docs'],
    execute: (editor) => editor?.chain().focus().toggleHeading({ level: 3 }).run() },

  // === LISTS ===
  { id: 'list-cycle', label: 'List', icon: '☰', category: 'format', appModes: ['docs'],
    execute: (editor) => {
      const idx = nextCycle('list', 3);
      if (idx === 0) editor?.chain().focus().toggleBulletList().run();
      else if (idx === 1) editor?.chain().focus().toggleOrderedList().run();
      else editor?.chain().focus().toggleTaskList().run();
    }},
  { id: 'bullet-list', label: 'Bullet list', icon: '•', category: 'format', appModes: ['docs'],
    execute: (editor) => editor?.chain().focus().toggleBulletList().run() },
  { id: 'numbered-list', label: 'Numbered list', icon: '1.', category: 'format', appModes: ['docs'],
    execute: (editor) => editor?.chain().focus().toggleOrderedList().run() },
  { id: 'task-list', label: 'Checklist', icon: '☑', category: 'format', appModes: ['docs'],
    execute: (editor) => editor?.chain().focus().toggleTaskList().run() },

  // === ALIGNMENT ===
  { id: 'align-left', label: 'Align left', icon: '⫷', category: 'format', appModes: ['docs'],
    execute: (editor) => editor?.chain().focus().setTextAlign('left').run() },
  { id: 'align-center', label: 'Align center', icon: '⫸', category: 'format', appModes: ['docs'],
    execute: (editor) => editor?.chain().focus().setTextAlign('center').run() },
  { id: 'align-right', label: 'Align right', icon: '⫸', category: 'format', appModes: ['docs'],
    execute: (editor) => editor?.chain().focus().setTextAlign('right').run() },
  { id: 'align-justify', label: 'Justify', icon: '☰', category: 'format', appModes: ['docs'],
    execute: (editor) => editor?.chain().focus().setTextAlign('justify').run() },

  // === INSERT ===
  { id: 'insert-link', label: 'Link', icon: '🔗', category: 'insert', appModes: ['docs', 'slides'],
    execute: () => window.dispatchEvent(new CustomEvent('insert-link')) },
  { id: 'insert-image', label: 'Image', icon: '🖼', category: 'insert', appModes: ['docs', 'slides'],
    execute: () => window.dispatchEvent(new CustomEvent('insert-image')) },
  { id: 'insert-table', label: 'Table', icon: '⊞', category: 'insert', appModes: ['docs'],
    execute: (editor) => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { id: 'insert-hr', label: 'Horizontal rule', icon: '—', category: 'insert', appModes: ['docs'],
    execute: (editor) => editor?.chain().focus().setHorizontalRule().run() },
  { id: 'insert-codeblock', label: 'Code block', icon: '<>', category: 'insert', appModes: ['docs'],
    execute: (editor) => editor?.chain().focus().toggleCodeBlock().run() },
  { id: 'insert-blockquote', label: 'Quote', icon: '"', category: 'insert', appModes: ['docs'],
    execute: (editor) => editor?.chain().focus().toggleBlockquote().run() },
  { id: 'insert-equation', label: 'Equation', icon: '∑', category: 'insert', appModes: ['docs'],
    execute: () => window.dispatchEvent(new CustomEvent('equation-dialog-open')) },
  { id: 'insert-special-char', label: 'Special character', icon: 'Ω', category: 'insert', appModes: ['docs'],
    execute: () => window.dispatchEvent(new CustomEvent('special-chars-open')) },
  { id: 'insert-emoji', label: 'Emoji', icon: '😀', category: 'insert', appModes: ['docs'],
    execute: (_editor) => { /* emoji picker is toolbar-based */ } },
  { id: 'insert-comment', label: 'Comment', icon: '💬', category: 'insert', appModes: ['docs'],
    execute: (editor) => {
      if (!editor) return;
      const { from, to } = editor.state.selection;
      if (from === to) return;
      const commentId = `c-${Date.now()}`;
      editor.chain().focus().setComment(commentId).run();
      const selectedText = editor.state.doc.textBetween(from, to, ' ');
      window.dispatchEvent(new CustomEvent('comment-add', { detail: { commentId, quotedText: selectedText } }));
    }},

  // === NAVIGATION ===
  { id: 'find', label: 'Find', icon: '🔍', category: 'navigation', appModes: ['docs'],
    execute: () => window.dispatchEvent(new CustomEvent('find-replace-open', { detail: { replace: false } })) },
  { id: 'find-replace', label: 'Find & Replace', icon: '🔎', category: 'navigation', appModes: ['docs'],
    execute: () => window.dispatchEvent(new CustomEvent('find-replace-open', { detail: { replace: true } })) },
  { id: 'version-history', label: 'Version history', icon: '📋', category: 'navigation', appModes: ['docs'],
    execute: () => {
      const e = new KeyboardEvent('keydown', { key: 'H', metaKey: true, shiftKey: true, bubbles: true });
      window.dispatchEvent(e);
    }},

  // === VIEW ===
  { id: 'dark-mode', label: 'Dark mode', icon: '🌙', category: 'view', appModes: ['docs', 'sheets', 'slides'],
    execute: () => {
      const current = document.body.classList.contains('dark');
      document.body.className = current ? '' : 'dark';
      localStorage.setItem('darkMode', JSON.stringify(!current));
    }},
  { id: 'fullscreen', label: 'Fullscreen', icon: '⛶', category: 'view', appModes: ['docs', 'sheets', 'slides'],
    execute: () => {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen();
      else document.exitFullscreen();
    }},
  { id: 'word-count', label: 'Word count', icon: '#', category: 'view', appModes: ['docs'],
    execute: () => window.dispatchEvent(new CustomEvent('word-count-open')) },
  { id: 'outline', label: 'Outline', icon: '≡', category: 'view', appModes: ['docs'],
    execute: () => window.dispatchEvent(new CustomEvent('outline-toggle')) },
  { id: 'export', label: 'Export', icon: '↗', category: 'view', appModes: ['docs'],
    execute: () => window.dispatchEvent(new CustomEvent('export-open')) },
  { id: 'print', label: 'Print', icon: '🖨', category: 'view', appModes: ['docs', 'sheets', 'slides'],
    execute: () => window.print() },

  // === EDIT ===
  { id: 'undo', label: 'Undo', icon: '↩', category: 'edit', appModes: ['docs'],
    execute: (editor) => editor?.chain().focus().undo().run() },
  { id: 'redo', label: 'Redo', icon: '↪', category: 'edit', appModes: ['docs'],
    execute: (editor) => editor?.chain().focus().redo().run() },
  { id: 'suggestion-mode', label: 'Suggest mode', icon: '✏️', category: 'edit', appModes: ['docs'],
    execute: () => window.dispatchEvent(new CustomEvent('suggestion-mode-toggle')) },

  // === SHEETS ===
  { id: 'sheets-sort-az', label: 'Sort A→Z', icon: 'A↓', category: 'sheet', appModes: ['sheets'],
    execute: () => window.dispatchEvent(new CustomEvent('sheets-sort-az')) },
  { id: 'sheets-insert-chart', label: 'Insert Chart', icon: '📊', category: 'sheet', appModes: ['sheets'],
    execute: () => window.dispatchEvent(new CustomEvent('sheets-insert-chart')) },
  { id: 'sheets-filter', label: 'Filter', icon: '▼', category: 'sheet', appModes: ['sheets'],
    execute: () => window.dispatchEvent(new CustomEvent('sheets-filter-toggle')) },
  { id: 'sheets-sum', label: 'Sum', icon: 'Σ', category: 'sheet', appModes: ['sheets'],
    execute: () => window.dispatchEvent(new CustomEvent('sheets-sum-selected')) },
  { id: 'sheets-currency', label: 'Currency', icon: '$', category: 'sheet', appModes: ['sheets'],
    execute: () => window.dispatchEvent(new CustomEvent('sheets-format-currency')) },
  { id: 'sheets-merge', label: 'Merge cells', icon: '⊞', category: 'sheet', appModes: ['sheets'],
    execute: () => window.dispatchEvent(new CustomEvent('sheets-merge-cells')) },
  { id: 'sheets-freeze', label: 'Freeze row', icon: '❄', category: 'sheet', appModes: ['sheets'],
    execute: () => window.dispatchEvent(new CustomEvent('sheets-freeze-row')) },

  // === SLIDES ===
  { id: 'slides-new', label: 'New slide', icon: '+', category: 'slide', appModes: ['slides'],
    execute: () => window.dispatchEvent(new CustomEvent('slides-new-slide')) },
  { id: 'slides-shape', label: 'Shape', icon: '◇', category: 'slide', appModes: ['slides'],
    execute: () => window.dispatchEvent(new CustomEvent('slides-insert-shape')) },
  { id: 'slides-present', label: 'Present', icon: '▶', category: 'slide', appModes: ['slides'],
    execute: () => window.dispatchEvent(new CustomEvent('slides-present')) },
  { id: 'slides-duplicate', label: 'Duplicate', icon: '⧉', category: 'slide', appModes: ['slides'],
    execute: () => window.dispatchEvent(new CustomEvent('slides-duplicate')) },
  { id: 'slides-transition', label: 'Transition', icon: '↝', category: 'slide', appModes: ['slides'],
    execute: () => window.dispatchEvent(new CustomEvent('slides-transition')) },
  { id: 'slides-layout', label: 'Layout', icon: '⊡', category: 'slide', appModes: ['slides'],
    execute: () => window.dispatchEvent(new CustomEvent('slides-layout')) },
  { id: 'slides-notes', label: 'Speaker notes', icon: '📝', category: 'slide', appModes: ['slides'],
    execute: () => window.dispatchEvent(new CustomEvent('slides-notes-toggle')) },
];

export function getCommands(): Command[] {
  return commands;
}

export function getCommandsForMode(mode: AppMode): Command[] {
  return commands.filter(c => c.appModes.includes(mode));
}

export function getCommandById(id: string): Command | undefined {
  return commands.find(c => c.id === id);
}

export type WheelSlot = { position: string; commandId: string };
export type WheelConfig = WheelSlot[];

export const POSITIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

export const defaultWheelConfigs: Record<AppMode, WheelConfig> = {
  docs: [
    { position: 'N', commandId: 'bold' },
    { position: 'NE', commandId: 'italic' },
    { position: 'E', commandId: 'insert-link' },
    { position: 'SE', commandId: 'insert-comment' },
    { position: 'S', commandId: 'insert-image' },
    { position: 'SW', commandId: 'insert-table' },
    { position: 'W', commandId: 'heading-cycle' },
    { position: 'NW', commandId: 'list-cycle' },
  ],
  sheets: [
    { position: 'N', commandId: 'bold' },
    { position: 'NE', commandId: 'sheets-sort-az' },
    { position: 'E', commandId: 'sheets-insert-chart' },
    { position: 'SE', commandId: 'sheets-filter' },
    { position: 'S', commandId: 'sheets-sum' },
    { position: 'SW', commandId: 'sheets-currency' },
    { position: 'W', commandId: 'sheets-merge' },
    { position: 'NW', commandId: 'sheets-freeze' },
  ],
  slides: [
    { position: 'N', commandId: 'slides-new' },
    { position: 'NE', commandId: 'slides-shape' },
    { position: 'E', commandId: 'insert-image' },
    { position: 'SE', commandId: 'slides-present' },
    { position: 'S', commandId: 'slides-duplicate' },
    { position: 'SW', commandId: 'slides-transition' },
    { position: 'W', commandId: 'slides-layout' },
    { position: 'NW', commandId: 'slides-notes' },
  ],
  draw: [
    { position: 'N', commandId: 'bold' },
    { position: 'E', commandId: 'insert-image' },
    { position: 'S', commandId: 'insert-link' },
    { position: 'W', commandId: 'italic' },
  ],
};

const STORAGE_KEY = 'md-office-command-wheel';

export function loadWheelConfig(mode: AppMode): WheelConfig {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}-${mode}`);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return defaultWheelConfigs[mode];
}

export function saveWheelConfig(mode: AppMode, config: WheelConfig): void {
  localStorage.setItem(`${STORAGE_KEY}-${mode}`, JSON.stringify(config));
}

export function resetWheelConfig(mode: AppMode): WheelConfig {
  localStorage.removeItem(`${STORAGE_KEY}-${mode}`);
  return defaultWheelConfigs[mode];
}
