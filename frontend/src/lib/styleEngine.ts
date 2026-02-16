/**
 * Style Management Engine
 * Manages named paragraph/character styles with inheritance, CSS generation,
 * and YAML frontmatter persistence.
 */

export interface StyleDefinition {
  name: string;
  basedOn?: string;
  fontFamily?: string;
  fontSize?: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  lineSpacing?: string;
  spaceBefore?: string;
  spaceAfter?: string;
  alignment?: 'left' | 'center' | 'right' | 'justify';
  indent?: string;
  isBuiltIn?: boolean;
  category?: 'paragraph' | 'character';
}

export interface StyleSet {
  name: string;
  styles: Record<string, Partial<StyleDefinition>>;
}

const BUILT_IN_STYLES: StyleDefinition[] = [
  { name: 'Normal', fontFamily: 'Arial, sans-serif', fontSize: '11pt', color: '#000000', lineSpacing: '1.15', spaceBefore: '0pt', spaceAfter: '8pt', alignment: 'left', isBuiltIn: true, category: 'paragraph' },
  { name: 'Heading 1', basedOn: 'Normal', fontFamily: 'Arial, sans-serif', fontSize: '20pt', color: '#1b4f72', bold: true, lineSpacing: '1.15', spaceBefore: '12pt', spaceAfter: '4pt', isBuiltIn: true, category: 'paragraph' },
  { name: 'Heading 2', basedOn: 'Normal', fontFamily: 'Arial, sans-serif', fontSize: '16pt', color: '#2e75b6', bold: true, lineSpacing: '1.15', spaceBefore: '10pt', spaceAfter: '4pt', isBuiltIn: true, category: 'paragraph' },
  { name: 'Heading 3', basedOn: 'Normal', fontFamily: 'Arial, sans-serif', fontSize: '14pt', color: '#2e75b6', bold: true, lineSpacing: '1.15', spaceBefore: '8pt', spaceAfter: '4pt', isBuiltIn: true, category: 'paragraph' },
  { name: 'Heading 4', basedOn: 'Normal', fontSize: '12pt', color: '#2e75b6', bold: true, italic: true, spaceBefore: '4pt', spaceAfter: '2pt', isBuiltIn: true, category: 'paragraph' },
  { name: 'Heading 5', basedOn: 'Normal', fontSize: '11pt', color: '#2e75b6', bold: true, spaceBefore: '4pt', spaceAfter: '2pt', isBuiltIn: true, category: 'paragraph' },
  { name: 'Heading 6', basedOn: 'Normal', fontSize: '11pt', color: '#2e75b6', italic: true, spaceBefore: '4pt', spaceAfter: '2pt', isBuiltIn: true, category: 'paragraph' },
  { name: 'Title', basedOn: 'Normal', fontFamily: 'Georgia, serif', fontSize: '26pt', color: '#333333', lineSpacing: '1.0', spaceBefore: '0pt', spaceAfter: '12pt', alignment: 'center', isBuiltIn: true, category: 'paragraph' },
  { name: 'Subtitle', basedOn: 'Normal', fontFamily: 'Georgia, serif', fontSize: '15pt', color: '#666666', italic: true, lineSpacing: '1.15', spaceBefore: '0pt', spaceAfter: '12pt', alignment: 'center', isBuiltIn: true, category: 'paragraph' },
  { name: 'Quote', basedOn: 'Normal', fontFamily: 'Georgia, serif', fontSize: '11pt', color: '#555555', italic: true, indent: '1.5em', spaceBefore: '8pt', spaceAfter: '8pt', isBuiltIn: true, category: 'paragraph' },
  { name: 'Code', basedOn: 'Normal', fontFamily: 'Courier New, monospace', fontSize: '10pt', color: '#333333', lineSpacing: '1.4', spaceBefore: '8pt', spaceAfter: '8pt', isBuiltIn: true, category: 'paragraph' },
  { name: 'List Paragraph', basedOn: 'Normal', indent: '1.5em', isBuiltIn: true, category: 'paragraph' },
  { name: 'Caption', basedOn: 'Normal', fontSize: '9pt', color: '#666666', italic: true, spaceBefore: '4pt', spaceAfter: '8pt', isBuiltIn: true, category: 'paragraph' },
  { name: 'Footnote Text', basedOn: 'Normal', fontSize: '9pt', lineSpacing: '1.0', spaceBefore: '0pt', spaceAfter: '0pt', isBuiltIn: true, category: 'paragraph' },
  { name: 'TOC Heading', basedOn: 'Heading 1', fontSize: '14pt', color: '#333333', bold: true, isBuiltIn: true, category: 'paragraph' },
  { name: 'No Spacing', basedOn: 'Normal', lineSpacing: '1.0', spaceBefore: '0pt', spaceAfter: '0pt', isBuiltIn: true, category: 'paragraph' },
];

