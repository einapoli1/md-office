import { Node, mergeAttributes, InputRule } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    toggleBlock: {
      insertToggle: () => ReturnType;
    };
  }
}

export const ToggleBlock = Node.create({
  name: 'toggleBlock',
  group: 'block',
  content: 'block+',
  defining: true,
  draggable: true,

  addAttributes() {
    return {
      open: {
        default: true,
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-open') !== 'false',
        renderHTML: (attrs) => ({ 'data-open': String(attrs.open) }),
      },
      summary: {
        default: 'Toggle',
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-summary') || 'Toggle',
        renderHTML: (attrs) => ({ 'data-summary': attrs.summary }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-toggle-block]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const isOpen = node.attrs.open;
    const summary = node.attrs.summary as string;
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-toggle-block': '',
        style: `border-left:3px solid #e0e0e0;background:#fafafa;margin:4px 0;border-radius:4px;`,
      }),
      [
        'div',
        {
          'data-toggle-summary': '',
          style: 'padding:8px 12px;cursor:pointer;font-weight:500;user-select:none;display:flex;align-items:center;gap:6px;',
        },
        `${isOpen ? '▼' : '▶'} ${summary}`,
      ],
      [
        'div',
        {
          'data-toggle-content': '',
          style: isOpen ? 'padding:4px 12px 8px 24px;' : 'display:none;',
        },
        0,
      ],
    ];
  },

  addCommands() {
    return {
      insertToggle:
        () =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { open: true, summary: 'Toggle' },
            content: [{ type: 'paragraph' }],
          });
        },
    };
  },

  addInputRules() {
    return [
      new InputRule({
        find: /^>\s(.+)$/,
        handler: ({ state, range, match }) => {
          const { tr } = state;
          const text = match[1];
          tr.delete(range.from, range.to);
          const node = this.type.create({ open: true, summary: text }, [
            state.schema.nodes.paragraph.create(),
          ]);
          tr.insert(range.from, node);
        },
      }),
    ];
  },

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const { state } = editor;
        const { $from } = state.selection;
        // If at end of toggle content, create new toggle after
        for (let d = $from.depth; d > 0; d--) {
          if ($from.node(d).type.name === this.name) {
            const atEnd = $from.parentOffset === $from.parent.content.size;
            const isEmpty = $from.parent.content.size === 0;
            if (atEnd && isEmpty) {
              // Exit toggle - insert paragraph after
              return editor.chain().insertContentAt($from.after(d), { type: 'paragraph' }).focus().run();
            }
            break;
          }
        }
        return false;
      },
    };
  },
});
