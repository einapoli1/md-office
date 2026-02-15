import { Node } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export const TabStop = Node.create({
  name: 'tabStop',
  group: 'inline',
  inline: true,
  atom: true,

  parseHTML() {
    return [{ tag: 'span[data-tab-stop]' }];
  },

  renderHTML() {
    return ['span', { 'data-tab-stop': '', class: 'tab-stop' }, '\u00A0'];
  },

  addKeyboardShortcuts() {
    return {
      Tab: ({ editor }) => {
        // Don't capture Tab inside code blocks or lists
        if (editor.isActive('codeBlock') || editor.isActive('listItem') || editor.isActive('taskItem')) {
          return false;
        }
        editor.chain().focus().insertContent({ type: 'tabStop' }).run();
        return true;
      },
    };
  },
});
