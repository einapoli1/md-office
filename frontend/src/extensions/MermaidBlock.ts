import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { MermaidNodeView } from '../components/MermaidNodeView';

export interface MermaidBlockOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mermaidBlock: {
      insertMermaidBlock: (code?: string) => ReturnType;
    };
  }
}

export const MermaidBlock = Node.create<MermaidBlockOptions>({
  name: 'mermaidBlock',

  group: 'block',
  atom: true,
  draggable: true,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      code: {
        default: 'graph TD\n  A[Start] --> B[End]',
        parseHTML: (el) => el.getAttribute('data-mermaid-code') || '',
        renderHTML: (attrs) => ({ 'data-mermaid-code': attrs.code }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-mermaid-code]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
      class: 'mermaid-block-container',
    }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MermaidNodeView);
  },

  addCommands() {
    return {
      insertMermaidBlock:
        (code?: string) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { code: code || 'graph TD\n  A[Start] --> B[Process] --> C[End]' },
          }),
    };
  },
});
