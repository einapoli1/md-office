// Slide data model — parse/serialize markdown, undo/redo

export type SlideLayout = 'title' | 'content' | 'two-column' | 'image' | 'blank' | 'section';
export type TransitionType = 'none' | 'fade' | 'slide-left' | 'slide-right' | 'slide-up' | 'zoom' | 'dissolve' | 'wipe';
export type TransitionDuration = '0.3s' | '0.5s' | '1.0s';
export type FragmentType = 'fade-in' | 'slide-up' | 'slide-left' | 'zoom-in' | 'appear';

export interface Fragment {
  index: number;
  type: FragmentType;
}

export interface SlideShape {
  id: string;
  type: 'rectangle' | 'rounded-rectangle' | 'circle' | 'ellipse' | 'arrow' | 'line' | 'star' | 'triangle' | 'diamond' | 'callout';
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  text: string;
}

export interface Slide {
  id: string;
  content: string;
  layout: SlideLayout;
  notes: string;
  transition: TransitionType;
  transitionDuration: TransitionDuration;
  fragments: Fragment[];
  shapes: SlideShape[];
}

export interface PresentationMeta {
  title: string;
  theme: string;
  aspectRatio: string;
  [key: string]: string;
}

export interface Presentation {
  meta: PresentationMeta;
  slides: Slide[];
}

let _idCounter = 0;
export function genSlideId(): string {
  return `slide-${Date.now()}-${++_idCounter}`;
}

/** Detect layout from HTML comment */
function detectLayout(content: string): SlideLayout {
  const m = content.match(/<!--\s*slide:\s*(\S+)\s*-->/);
  if (m) {
    const val = m[1] as SlideLayout;
    if (['title', 'content', 'two-column', 'image', 'blank', 'section'].includes(val)) return val;
  }
  // Heuristic fallback
  if (/^#[^#]/.test(content.trim()) && content.trim().split('\n').length <= 3) return 'title';
  return 'content';
}

/** Extract speaker notes from ::: notes block */
function extractNotes(raw: string): { content: string; notes: string } {
  const notesRe = /:::\s*notes\s*\n([\s\S]*?):::/;
  const m = raw.match(notesRe);
  const notes = m ? m[1].trim() : '';
  const content = raw.replace(notesRe, '').trim();
  return { content, notes };
}

/** Parse frontmatter */
function parseFrontmatter(text: string): { meta: PresentationMeta; body: string } {
  const meta: PresentationMeta = { title: 'Untitled', theme: 'default', aspectRatio: '16:9' };
  let body = text;
  const fmMatch = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (fmMatch) {
    body = text.slice(fmMatch[0].length);
    fmMatch[1].split('\n').forEach(line => {
      const kv = line.match(/^(\w+)\s*:\s*(.+)$/);
      if (kv) meta[kv[1]] = kv[2].trim();
    });
  }
  return { meta, body };
}

/** Parse full markdown into Presentation */
export function parsePresentation(markdown: string): Presentation {
  const { meta, body } = parseFrontmatter(markdown);
  const rawSlides = body.split(/\n---\s*\n/);
  const slides: Slide[] = rawSlides
    .filter(s => s.trim().length > 0)
    .map(raw => {
      const { content, notes } = extractNotes(raw);
      return {
        id: genSlideId(),
        content,
        layout: detectLayout(content),
        notes,
        transition: 'none' as TransitionType,
        transitionDuration: '0.3s' as TransitionDuration,
        fragments: parseFragments(content),
        shapes: [],
      };
    });
  if (slides.length === 0) {
    slides.push({ id: genSlideId(), content: '# New Presentation', layout: 'title', notes: '', transition: 'none', transitionDuration: '0.3s', fragments: [], shapes: [] });
  }
  return { meta, slides };
}

/** Serialize back to markdown */
export function serializePresentation(pres: Presentation): string {
  const fm = `---\ntitle: ${pres.meta.title}\ntheme: ${pres.meta.theme}\naspectRatio: ${pres.meta.aspectRatio}\n---\n\n`;
  const slideStrs = pres.slides.map(s => {
    let out = s.content;
    if (s.notes) {
      out += `\n\n::: notes\n${s.notes}\n:::`;
    }
    return out;
  });
  return fm + slideStrs.join('\n\n---\n\n') + '\n';
}

/** Parse fragment comments from content */
export function parseFragments(content: string): Fragment[] {
  const fragments: Fragment[] = [];
  const re = /<!--\s*fragment(?:\s*:\s*(\S+))?\s*-->/g;
  let match: RegExpExecArray | null;
  let idx = 0;
  while ((match = re.exec(content)) !== null) {
    const type = (match[1] as FragmentType) || 'fade-in';
    fragments.push({ index: idx++, type });
  }
  return fragments;
}

/** Generate a shape ID */
export function genShapeId(): string {
  return `shape-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Create a blank slide with given layout */
export function createSlide(layout: SlideLayout): Slide {
  const templates: Record<SlideLayout, string> = {
    title: '<!-- slide: title -->\n# Title\n## Subtitle',
    content: '<!-- slide: content -->\n# Heading\n\n- Point one\n- Point two\n- Point three',
    'two-column': '<!-- slide: two-column -->\n# Two Columns\n\n:::: left\nLeft content\n::::\n\n:::: right\nRight content\n::::',
    image: '<!-- slide: image -->\n# Image Slide\n\n![Image](https://via.placeholder.com/800x400)',
    section: '<!-- slide: section -->\n# Section Title',
    blank: '<!-- slide: blank -->',
  };
  return {
    id: genSlideId(),
    content: templates[layout],
    layout,
    notes: '',
    transition: 'none',
    transitionDuration: '0.3s',
    fragments: [],
    shapes: [],
  };
}

// Undo/redo stack
export interface UndoStack {
  past: Slide[][];
  future: Slide[][];
}

export function pushUndo(stack: UndoStack, current: Slide[]): UndoStack {
  return { past: [...stack.past, current.map(s => ({ ...s }))], future: [] };
}

export function undo(stack: UndoStack, current: Slide[]): { stack: UndoStack; slides: Slide[] } | null {
  if (stack.past.length === 0) return null;
  const prev = stack.past[stack.past.length - 1];
  return {
    stack: { past: stack.past.slice(0, -1), future: [...stack.future, current.map(s => ({ ...s }))] },
    slides: prev,
  };
}

export function redo(stack: UndoStack, current: Slide[]): { stack: UndoStack; slides: Slide[] } | null {
  if (stack.future.length === 0) return null;
  const next = stack.future[stack.future.length - 1];
  return {
    stack: { past: [...stack.past, current.map(s => ({ ...s }))], future: stack.future.slice(0, -1) },
    slides: next,
  };
}
