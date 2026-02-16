import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import DateChipView from '../components/DateChipView';

export const DateChip = Node.create({
  name: 'dateChip',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      date: {
        default: new Date().toISOString().split('T')[0],
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-date-chip]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes({ 'data-date-chip': '' }, HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DateChipView);
  },

  addCommands() {
    return {
      insertDateChip:
        (date?: string) =>
        ({ commands }: any) => {
          return commands.insertContent({
            type: this.name,
            attrs: { date: date || new Date().toISOString().split('T')[0] },
          });
        },
    } as any;
  },
});

export default DateChip;