const QUICK_STYLE_SETS: StyleSet[] = [
  {
    name: 'Professional',
    styles: {
      'Normal': { fontFamily: 'Arial, sans-serif', fontSize: '11pt', color: '#333333' },
      'Heading 1': { fontFamily: 'Arial, sans-serif', fontSize: '20pt', color: '#1b4f72' },
      'Heading 2': { fontFamily: 'Arial, sans-serif', fontSize: '16pt', color: '#2e75b6' },
      'Title': { fontFamily: 'Arial, sans-serif', fontSize: '28pt', color: '#1b4f72' },
    },
  },
  {
    name: 'Elegant',
    styles: {
      'Normal': { fontFamily: 'Georgia, serif', fontSize: '11pt', color: '#2c2c2c' },
      'Heading 1': { fontFamily: 'Georgia, serif', fontSize: '22pt', color: '#4a4a4a', italic: true },
      'Heading 2': { fontFamily: 'Georgia, serif', fontSize: '17pt', color: '#5a5a5a', italic: true },
      'Title': { fontFamily: 'Georgia, serif', fontSize: '30pt', color: '#333333' },
    },
  },
  {
    name: 'Modern',
    styles: {
      'Normal': { fontFamily: 'Helvetica, sans-serif', fontSize: '10.5pt', color: '#222222' },
      'Heading 1': { fontFamily: 'Helvetica, sans-serif', fontSize: '24pt', color: '#0066cc', bold: true },
      'Heading 2': { fontFamily: 'Helvetica, sans-serif', fontSize: '18pt', color: '#0088ee', bold: true },
      'Title': { fontFamily: 'Helvetica, sans-serif', fontSize: '32pt', color: '#0066cc' },
    },
  },
  {
    name: 'Casual',
    styles: {
      'Normal': { fontFamily: 'Verdana, sans-serif', fontSize: '11pt', color: '#444444' },
      'Heading 1': { fontFamily: 'Verdana, sans-serif', fontSize: '20pt', color: '#e65100', bold: true },
      'Heading 2': { fontFamily: 'Verdana, sans-serif', fontSize: '16pt', color: '#f57c00', bold: true },
      'Title': { fontFamily: 'Verdana, sans-serif', fontSize: '26pt', color: '#e65100' },
    },
  },
];

export class StyleEngine {
  private styles: Map<string, StyleDefinition> = new Map();
  private listeners: Array<() => void> = [];

  constructor() {
    for (const s of BUILT_IN_STYLES) {
      this.styles.set(s.name, { ...s });
    }
  }

  subscribe(fn: () => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  }

  private notify(): void {
    for (const fn of this.listeners) fn();
  }

  getAllStyles(): StyleDefinition[] {
    return Array.from(this.styles.values());
  }

  getStyle(name: string): StyleDefinition | undefined {
    return this.styles.get(name);
  }

  /** Resolve a style including inherited properties from basedOn chain */
  resolveStyle(name: string): StyleDefinition {
    const style = this.styles.get(name);
    if (!style) return this.resolveStyle('Normal');
    if (!style.basedOn) return { ...style };
    const base = this.resolveStyle(style.basedOn);
    return { ...base, ...stripUndefined(style), name: style.name, basedOn: style.basedOn };
  }

