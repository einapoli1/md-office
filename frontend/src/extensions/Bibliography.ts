import { Node, mergeAttributes } from '@tiptap/core';

export interface BibliographyOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    bibliography: {
      insertBibliography: () => ReturnType;
    };
  }
}

export const BibliographyBlock = Node.create<BibliographyOptions>({
  name: 'bibliography',
  group: 'block',
  atom: true,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      style: {
        default: 'apa',
        parseHTML: el => el.getAttribute('data-bib-style') || 'apa',
        renderHTML: attrs => ({ 'data-bib-style': attrs.style }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-bibliography]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-bibliography': 'true',
        class: 'bibliography-block',
      }),
      ['h3', {}, 'References'],
      ['div', { class: 'bibliography-entries' }, 'Bibliography will render here based on citations in the document.'],
    ];
  },

  addCommands() {
    return {
      insertBibliography:
        () =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { style: 'apa' },
          });
        },
    };
  },
});
