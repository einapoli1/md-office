import { Node, mergeAttributes } from '@tiptap/core';

export interface YouTubeOptions {
  addPasteHandler: boolean;
  allowFullscreen: boolean;
  autoplay: boolean;
  ccLanguage?: string;
  ccLoadPolicy?: boolean;
  controls: boolean;
  disableKBcontrols: boolean;
  enableIFrameApi: boolean;
  endTime: number;
  height: number;
  interfaceLanguage?: string;
  ivLoadPolicy: number;
  loop: boolean;
  modestBranding: boolean;
  nocookie: boolean;
  origin?: string;
  playlist?: string;
  progressBarColor?: string;
  rel: boolean;
  showInfo: boolean;
  startAt: number;
  width: number;
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    youtube: {
      setYouTubeVideo: (options: { src: string; start?: number; end?: number }) => ReturnType;
    };
  }
}

const YOUTUBE_REGEX = /^(https?:\/\/)?(www\.|m\.)?(youtube\.com|youtu\.be)\/(watch\?v=|embed\/|v\/|.+\?v=)?([^&=%\?]{11})/;

const getEmbedUrlFromYouTubeUrl = (url: string): string => {
  const match = url.match(YOUTUBE_REGEX);
  if (!match) return '';
  
  const videoId = match[5];
  return `https://www.youtube.com/embed/${videoId}`;
};

export const YouTubeEmbed = Node.create<YouTubeOptions>({
  name: 'youtube',

  group: 'block',

  addOptions() {
    return {
      addPasteHandler: true,
      allowFullscreen: true,
      autoplay: false,
      ccLanguage: undefined,
      ccLoadPolicy: undefined,
      controls: true,
      disableKBcontrols: false,
      enableIFrameApi: false,
      endTime: 0,
      height: 315,
      interfaceLanguage: undefined,
      ivLoadPolicy: 0,
      loop: false,
      modestBranding: false,
      nocookie: false,
      origin: undefined,
      playlist: undefined,
      progressBarColor: undefined,
      rel: false,
      showInfo: true,
      startAt: 0,
      width: 560,
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      src: {
        default: null,
      },
      start: {
        default: 0,
      },
      end: {
        default: 0,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-youtube-video] iframe',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const embedUrl = getEmbedUrlFromYouTubeUrl(HTMLAttributes.src);
    const { start, end } = HTMLAttributes;

    let url = embedUrl;
    const params = new URLSearchParams();

    if (start) {
      params.set('start', start.toString());
    }

    if (end) {
      params.set('end', end.toString());
    }

    if (this.options.autoplay) {
      params.set('autoplay', '1');
    }

    if (!this.options.controls) {
      params.set('controls', '0');
    }

    if (this.options.disableKBcontrols) {
      params.set('disablekb', '1');
    }

    if (this.options.enableIFrameApi) {
      params.set('enablejsapi', '1');
    }

    if (this.options.loop) {
      params.set('loop', '1');
    }

    if (this.options.modestBranding) {
      params.set('modestbranding', '1');
    }

    if (this.options.nocookie) {
      url = url.replace('youtube.com', 'youtube-nocookie.com');
    }

    if (this.options.origin) {
      params.set('origin', this.options.origin);
    }

    if (this.options.playlist) {
      params.set('playlist', this.options.playlist);
    }

    if (!this.options.rel) {
      params.set('rel', '0');
    }

    if (!this.options.showInfo) {
      params.set('showinfo', '0');
    }

    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, {
        'data-youtube-video': '',
        class: 'embed-container',
      }),
      [
        'div',
        { class: 'youtube-embed' },
        [
          'iframe',
          {
            src: url,
            width: this.options.width,
            height: this.options.height,
            frameborder: 0,
            allowfullscreen: this.options.allowFullscreen ? 'true' : 'false',
          },
        ],
      ],
    ];
  },

  addCommands() {
    return {
      setYouTubeVideo:
        (options: { src: string; start?: number; end?: number }) =>
        ({ commands }) => {
          if (!YOUTUBE_REGEX.test(options.src)) {
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
        find: YOUTUBE_REGEX,
        handler: ({ state, range, match }) => {
          const [, , , , , videoId] = match;
          const src = `https://www.youtube.com/watch?v=${videoId}`;

          const { tr } = state;
          const start = range.from;
          const end = range.to;

          tr.replaceWith(start, end, this.type.create({ src }));
        },
      },
    ];
  },
});