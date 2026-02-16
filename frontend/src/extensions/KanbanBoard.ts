import { Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { KanbanView } from '../components/KanbanView';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    kanbanBoard: {
      insertKanban: () => ReturnType;
    };
  }
}

export const KanbanBoard = Node.create({
  name: 'kanbanBoard',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      columns: {
        default: [
          { id: 'todo', title: 'To Do', cards: [] },
          { id: 'progress', title: 'In Progress', cards: [] },
          { id: 'done', title: 'Done', cards: [] },
        ],
        parseHTML: (el) => {
          try {
            return JSON.parse((el as HTMLElement).getAttribute('data-columns') || '[]');
          } catch {
            return [];
          }
        },
        renderHTML: (attrs) => ({ 'data-columns': JSON.stringify(attrs.columns) }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-kanban-board]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', { ...HTMLAttributes, 'data-kanban-board': '' }];
  },

  addNodeView() {
    return ReactNodeViewRenderer(KanbanView);
  },

  addCommands() {
    return {
      insertKanban:
        () =>
        ({ commands }) => {
          return commands.insertContent({ type: this.name });
        },
    };
  },
});