  updateStyle(name: string, updates: Partial<StyleDefinition>): void {
    const existing = this.styles.get(name);
    if (existing) {
      this.styles.set(name, { ...existing, ...updates, name });
    }
    this.notify();
  }

  createStyle(def: StyleDefinition): void {
    this.styles.set(def.name, { ...def, isBuiltIn: false });
    this.notify();
  }

  deleteStyle(name: string): boolean {
    const style = this.styles.get(name);
    if (style?.isBuiltIn) return false;
    this.styles.delete(name);
    this.notify();
    return true;
  }

  /** Apply a style to the current selection/paragraph via TipTap editor */
  applyStyle(editor: any, styleName: string): void {
    const resolved = this.resolveStyle(styleName);
    const chain = editor.chain().focus();

    // Map style name to node type
    const headingMatch = styleName.match(/^Heading (\d)$/);
    if (headingMatch) {
      chain.clearNodes().setHeading({ level: parseInt(headingMatch[1]) as 1|2|3|4|5|6 });
    } else if (styleName === 'Title') {
      chain.clearNodes();
      (chain as any).setTitle();
    } else if (styleName === 'Subtitle') {
      chain.clearNodes();
      (chain as any).setSubtitle();
    } else if (styleName === 'Quote') {
      chain.clearNodes().setBlockquote();
    } else if (styleName === 'Code') {
      chain.clearNodes().setCodeBlock();
    } else {
      chain.clearNodes().setParagraph();
    }

    // Apply text formatting
    if (resolved.fontFamily) chain.setFontFamily(resolved.fontFamily);
    if (resolved.bold) chain.setBold(); else chain.unsetBold();
    if (resolved.italic) chain.setItalic(); else chain.unsetItalic();
    if (resolved.underline) chain.setUnderline(); else chain.unsetUnderline();
    if (resolved.color) chain.setColor(resolved.color);
    if (resolved.alignment) chain.setTextAlign(resolved.alignment);

    chain.run();
  }

  /** Detect which style applies at current cursor position */
  getActiveStyle(editor: any): string {
    if (!editor) return 'Normal';
    if (editor.isActive('title')) return 'Title';
    if (editor.isActive('subtitle')) return 'Subtitle';
    if (editor.isActive('blockquote')) return 'Quote';
    if (editor.isActive('codeBlock')) return 'Code';
    for (let i = 1; i <= 6; i++) {
      if (editor.isActive('heading', { level: i })) return `Heading ${i}`;
    }
    return 'Normal';
  }

  /** Create a new style from the current selection's formatting */
  createStyleFromSelection(editor: any, name: string): StyleDefinition {
    const attrs = editor.getAttributes('textStyle') || {};
    const def: StyleDefinition = {
      name,
      basedOn: 'Normal',
      fontFamily: attrs.fontFamily || undefined,
      color: attrs.color || undefined,
      bold: editor.isActive('bold') || undefined,
      italic: editor.isActive('italic') || undefined,
      underline: editor.isActive('underline') || undefined,
      isBuiltIn: false,
      category: 'paragraph',
    };
    this.createStyle(def);
    return def;
  }

  /** Import styles from a source document's style definitions */
  importStyles(sourceStyles: StyleDefinition[]): void {
    for (const s of sourceStyles) {
      if (!this.styles.has(s.name) || !this.styles.get(s.name)?.isBuiltIn) {
        this.styles.set(s.name, { ...s });
      }
    }
    this.notify();
  }

  /** Apply a quick style set (theme) */
  applyQuickStyleSet(setName: string): void {
    const styleSet = QUICK_STYLE_SETS.find(s => s.name === setName);
    if (!styleSet) return;
    for (const [name, overrides] of Object.entries(styleSet.styles)) {
      const existing = this.styles.get(name);
      if (existing) {
        this.styles.set(name, { ...existing, ...overrides });
      }
    }
    this.notify();
  }

  getQuickStyleSets(): StyleSet[] {
    return QUICK_STYLE_SETS;
  }

  /** Generate a CSS class name for a style */
  static cssClassName(styleName: string): string {
    return 'doc-style-' + styleName.toLowerCase().replace(/\s+/g, '-');
  }

