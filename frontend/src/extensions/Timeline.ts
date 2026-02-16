import { Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { TimelineView } from '../components/TimelineView';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    timeline: {
      insertTimeline: () => ReturnType;
    };
  }
}

export const Timeline = Node.create({
  name: 'timeline',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      events: {
        default: [],
        parseHTML: (el) => {
          try {
            return JSON.parse((el as HTMLElement).getAttribute('data-events') || '[]');
          } catch {
            return [];
          }
        },
        renderHTML: (attrs) => ({ 'data-events': JSON.stringify(attrs.events) }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-timeline]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', { ...HTMLAttributes, 'data-timeline': '' }];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TimelineView);
  },

  addCommands() {
    return {
      insertTimeline:
        () =>
        ({ commands }) => {
          return commands.insertContent({ type: this.name });
        },
    };
  },
});
