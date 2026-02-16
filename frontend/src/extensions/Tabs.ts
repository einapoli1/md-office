import { Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { TabsView } from '../components/TabsView';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    tabsBlock: {
      insertTabs: () => ReturnType;
    };
  }
}

export const TabsBlock = Node.create({
  name: 'tabsBlock',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      tabs: {
        default: [
          { id: 'tab1', label: 'Tab 1', content: '' },
          { id: 'tab2', label: 'Tab 2', content: '' },
        ],
        parseHTML: (el) => {
          try {
            return JSON.parse((el as HTMLElement).getAttribute('data-tabs') || '[]');
          } catch {
            return [];
          }
        },
        renderHTML: (attrs) => ({ 'data-tabs': JSON.stringify(attrs.tabs) }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-tabs-block]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', { ...HTMLAttributes, 'data-tabs-block': '' }];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TabsView);
  },

  addCommands() {
    return {
      insertTabs:
        () =>
        ({ commands }) => {
          return commands.insertContent({ type: this.name });
        },
    };
  },
});
