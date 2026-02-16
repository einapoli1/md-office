import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { EmbedBlockView } from '../components/EmbedBlockView';

export interface EmbedBlockOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    embedBlock: {
      insertEmbed: (attrs: {
        embedId: string;
        sourceFile: string;
        embedType: string;
        width?: number;
        height?: number;
      }) => ReturnType;
    };
  }
}

export const EmbedBlock = Node.create<EmbedBlockOptions>({
  name: 'embedBlock',

  group: 'block',
  atom: true,
  draggable: true,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      embedId: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-embed-id') || '',
        renderHTML: (attrs) => ({ 'data-embed-id': attrs.embedId }),
      },
      sourceFile: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-source-file') || '',
        renderHTML: (attrs) => ({ 'data-source-file': attrs.sourceFile }),
      },
      embedType: {
        default: 'chart',
        parseHTML: (el) => el.getAttribute('data-embed-type') || 'chart',
        renderHTML: (attrs) => ({ 'data-embed-type': attrs.embedType }),
      },
      width: {
        default: 400,
        parseHTML: (el) => parseInt(el.getAttribute('data-embed-width') || '400', 10),
        renderHTML: (attrs) => ({ 'data-embed-width': String(attrs.width) }),
      },
      height: {
        default: 250,
        parseHTML: (el) => parseInt(el.getAttribute('data-embed-height') || '250', 10),
        renderHTML: (attrs) => ({ 'data-embed-height': String(attrs.height) }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-embed-id]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
      class: 'embed-block-container',
    }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(EmbedBlockView);
  },

  addCommands() {
    return {
      insertEmbed:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs,
          }),
    };
  },
});
