import { Node, mergeAttributes } from '@tiptap/core';

export type BannerType = 'announcement' | 'breaking' | 'update' | 'deprecated';

const BANNER_STYLES: Record<BannerType, { bg: string; border: string; icon: string; color: string }> = {
  announcement: { bg: '#e3f2fd', border: '#1976d2', icon: '📢', color: '#0d47a1' },
  breaking:     { bg: '#ffebee', border: '#d32f2f', icon: '🚨', color: '#b71c1c' },
  update:       { bg: '#e8f5e9', border: '#388e3c', icon: '🆕', color: '#1b5e20' },
  deprecated:   { bg: '#f5f5f5', border: '#757575', icon: '⚠️', color: '#424242' },
};

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    alertBanner: {
      insertBanner: (type?: BannerType) => ReturnType;
    };
  }
}

export const AlertBanner = Node.create({
  name: 'alertBanner',
  group: 'block',
  content: 'inline*',
  defining: true,
  draggable: true,

  addAttributes() {
    return {
      bannerType: {
        default: 'announcement' as BannerType,
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-banner-type') || 'announcement',
        renderHTML: (attrs) => ({ 'data-banner-type': attrs.bannerType }),
      },
      title: {
        default: '',
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-banner-title') || '',
        renderHTML: (attrs) => ({ 'data-banner-title': attrs.title }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-alert-banner]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const t = (node.attrs.bannerType as BannerType) || 'announcement';
    const s = BANNER_STYLES[t];
    const title = node.attrs.title as string;
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-alert-banner': '',
        style: `background:${s.bg};border:1px solid ${s.border};border-left:4px solid ${s.border};padding:12px 16px;margin:8px 0;border-radius:4px;color:${s.color};width:100%;box-sizing:border-box;`,
      }),
      [
        'div',
        { style: 'display:flex;align-items:flex-start;gap:8px;' },
        [
          'span',
          { style: 'font-size:1.2em;flex-shrink:0;' },
          s.icon,
        ],
        [
          'div',
          { style: 'flex:1;' },
          ...(title
            ? [
                ['div', { style: 'font-weight:700;margin-bottom:4px;' }, title],
                ['div', {}, 0],
              ]
            : [['div', {}, 0]]),
        ],
      ],
    ];
  },

  addCommands() {
    return {
      insertBanner:
        (type: BannerType = 'announcement') =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              bannerType: type,
              title: type.charAt(0).toUpperCase() + type.slice(1),
            },
          });
        },
    };
  },
});
