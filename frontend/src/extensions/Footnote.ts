import { Node, mergeAttributes } from '@tiptap/core';

export interface FootnoteOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    footnote: {
      /**
       * Add a footnote
       */
      setFootnote: (id: string) => ReturnType;
      /**
       * Remove footnote
       */
      unsetFootnote: () => ReturnType;
    };
  }
}

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
          if (!attributes.id) {
            return {};
          }
          return {
            'data-footnote-id': attributes.id,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'sup[data-footnote-id]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'sup',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: 'footnote-ref',
      }),
      ['a', { href: `#fn-${HTMLAttributes['data-footnote-id']}` }, HTMLAttributes['data-footnote-id']],
    ];
  },

  addCommands() {
    return {
      setFootnote:
        (id: string) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { id },
          });
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
        const id = prompt('Enter footnote ID:');
        if (id) {
          return this.editor.commands.setFootnote(id);
        }
        return false;
      },
    };
  },
});