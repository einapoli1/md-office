import { Node } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface TableOfContentsBlockOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    tableOfContentsBlock: {
      insertTableOfContents: () => ReturnType;
    };
  }
}

const tocPluginKey = new PluginKey('tableOfContentsBlock');

export const TableOfContentsBlock = Node.create<TableOfContentsBlockOptions>({
  name: 'tableOfContentsBlock',

  group: 'block',

  atom: true,

  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-toc-block]' }];
  },

  renderHTML() {
    return ['div', { 'data-toc-block': '', class: 'toc-block' }, 'Table of Contents'];
  },

  addCommands() {
    return {
      insertTableOfContents:
        () =>
        ({ commands }) => {
          return commands.insertContent({ type: this.name });
        },
    };
  },

  addProseMirrorPlugins() {
    const extensionThis = this;

    return [
      new Plugin({
        key: tocPluginKey,
        state: {
          init(_, state) {
            return buildTocDecorations(state, extensionThis.name);
          },
          apply(tr, old, _oldState, newState) {
            if (tr.docChanged) {
              return buildTocDecorations(newState, extensionThis.name);
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

interface HeadingInfo {
  level: number;
  text: string;
  pos: number;
  id: string;
}

function buildTocDecorations(state: any, nodeName: string): DecorationSet {
  const decorations: Decoration[] = [];
  const tocPositions: { pos: number; nodeSize: number }[] = [];

  // Find all TOC block positions
  state.doc.descendants((node: any, pos: number) => {
    if (node.type.name === nodeName) {
      tocPositions.push({ pos, nodeSize: node.nodeSize });
    }
  });

  if (tocPositions.length === 0) return DecorationSet.empty;

  // Collect all headings
  const headings: HeadingInfo[] = [];
  state.doc.descendants((node: any, pos: number) => {
    if (node.type.name === 'heading') {
      headings.push({
        level: node.attrs.level,
        text: node.textContent,
        pos,
        id: `heading-${pos}`,
      });
    }
  });

  // Create decoration for each TOC block
  for (const toc of tocPositions) {
    decorations.push(
      Decoration.node(toc.pos, toc.pos + toc.nodeSize, {
        class: 'toc-block toc-block-rendered',
      })
    );

    const widget = Decoration.widget(toc.pos + 1, (view) => {
      const container = document.createElement('div');
      container.className = 'toc-block-content';
      container.contentEditable = 'false';

      const title = document.createElement('div');
      title.className = 'toc-block-title';
      title.textContent = 'Table of Contents';
      container.appendChild(title);

      if (headings.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'toc-block-empty';
        empty.textContent = 'Add headings to generate table of contents';
        container.appendChild(empty);
      } else {
        const list = document.createElement('div');
        list.className = 'toc-block-list';

        headings.forEach((h) => {
          const item = document.createElement('div');
          item.className = `toc-block-item toc-block-level-${h.level}`;

          const link = document.createElement('a');
          link.className = 'toc-block-link';
          link.textContent = h.text || '(empty heading)';
          link.href = '#';
          link.addEventListener('click', (e) => {
            e.preventDefault();
            // Focus the editor and scroll to heading
            view.focus();
            const tr = view.state.tr.setSelection(
              TextSelection.near(view.state.doc.resolve(h.pos + 1))
            );
            view.dispatch(tr.scrollIntoView());
          });

          item.appendChild(link);
          list.appendChild(item);
        });

        container.appendChild(list);
      }

      return container;
    }, { side: -1, key: `toc-${toc.pos}-${headings.map(h => h.text + h.pos).join(',')}` });

    decorations.push(widget);
  }

  return DecorationSet.create(state.doc, decorations);
}
