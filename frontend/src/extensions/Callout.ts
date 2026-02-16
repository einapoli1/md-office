import { Node, mergeAttributes } from '@tiptap/core';

export type CalloutType = 'info' | 'warning' | 'error' | 'success' | 'tip' | 'note';

const CALLOUT_STYLES: Record<CalloutType, { bg: string; border: string; icon: string }> = {
  info:    { bg: '#e3f2fd', border: '#2196f3', icon: 'ℹ️' },
  warning: { bg: '#fff8e1', border: '#ff9800', icon: '⚠️' },
  error:   { bg: '#ffebee', border: '#f44336', icon: '❌' },
  success: { bg: '#e8f5e9', border: '#4caf50', icon: '✅' },
  tip:     { bg: '#f3e5f5', border: '#9c27b0', icon: '💡' },
  note:    { bg: '#f5f5f5', border: '#9e9e9e', icon: '📝' },
};

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      insertCallout: (type?: CalloutType) => ReturnType;
      setCalloutType: (type: CalloutType) => ReturnType;
    };
  }
}

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      type: {
        default: 'info' as CalloutType,
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-callout-type') || 'info',
        renderHTML: (attrs) => ({ 'data-callout-type': attrs.type }),
      },
      title: {
        default: '',
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-callout-title') || '',
        renderHTML: (attrs) => ({ 'data-callout-title': attrs.title }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-callout]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const t = (node.attrs.type as CalloutType) || 'info';
    const style = CALLOUT_STYLES[t];
    const title = node.attrs.title as string;
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-callout': '',
        style: `background:${style.bg};border-left:4px solid ${style.border};padding:12px 16px;margin:8px 0;border-radius:4px;`,
      }),
      ...(title
        ? [['div', { style: 'font-weight:bold;margin-bottom:4px;' }, `${style.icon} ${title}`], ['div', {}, 0]]
        : [['div', {}, `${style.icon} `], ['div', {}, 0]]),
    ];
  },

  addCommands() {
    return {
      insertCallout:
        (type: CalloutType = 'info') =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { type, title: type.charAt(0).toUpperCase() + type.slice(1) },
            content: [{ type: 'paragraph' }],
          });
        },
      setCalloutType:
        (type: CalloutType) =>
        ({ commands }) => {
          return commands.updateAttributes(this.name, { type });
        },
    };
  },

  addInputRules() {
    // Match > [!type] syntax
    const types: CalloutType[] = ['info', 'warning', 'error', 'success', 'tip', 'note'];
    return types.map((t) => ({
      find: new RegExp(`^>\\s*\\[!${t}\\]\\s$`),
      handler: ({ state, range, chain }: { state: any; range: any; chain: any }) => {
        const { tr } = state;
        tr.delete(range.from, range.to);
        chain().insertCallout(t).run();
      },
    })) as any;
  },
});
