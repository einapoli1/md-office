import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import VariableChipView from '../components/VariableChipView';

export interface VariableChipOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    variableChip: {
      insertVariableChip: (name: string, value: number) => ReturnType;
    };
  }
}

/**
 * Scan all variable chip nodes in the document and return a name→value map.
 */
export function collectVariables(doc: any): Record<string, number> {
  const vars: Record<string, number> = {};
  doc.descendants((node: any) => {
    if (node.type.name === 'variableChip') {
      const { name, value } = node.attrs;
      if (name && value !== undefined && value !== null) {
        vars[name] = Number(value);
      }
    }
  });
  return vars;
}

export const VariableChip = Node.create<VariableChipOptions>({
  name: 'variableChip',
  group: 'inline',
  inline: true,
  atom: true,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      name: { default: 'x' },
      value: { default: 0 },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-variable-chip]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(
      { 'data-variable-chip': '', class: 'variable-chip' },
      this.options.HTMLAttributes,
      HTMLAttributes
    )];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VariableChipView);
  },

  addCommands() {
    return {
      insertVariableChip:
        (name: string, value: number) =>
        ({ commands }: any) =>
          commands.insertContent({
            type: this.name,
            attrs: { name, value },
          }),
    };
  },

  // Input rule: typing @let x = 5 inserts a variable chip
  addProseMirrorPlugins() {
    const type = this.type;
    return [
      new Plugin({
        key: new PluginKey('variableChipInput'),
        props: {
          handleTextInput(view, from, to, text) {
            if (text !== ' ' && text !== '\n') return false;
            const $from = view.state.doc.resolve(from);
            const textBefore = $from.parent.textBetween(
              Math.max(0, $from.parentOffset - 30),
              $from.parentOffset,
              undefined,
              '\ufffc'
            );
            // Match @let <name> = <value>
            const match = textBefore.match(/@let\s+([a-zA-Z_]\w*)\s*=\s*(-?\d+(?:\.\d+)?)\s*$/);
            if (!match) return false;
            const name = match[1];
            const value = parseFloat(match[2]);
            const matchStart = from - match[0].length;
            const tr = view.state.tr
              .delete(matchStart, to)
              .insert(matchStart, type.create({ name, value }));
            view.dispatch(tr);
            return true;
          },
        },
      }),
    ];
  },
});

export default VariableChip;
