import { useMemo } from 'react';
import { Slide, SlideLayout } from './slideModel';

interface LayoutSuggestion {
  id: string;
  name: string;
  layout: SlideLayout;
  description: string;
  icon: string;
  transform: (content: string) => string;
}

interface Props {
  slide: Slide;
  onApply: (layout: SlideLayout, content: string) => void;
  onClose: () => void;
}

function detectContentType(content: string): 'text' | 'image' | 'list' | 'mixed' {
  const hasImage = /!\[.*?\]\(.*?\)/.test(content);
  const bullets = content.split('\n').filter(l => /^\s*[-*+]\s/.test(l)).length;
  if (hasImage && bullets > 0) return 'mixed';
  if (hasImage) return 'image';
  if (bullets >= 3) return 'list';
  return 'text';
}

function extractTitle(content: string): string {
  const m = content.match(/^#\s+(.+)$/m);
  return m ? m[1] : '';
}

function extractBullets(content: string): string[] {
  return content.split('\n').filter(l => /^\s*[-*+]\s/.test(l)).map(l => l.replace(/^\s*[-*+]\s+/, ''));
}

function extractImages(content: string): string[] {
  const imgs: string[] = [];
  const re = /!\[.*?\]\((.*?)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) imgs.push(m[1]);
  return imgs;
}

function extractPlainText(content: string): string {
  return content.replace(/^#+\s+.+$/gm, '').replace(/!\[.*?\]\(.*?\)/g, '').replace(/<!--[\s\S]*?-->/g, '').trim();
}

const SUGGESTIONS: Record<string, (content: string) => LayoutSuggestion[]> = {
  text: (content) => {
    const title = extractTitle(content);
    const text = extractPlainText(content);
    const words = text.split(/\s+/).filter(Boolean);
    const mid = Math.ceil(words.length / 2);

    return [
      {
        id: 'two-col-text',
        name: 'Two Columns',
        layout: 'two-column',
        description: 'Split text into two columns',
        icon: '📰',
        transform: () => `<!-- slide: two-column -->\n# ${title || 'Title'}\n\n:::: left\n${words.slice(0, mid).join(' ')}\n::::\n\n:::: right\n${words.slice(mid).join(' ')}\n::::`,
      },
      {
        id: 'bullets',
        name: 'Bullet Points',
        layout: 'content',
        description: 'Convert to bullet points',
        icon: '📝',
        transform: () => {
          const sentences = text.split(/[.!?]+/).filter(s => s.trim());
          return `<!-- slide: content -->\n# ${title || 'Title'}\n\n${sentences.map(s => `- ${s.trim()}`).join('\n')}`;
        },
      },
      {
        id: 'title-focus',
        name: 'Title Focus',
        layout: 'title',
        description: 'Large title with subtitle',
        icon: '🎯',
        transform: () => {
          const firstLine = text.split('\n')[0] || text.slice(0, 60);
          return `<!-- slide: title -->\n# ${title || firstLine}\n## ${title ? firstLine : ''}`;
        },
      },
      {
        id: 'section-break',
        name: 'Section Break',
        layout: 'section',
        description: 'Clean section divider',
        icon: '📌',
        transform: () => `<!-- slide: section -->\n# ${title || 'Section Title'}`,
      },
    ];
  },

  list: (content) => {
    const title = extractTitle(content);
    const bullets = extractBullets(content);
    const mid = Math.ceil(bullets.length / 2);

    return [
      {
        id: 'two-col-list',
        name: 'Two Column List',
        layout: 'two-column',
        description: 'Split list across two columns',
        icon: '📋',
        transform: () => `<!-- slide: two-column -->\n# ${title || 'Title'}\n\n:::: left\n${bullets.slice(0, mid).map(b => `- ${b}`).join('\n')}\n::::\n\n:::: right\n${bullets.slice(mid).map(b => `- ${b}`).join('\n')}\n::::`,
      },
      {
        id: 'icon-grid',
        name: 'Icon Grid',
        layout: 'content',
        description: 'Items as icon cards',
        icon: '🔲',
        transform: () => `<!-- slide: content -->\n# ${title || 'Title'}\n\n${bullets.map((b, i) => `### ${['💡', '🎯', '📊', '🔑', '⭐', '🚀'][i % 6]} ${b}`).join('\n\n')}`,
      },
      {
        id: 'numbered',
        name: 'Numbered Steps',
        layout: 'content',
        description: 'Convert to numbered list',
        icon: '🔢',
        transform: () => `<!-- slide: content -->\n# ${title || 'Title'}\n\n${bullets.map((b, i) => `${i + 1}. ${b}`).join('\n')}`,
      },
      {
        id: 'minimal-list',
        name: 'Minimal',
        layout: 'content',
        description: 'Clean minimal list',
        icon: '✨',
        transform: () => `<!-- slide: content -->\n# ${title || 'Title'}\n\n${bullets.map(b => `- ${b}`).join('\n')}`,
      },
    ];
  },

  image: (content) => {
    const title = extractTitle(content);
    const images = extractImages(content);
    const img = images[0] || '';

    return [
      {
        id: 'full-image',
        name: 'Full Image',
        layout: 'image',
        description: 'Image fills the slide',
        icon: '🖼',
        transform: () => `<!-- slide: image -->\n![${title || 'Image'}](${img})`,
      },
      {
        id: 'image-with-caption',
        name: 'Image + Caption',
        layout: 'content',
        description: 'Image with text below',
        icon: '📸',
        transform: () => `<!-- slide: content -->\n# ${title || 'Title'}\n\n![Image](${img})\n\n${extractPlainText(content) || 'Caption text here'}`,
      },
      {
        id: 'image-left',
        name: 'Image Left',
        layout: 'two-column',
        description: 'Image on left, text on right',
        icon: '◀️',
        transform: () => `<!-- slide: two-column -->\n# ${title || 'Title'}\n\n:::: left\n![Image](${img})\n::::\n\n:::: right\n${extractPlainText(content) || 'Description here'}\n::::`,
      },
      {
        id: 'image-right',
        name: 'Image Right',
        layout: 'two-column',
        description: 'Text on left, image on right',
        icon: '▶️',
        transform: () => `<!-- slide: two-column -->\n# ${title || 'Title'}\n\n:::: left\n${extractPlainText(content) || 'Description here'}\n::::\n\n:::: right\n![Image](${img})\n::::`,
      },
    ];
  },

  mixed: (content) => {
    const title = extractTitle(content);
    const images = extractImages(content);
    const bullets = extractBullets(content);
    const img = images[0] || '';

    return [
      {
        id: 'image-bullets-left',
        name: 'Image + Bullets',
        layout: 'two-column',
        description: 'Image left, bullets right',
        icon: '📊',
        transform: () => `<!-- slide: two-column -->\n# ${title || 'Title'}\n\n:::: left\n![Image](${img})\n::::\n\n:::: right\n${bullets.map(b => `- ${b}`).join('\n')}\n::::`,
      },
      {
        id: 'content-standard',
        name: 'Standard Layout',
        layout: 'content',
        description: 'Title, image, then bullets',
        icon: '📄',
        transform: () => `<!-- slide: content -->\n# ${title || 'Title'}\n\n![Image](${img})\n\n${bullets.map(b => `- ${b}`).join('\n')}`,
      },
      {
        id: 'image-focus-mixed',
        name: 'Image Focus',
        layout: 'image',
        description: 'Large image with overlay text',
        icon: '🎨',
        transform: () => `<!-- slide: image -->\n# ${title || 'Title'}\n\n![Image](${img})\n\n> ${bullets[0] || ''}`,
      },
      {
        id: 'minimal-mixed',
        name: 'Minimal',
        layout: 'content',
        description: 'Clean and simple',
        icon: '✨',
        transform: () => `<!-- slide: content -->\n# ${title || 'Title'}\n\n${extractPlainText(content)}`,
      },
    ];
  },
};

export default function DesignIdeas({ slide, onApply, onClose }: Props) {
  const contentType = useMemo(() => detectContentType(slide.content), [slide.content]);
  const suggestions = useMemo(() => {
    const fn = SUGGESTIONS[contentType];
    return fn ? fn(slide.content) : [];
  }, [contentType, slide.content]);

  return (
    <div style={{
      position: 'fixed', right: 0, top: 0, bottom: 0, width: 320,
      background: 'var(--bg-primary, #fff)', borderLeft: '1px solid var(--border-color, #ddd)',
      zIndex: 998, display: 'flex', flexDirection: 'column',
      boxShadow: '-4px 0 16px rgba(0,0,0,0.1)',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 16px', borderBottom: '1px solid var(--border-color, #ddd)',
      }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>🎨 Design Ideas</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>✕</button>
      </div>

      <div style={{ padding: '8px 16px', fontSize: 12, color: '#666', borderBottom: '1px solid var(--border-color, #eee)' }}>
        Content detected: <strong>{contentType}</strong> · {suggestions.length} suggestions
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {suggestions.map(s => (
          <button
            key={s.id}
            onClick={() => onApply(s.layout, s.transform(slide.content))}
            style={{
              display: 'flex', flexDirection: 'column', gap: 6,
              padding: 12, borderRadius: 8, border: '1px solid var(--border-color, #ddd)',
              background: 'var(--bg-secondary, #f8f8f8)', cursor: 'pointer',
              textAlign: 'left', transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#4285f4')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-color, #ddd)')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20 }}>{s.icon}</span>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</span>
            </div>
            <div style={{ fontSize: 12, color: '#666' }}>{s.description}</div>
            {/* Mini preview */}
            <div style={{
              marginTop: 4, padding: 8, borderRadius: 4, background: 'var(--bg-primary, #fff)',
              fontSize: 10, color: '#888', maxHeight: 60, overflow: 'hidden',
              whiteSpace: 'pre-wrap', lineHeight: 1.4,
            }}>
              {s.transform(slide.content).slice(0, 150)}...
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
