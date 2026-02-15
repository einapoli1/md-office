import { Node, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface FootnoteOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    footnote: {
      setFootnote: (content: string) => ReturnType;
      insertFootnote: (content: string) => ReturnType;
      unsetFootnote: () => ReturnType;
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
    return [
      new Plugin({
        key: footnotePluginKey,
        state: {
          init(_, state) {
            return buildDecorations(state);
          },
          apply(tr, old, _oldState, newState) {
            if (tr.docChanged) {
              return buildDecorations(newState);
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

function buildDecorations(state: any): DecorationSet {
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
      decorations.push(
        Decoration.node(pos, pos + node.nodeSize, {
          'data-footnote-number': String(counter),
          class: 'footnote-ref footnote-numbered',
        })
      );
    }
  });

  // Add endnotes section at end of document if there are footnotes
  if (footnotes.length > 0) {
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
        const entry = document.createElement('div');
        entry.className = 'footnote-entry';
        entry.innerHTML = `<span class="footnote-entry-num">${i + 1}.</span> <span class="footnote-entry-text">${escapeHtml(fn.content)}</span>`;
        entry.addEventListener('click', () => {
          // Scroll to the footnote reference in the document
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
