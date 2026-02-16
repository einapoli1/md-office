import { Node, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface CitationOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    citation: {
      insertCitation: (citationId: string) => ReturnType;
      removeCitation: (citationId: string) => ReturnType;
    };
  }
}

const citationPluginKey = new PluginKey('citationNumbering');

export const CitationNode = Node.create<CitationOptions>({
  name: 'citation',
  group: 'inline',
  inline: true,
  atom: true,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      citationId: {
        default: null,
        parseHTML: el => el.getAttribute('data-citation-id'),
        renderHTML: attrs => ({ 'data-citation-id': attrs.citationId }),
      },
      label: {
        default: '',
        parseHTML: el => el.getAttribute('data-citation-label') || '',
        renderHTML: attrs => ({ 'data-citation-label': attrs.label }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-citation-id]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: 'citation-chip',
        title: 'Click to view citation',
      }),
      HTMLAttributes['data-citation-label'] || '[?]',
    ];
  },

  addCommands() {
    return {
      insertCitation:
        (citationId: string) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { citationId, label: '' },
          });
        },
      removeCitation:
        (_citationId: string) =>
        ({ tr, dispatch }) => {
          if (!dispatch) return true;
          const positions: number[] = [];
          tr.doc.descendants((node, pos) => {
            if (node.type.name === 'citation' && node.attrs.citationId === _citationId) {
              positions.push(pos);
            }
          });
          // Remove in reverse to keep positions valid
          for (let i = positions.length - 1; i >= 0; i--) {
            tr.delete(positions[i], positions[i] + 1);
          }
          dispatch(tr);
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: citationPluginKey,
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            // Track citation order for IEEE numbering
            const orderMap = new Map<string, number>();
            let counter = 0;

            state.doc.descendants((node, pos) => {
              if (node.type.name === 'citation') {
                const cid = node.attrs.citationId;
                if (!orderMap.has(cid)) {
                  counter++;
                  orderMap.set(cid, counter);
                }
                // Add a decoration to update displayed number
                const num = orderMap.get(cid)!;
                decorations.push(
                  Decoration.node(pos, pos + node.nodeSize, {
                    'data-citation-number': String(num),
                  }),
                );
              }
            });

            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});
