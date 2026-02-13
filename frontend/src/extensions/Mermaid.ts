import { Node, mergeAttributes } from '@tiptap/core';

export interface MermaidOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mermaid: {
      setMermaid: (code: string) => ReturnType;
    };
  }
}

export const MermaidDiagram = Node.create<MermaidOptions>({
  name: 'mermaidDiagram',

  group: 'block',

  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      code: {
        default: '',
        parseHTML: element => element.getAttribute('data-mermaid-code'),
        renderHTML: attributes => {
          if (!attributes.code) {
            return {};
          }
          return {
            'data-mermaid-code': attributes.code,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-mermaid-code]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-mermaid-code': HTMLAttributes.code,
        class: 'mermaid-container',
      }),
      [
        'pre',
        { class: 'mermaid-code' },
        HTMLAttributes.code,
      ],
      [
        'div',
        { class: 'mermaid-rendered', 'data-processed': 'false' },
      ],
    ];
  },

  addCommands() {
    return {
      setMermaid:
        (code: string) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { code },
          });
        },
    };
  },

  // Note: Input rules removed for now due to TypeScript issues
  // Can be added later with proper typing
});