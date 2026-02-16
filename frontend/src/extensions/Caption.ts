import { Node, mergeAttributes } from '@tiptap/core';

export type CaptionKind = 'figure' | 'table';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    caption: {
      insertCaption: (kind?: CaptionKind) => ReturnType;
    };
  }
}

export const Caption = Node.create({
  name: 'caption',
  group: 'block',
  content: 'inline*',
  defining: true,

  addAttributes() {
    return {
      kind: {
        default: 'figure' as CaptionKind,
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-caption-kind') || 'figure',
        renderHTML: (attrs) => ({ 'data-caption-kind': attrs.kind }),
      },
      number: {
        default: 1,
        parseHTML: (el) => parseInt((el as HTMLElement).getAttribute('data-caption-number') || '1', 10),
        renderHTML: (attrs) => ({ 'data-caption-number': String(attrs.number) }),
      },
      captionId: {
        default: '',
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-caption-id') || '',
        renderHTML: (attrs) => ({ 'data-caption-id': attrs.captionId }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'figcaption[data-caption-kind]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const kind = node.attrs.kind as CaptionKind;
    const num = node.attrs.number as number;
    const prefix = kind === 'figure' ? 'Figure' : 'Table';
    const id = node.attrs.captionId as string;
    return [
      'figcaption',
      mergeAttributes(HTMLAttributes, {
        id: id || undefined,
        style: 'text-align:center;font-style:italic;color:#555;margin:4px 0 12px;font-size:0.9em;',
      }),
      ['strong', {}, `${prefix} ${num}: `],
      ['span', {}, 0],
    ];
  },

  addCommands() {
    return {
      insertCaption:
        (kind: CaptionKind = 'figure') =>
        ({ editor, commands }) => {
          // Count existing captions of this kind to get next number
          let count = 0;
          editor.state.doc.descendants((n) => {
            if (n.type.name === 'caption' && n.attrs.kind === kind) count++;
          });
          const captionId = `${kind}-${count + 1}-${Date.now()}`;
          return commands.insertContent({
            type: this.name,
            attrs: { kind, number: count + 1, captionId },
            content: [{ type: 'text', text: 'Caption text' }],
          });
        },
    };
  },
});
