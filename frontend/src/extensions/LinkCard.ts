import { Node, mergeAttributes } from '@tiptap/core';

export interface LinkCardOptions {
  addPasteHandler: boolean;
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    linkCard: {
      setLinkCard: (options: { href: string; title?: string }) => ReturnType;
    };
  }
}

const URL_REGEX = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;

export const LinkCard = Node.create<LinkCardOptions>({
  name: 'linkCard',

  group: 'block',

  addOptions() {
    return {
      addPasteHandler: true,
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      href: {
        default: null,
      },
      title: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-link-card]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const { href, title } = HTMLAttributes;
    const domain = href ? new URL(href).hostname.replace('www.', '') : '';
    const displayTitle = title || href || 'Link';

    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, {
        'data-link-card': '',
        class: 'embed-container',
      }),
      [
        'a',
        {
          href,
          target: '_blank',
          rel: 'noopener noreferrer',
          class: 'link-card',
        },
        [
          'div',
          { class: 'link-card-title' },
          displayTitle,
        ],
        [
          'div',
          { class: 'link-card-url' },
          domain,
        ],
      ],
    ];
  },

  addCommands() {
    return {
      setLinkCard:
        (options: { href: string; title?: string }) =>
        ({ commands }) => {
          if (!URL_REGEX.test(options.href)) {
            return false;
          }

          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
    };
  },

  addPasteRules() {
    if (!this.options.addPasteHandler) {
      return [];
    }

    return [
      {
        find: URL_REGEX,
        handler: ({ state, range, match }) => {
          const url = match[0];
          
          // Skip if it's a YouTube URL (handled by YouTube extension)
          if (/youtube\.com|youtu\.be/.test(url)) {
            return;
          }

          const { tr } = state;
          const start = range.from;
          const end = range.to;

          tr.replaceWith(start, end, this.type.create({ href: url }));
        },
      },
    ];
  },
});