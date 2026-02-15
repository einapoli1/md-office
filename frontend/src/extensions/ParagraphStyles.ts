import { Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    title: {
      setTitle: () => ReturnType;
    };
    subtitle: {
      setSubtitle: () => ReturnType;
    };
  }
}

export const Title = Node.create({
  name: 'title',
  group: 'block',
  content: 'inline*',
  defining: true,

  parseHTML() {
    return [{ tag: 'h1.doc-title' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['h1', mergeAttributes(HTMLAttributes, { class: 'doc-title' }), 0];
  },

  addCommands() {
    return {
      setTitle: () => ({ commands }: { commands: any }) => {
        return commands.setNode(this.name);
      },
    };
  },
});

export const Subtitle = Node.create({
  name: 'subtitle',
  group: 'block',
  content: 'inline*',
  defining: true,

  parseHTML() {
    return [{ tag: 'h2.doc-subtitle' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['h2', mergeAttributes(HTMLAttributes, { class: 'doc-subtitle' }), 0];
  },

  addCommands() {
    return {
      setSubtitle: () => ({ commands }: { commands: any }) => {
        return commands.setNode(this.name);
      },
    };
  },
});