  /** Convert all style definitions to a CSS stylesheet string */
  generateCSS(): string {
    const rules: string[] = [];
    for (const [name] of this.styles) {
      const resolved = this.resolveStyle(name);
      const cls = StyleEngine.cssClassName(name);
      const props: string[] = [];
      if (resolved.fontFamily) props.push(`font-family: ${resolved.fontFamily}`);
      if (resolved.fontSize) props.push(`font-size: ${resolved.fontSize}`);
      if (resolved.color) props.push(`color: ${resolved.color}`);
      if (resolved.bold) props.push('font-weight: bold');
      if (resolved.italic) props.push('font-style: italic');
      if (resolved.underline) props.push('text-decoration: underline');
      if (resolved.lineSpacing) props.push(`line-height: ${resolved.lineSpacing}`);
      if (resolved.spaceBefore) props.push(`margin-top: ${resolved.spaceBefore}`);
      if (resolved.spaceAfter) props.push(`margin-bottom: ${resolved.spaceAfter}`);
      if (resolved.alignment) props.push(`text-align: ${resolved.alignment}`);
      if (resolved.indent) props.push(`text-indent: ${resolved.indent}`);
      if (props.length) {
        rules.push(`.${cls} { ${props.join('; ')}; }`);
      }
    }
    return rules.join('\n');
  }

  /** Serialize styles to YAML-like frontmatter string */
  serializeToFrontmatter(): string {
    const custom = Array.from(this.styles.values()).filter(s => !s.isBuiltIn);
    if (custom.length === 0) return '';
    const lines = ['---', 'styles:'];
    for (const s of custom) {
      lines.push(`  ${s.name}:`);
      if (s.basedOn) lines.push(`    basedOn: "${s.basedOn}"`);
      if (s.fontFamily) lines.push(`    fontFamily: "${s.fontFamily}"`);
      if (s.fontSize) lines.push(`    fontSize: "${s.fontSize}"`);
      if (s.color) lines.push(`    color: "${s.color}"`);
      if (s.bold) lines.push(`    bold: true`);
      if (s.italic) lines.push(`    italic: true`);
      if (s.underline) lines.push(`    underline: true`);
      if (s.lineSpacing) lines.push(`    lineSpacing: "${s.lineSpacing}"`);
      if (s.alignment) lines.push(`    alignment: "${s.alignment}"`);
      if (s.indent) lines.push(`    indent: "${s.indent}"`);
    }
    lines.push('---');
    return lines.join('\n');
  }

  /** Parse styles from YAML-like frontmatter */
  parseFromFrontmatter(content: string): void {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return;
    const body = match[1];
    const styleBlocks = body.split(/\n  (\S[^:]+):/);
    if (styleBlocks[0].trim() !== 'styles:') return;

    for (let i = 1; i < styleBlocks.length; i += 2) {
      const name = styleBlocks[i].trim();
      const propsBlock = styleBlocks[i + 1] || '';
      const def: StyleDefinition = { name, isBuiltIn: false, category: 'paragraph' };
      const propLines = propsBlock.split('\n');
      for (const line of propLines) {
        const m = line.match(/^\s+(\w+):\s*"?([^"]*)"?\s*$/);
        if (!m) continue;
        const [, key, val] = m;
        if (key === 'basedOn') def.basedOn = val;
        else if (key === 'fontFamily') def.fontFamily = val;
        else if (key === 'fontSize') def.fontSize = val;
        else if (key === 'color') def.color = val;
        else if (key === 'bold') def.bold = val === 'true';
        else if (key === 'italic') def.italic = val === 'true';
        else if (key === 'underline') def.underline = val === 'true';
        else if (key === 'lineSpacing') def.lineSpacing = val;
        else if (key === 'alignment') def.alignment = val as StyleDefinition['alignment'];
        else if (key === 'indent') def.indent = val;
      }
      this.styles.set(name, def);
    }
    this.notify();
  }
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  const result: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) (result as any)[k] = v;
  }
  return result;
}

/** Singleton style engine instance */
export const styleEngine = new StyleEngine();
