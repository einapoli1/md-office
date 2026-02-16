import { Node, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export type FootnoteNumberingStyle = 'numeric' | 'roman' | 'alpha' | 'symbol';
export type FootnoteDisplayMode = 'endnotes' | 'sidenotes';

export interface FootnoteOptions {
  HTMLAttributes: Record<string, any>;
  numberingStyle: FootnoteNumberingStyle;
  displayMode: FootnoteDisplayMode;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    footnote: {
      setFootnote: (content: string) => ReturnType;
      insertFootnote: (content: string) => ReturnType;
      unsetFootnote: () => ReturnType;
      setFootnoteNumberingStyle: (style: FootnoteNumberingStyle) => ReturnType;
      setFootnoteDisplayMode: (mode: FootnoteDisplayMode) => ReturnType;
    };
  }
}

const footnotePluginKey = new PluginKey('footnoteEndnotes');

export const Footnote = Node.create<FootnoteOptions>({
  name: 'footnote',

  group: 'inline',

  inline: true,

  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
      numberingStyle: 'numeric' as FootnoteNumberingStyle,
      displayMode: 'endnotes' as FootnoteDisplayMode,
    };
  },

  addStorage() {
    return {
      numberingStyle: 'numeric' as FootnoteNumberingStyle,
      displayMode: 'endnotes' as FootnoteDisplayMode,
    };
  },

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: element => element.getAttribute('data-footnote-id'),
        renderHTML: attributes => {
          if (!attributes.id) return {};
          return { 'data-footnote-id': attributes.id };
        },
      },
      content: {
        default: '',
        parseHTML: element => element.getAttribute('data-footnote-content') || '',
        renderHTML: attributes => {
          return { 'data-footnote-content': attributes.content || '' };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'sup[data-footnote-id]' }];
  },

  renderHTML({ HTMLAttributes }) {
    // The number is set dynamically by the plugin; placeholder here
    return [
      'sup',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: 'footnote-ref',
        title: HTMLAttributes['data-footnote-content'] || '',
      }),
      '•',
    ];
  },

  addCommands() {
    return {
      setFootnote:
        (content: string) =>
        ({ commands }) => {
          const id = `fn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          return commands.insertContent({
            type: this.name,
            attrs: { id, content },
          });
        },

      insertFootnote:
        (content: string) =>
        ({ commands }) => {
          return commands.setFootnote(content);
        },

      unsetFootnote:
        () =>
        ({ commands }) => {
          return commands.deleteSelection();
        },

      setFootnoteNumberingStyle:
        (style: FootnoteNumberingStyle) =>
        ({ editor: _editor }) => {
          this.storage.numberingStyle = style;
          // Force re-render by dispatching an empty transaction
          const { tr } = _editor.state;
          tr.setMeta('footnoteStyleChange', true);
          _editor.view.dispatch(tr);
          return true;
        },

      setFootnoteDisplayMode:
        (mode: FootnoteDisplayMode) =>
        ({ editor: _editor }) => {
          this.storage.displayMode = mode;
          const { tr } = _editor.state;
          tr.setMeta('footnoteStyleChange', true);
          _editor.view.dispatch(tr);
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-f': () => {
        const content = prompt('Footnote text:');
        if (content) {
          return this.editor.commands.setFootnote(content);
        }
        return false;
      },
    };
  },

  addProseMirrorPlugins() {
    const storage = this.storage;
    return [
      new Plugin({
        key: footnotePluginKey,
        state: {
          init(_, state) {
            return buildDecorations(state, storage.numberingStyle, storage.displayMode);
          },
          apply(tr, old, _oldState, newState) {
            if (tr.docChanged || tr.getMeta('footnoteStyleChange')) {
              return buildDecorations(newState, storage.numberingStyle, storage.displayMode);
            }
            return old;
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});

function formatNumber(n: number, style: FootnoteNumberingStyle): string {
  switch (style) {
    case 'roman': {
      const vals = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
      const syms = ['m', 'cm', 'd', 'cd', 'c', 'xc', 'l', 'xl', 'x', 'ix', 'v', 'iv', 'i'];
      let result = '';
      let num = n;
      for (let i = 0; i < vals.length; i++) {
        while (num >= vals[i]) { result += syms[i]; num -= vals[i]; }
      }
      return result;
    }
    case 'alpha': {
      let result = '';
      let num = n;
      while (num > 0) { num--; result = String.fromCharCode(97 + (num % 26)) + result; num = Math.floor(num / 26); }
      return result;
    }
    case 'symbol': {
      const symbols = ['*', '†', '‡', '§', '‖', '¶'];
      const idx = (n - 1) % symbols.length;
      const repeat = Math.floor((n - 1) / symbols.length) + 1;
      return symbols[idx].repeat(repeat);
    }
    default:
      return String(n);
  }
}

function buildDecorations(state: any, numberingStyle: FootnoteNumberingStyle = 'numeric', displayMode: FootnoteDisplayMode = 'endnotes'): DecorationSet {
  const decorations: Decoration[] = [];
  const footnotes: { pos: number; id: string; content: string }[] = [];
  let counter = 0;

  // Collect all footnotes in document order
  state.doc.descendants((node: any, pos: number) => {
    if (node.type.name === 'footnote') {
      counter++;
      footnotes.push({
        pos,
        id: node.attrs.id,
        content: node.attrs.content,
      });

    }
  });

  // Number each footnote inline using node decorations
  counter = 0;
  state.doc.descendants((node: any, pos: number) => {
    if (node.type.name === 'footnote') {
      counter++;
      const label = formatNumber(counter, numberingStyle);
      decorations.push(
        Decoration.node(pos, pos + node.nodeSize, {
          'data-footnote-number': label,
          'data-footnote-label': label,
          class: 'footnote-ref footnote-numbered',
          title: node.attrs.content || '',
        })
      );
    }
  });

  if (footnotes.length > 0 && displayMode === 'sidenotes') {
    // Sidenote mode: render footnotes as margin notes near their reference
    footnotes.forEach((fn, i) => {
      const label = formatNumber(i + 1, numberingStyle);
      const widget = Decoration.widget(fn.pos + 1, () => {
        const note = document.createElement('span');
        note.className = 'footnote-sidenote';
        note.contentEditable = 'false';
        note.innerHTML = `<sup class="sidenote-num">${escapeHtml(label)}</sup> ${escapeHtml(fn.content)}`;
        note.style.cssText = 'position:absolute;right:-220px;width:200px;font-size:12px;color:#666;line-height:1.4;padding:4px 0;cursor:pointer;';
        note.addEventListener('click', () => {
          const ref = document.querySelector(`[data-footnote-id="${fn.id}"]`);
          if (ref) ref.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        return note;
      }, { side: 1 });
      decorations.push(widget);
    });
  } else if (footnotes.length > 0) {
    // Endnotes mode (default)
    const endWidget = Decoration.widget(state.doc.content.size, () => {
      const container = document.createElement('div');
      container.className = 'footnotes-endnotes';
      container.contentEditable = 'false';

      const hr = document.createElement('hr');
      hr.className = 'footnotes-divider';
      container.appendChild(hr);

      const title = document.createElement('div');
      title.className = 'footnotes-title';
      title.textContent = 'Footnotes';
      container.appendChild(title);

      footnotes.forEach((fn, i) => {
        const label = formatNumber(i + 1, numberingStyle);
        const entry = document.createElement('div');
        entry.className = 'footnote-entry';
        entry.innerHTML = `<span class="footnote-entry-num">${escapeHtml(label)}.</span> <span class="footnote-entry-text">${escapeHtml(fn.content)}</span>`;
        entry.addEventListener('click', () => {
          const ref = document.querySelector(`[data-footnote-id="${fn.id}"]`);
          if (ref) ref.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        container.appendChild(entry);
      });

      return container;
    }, { side: 1 });
    decorations.push(endWidget);
  }

  return DecorationSet.create(state.doc, decorations);
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
