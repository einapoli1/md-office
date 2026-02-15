import { Node, mergeAttributes } from '@tiptap/core';

export interface BookmarkOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    bookmark: {
      insertBookmark: (name: string) => ReturnType;
      removeBookmark: (name: string) => ReturnType;
    };
  }
}

export const Bookmark = Node.create<BookmarkOptions>({
  name: 'bookmark',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute('id'),
        renderHTML: (attributes) => ({ id: attributes.id }),
      },
      name: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-bookmark-name'),
        renderHTML: (attributes) => ({ 'data-bookmark-name': attributes.name }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-bookmark-name]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: 'bookmark-anchor',
        contenteditable: 'false',
      }),
      // Bookmark flag icon (SVG inline)
      ['span', { class: 'bookmark-icon', contenteditable: 'false' }, '🔖'],
    ];
  },

  addCommands() {
    return {
      insertBookmark:
        (name: string) =>
        ({ chain }) => {
          const id = `bookmark-${name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`;
          return chain()
            .insertContent({
              type: this.name,
              attrs: { id, name },
            })
            .run();
        },
      removeBookmark:
        (name: string) =>
        ({ tr, state, dispatch }) => {
          let found = false;
          state.doc.descendants((node, pos) => {
            if (node.type.name === 'bookmark' && node.attrs.name === name) {
              if (dispatch) {
                tr.delete(pos, pos + node.nodeSize);
              }
              found = true;
            }
          });
          return found;
        },
    };
  },
});
