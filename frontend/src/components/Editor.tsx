import React, { useCallback, useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import { Link } from '@tiptap/extension-link';
import { Image } from '@tiptap/extension-image';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Underline } from '@tiptap/extension-underline';
import { TextAlign } from '@tiptap/extension-text-align';
import { Highlight } from '@tiptap/extension-highlight';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { Mathematics } from '@tiptap/extension-mathematics';
import TurndownService from 'turndown';
// @ts-ignore - turndown-plugin-gfm types
import { gfm } from 'turndown-plugin-gfm';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code,
  List, ListOrdered, CheckSquare, Quote, Minus, Link as LinkIcon,
  Image as ImageIcon, Table as TableIcon, AlignLeft, AlignCenter,
  AlignRight, Highlighter, Undo, Redo, Heading1, Heading2, Heading3,
  Sigma, GitBranch, Settings, Hash,
  PlayCircle, ExternalLink
} from 'lucide-react';

// Import custom extensions
import { Footnote } from '../extensions/Footnote';
import { YouTubeEmbed } from '../extensions/YouTubeEmbed';
import { LinkCard } from '../extensions/LinkCard';
import { MermaidDiagram } from '../extensions/Mermaid';

interface EditorProps {
  content: string;
  onChange: (content: string) => void;
}

// Enhanced turndown for all new features
const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});

try {
  turndown.use(gfm);
} catch {
  // gfm plugin may not load in all environments
}

// Custom rules for new features
turndown.addRule('taskListItem', {
  filter: (node) => {
    return node.nodeName === 'LI' && node.getAttribute('data-type') === 'taskItem';
  },
  replacement: (content, node) => {
    const checked = (node as HTMLElement).getAttribute('data-checked') === 'true';
    return `${checked ? '- [x]' : '- [ ]'} ${content.trim()}\n`;
  },
});

turndown.addRule('highlight', {
  filter: 'mark',
  replacement: (content) => `==${content}==`,
});

turndown.addRule('footnote', {
  filter: (node) => {
    return node.nodeName === 'SUP' && node.classList?.contains('footnote-ref');
  },
  replacement: (_content, node) => {
    const id = (node as HTMLElement).getAttribute('data-footnote');
    return `[^${id}]`;
  },
});

turndown.addRule('youtubeEmbed', {
  filter: (node) => {
    return node.getAttribute && node.getAttribute('data-youtube-video') !== null;
  },
  replacement: (_content, node) => {
    const iframe = (node as HTMLElement).querySelector('iframe');
    if (iframe && iframe.src) {
      // Extract video ID from embed URL and convert to watch URL
      const match = iframe.src.match(/\/embed\/([^?&]+)/);
      if (match) {
        return `https://www.youtube.com/watch?v=${match[1]}\n\n`;
      }
    }
    return '\n\n';
  },
});

turndown.addRule('linkCard', {
  filter: (node) => {
    return node.getAttribute && node.getAttribute('data-link-card') !== null;
  },
  replacement: (_content, node) => {
    const link = (node as HTMLElement).querySelector('a');
    return link ? `${link.href}\n\n` : '\n\n';
  },
});

turndown.addRule('mermaidDiagram', {
  filter: (node) => {
    return node.getAttribute && node.getAttribute('data-mermaid-code') !== null;
  },
  replacement: (_content, node) => {
    const code = (node as HTMLElement).getAttribute('data-mermaid-code');
    if (code) {
      const decodedCode = decodeURIComponent(code);
      return `\`\`\`mermaid\n${decodedCode}\n\`\`\`\n\n`;
    }
    return '\n\n';
  },
});

turndown.addRule('mathDisplay', {
  filter: (node) => {
    return node.classList?.contains('katex-display');
  },
  replacement: (_content, node) => {
    // Extract original LaTeX from data attribute or annotation
    const annotation = (node as HTMLElement).querySelector('.katex-mathml annotation[encoding="application/x-tex"]');
    if (annotation) {
      return `$$${annotation.textContent}$$\n\n`;
    }
    return '\n\n';
  },
});

turndown.addRule('mathInline', {
  filter: (node) => {
    return node.classList?.contains('katex') && !node.closest('.katex-display');
  },
  replacement: (content, node) => {
    const annotation = (node as HTMLElement).querySelector('.katex-mathml annotation[encoding="application/x-tex"]');
    if (annotation) {
      return `$${annotation.textContent}$`;
    }
    return content;
  },
});

const htmlToMarkdown = (html: string): string => {
  return turndown.turndown(html);
};

const markdownToHtml = (markdown: string): string => {
  let html = markdown;

  // Process footnote definitions first
  const footnoteDefinitions: Record<string, string> = {};
  html = html.replace(/^\[\^([^\]]+)\]:\s*(.+)$/gm, (_match, id, definition) => {
    footnoteDefinitions[id] = definition.trim();
    return '';
  });

  // Math expressions (before other processing)
  html = html.replace(/\$\$([\s\S]*?)\$\$/g, '<div class="math-block" data-math-display="true" data-math="$1">$$$$1$$$$</div>');
  html = html.replace(/\$([^$\n]+)\$/g, '<span class="math-inline" data-math="$1">$$$1$$</span>');

  // Mermaid code blocks
  html = html.replace(/```mermaid\n([\s\S]*?)```/g, (_match, code) => {
    return `<div data-mermaid-code="${encodeURIComponent(code.trim())}" class="mermaid-container">
      <pre class="mermaid-code">${code}</pre>
      <div class="mermaid-rendered" data-processed="false"></div>
    </div>`;
  });

  // YouTube URLs
  html = html.replace(/^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+).*$/gm, (_match, _www, _urlPart, videoId) => {
    return `<div data-youtube-video="" class="embed-container">
      <div class="youtube-embed">
        <iframe src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>
      </div>
    </div>`;
  });

  // Other URLs (but not YouTube)
  html = html.replace(/^(https?:\/\/(?!.*youtube\.com|.*youtu\.be)[^\s]+)$/gm, (_match, url) => {
    const domain = new URL(url).hostname.replace('www.', '');
    return `<div data-link-card="" class="embed-container">
      <a href="${url}" target="_blank" rel="noopener noreferrer" class="link-card">
        <div class="link-card-title">${url}</div>
        <div class="link-card-url">${domain}</div>
      </a>
    </div>`;
  });

  // Footnote references
  html = html.replace(/\[\^([^\]]+)\]/g, (_match, id) => {
    return `<sup data-footnote-id="${id}" class="footnote-ref"><a href="#fn-${id}">${id}</a></sup>`;
  });

  // Code blocks (fenced) — must come before inline transforms
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');

  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.*?)_/g, '<em>$1</em>');

  // Strikethrough
  html = html.replace(/~~(.*?)~~/g, '<s>$1</s>');

  // Highlight
  html = html.replace(/==(.*?)==/g, '<mark>$1</mark>');

  // Inline code (but not if inside math)
  html = html.replace(/`([^`]+)`/g, (match, code) => {
    if (match.includes('$')) return match; // Skip if contains math
    return `<code>${code}</code>`;
  });

  // Images
  html = html.replace(/!\[(.*?)\]\((.*?)\)/g, '<img alt="$1" src="$2" />');

  // Links
  html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');

  // Task lists
  html = html.replace(/^- \[x\] (.*$)/gim, '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>$1</p></li></ul>');
  html = html.replace(/^- \[ \] (.*$)/gim, '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>$1</p></li></ul>');

  // Bullet lists
  html = html.replace(/^- (.*$)/gim, '<li>$1</li>');
  html = html.replace(/(<li>(?:(?!<ul data-type)[\s\S])*?<\/li>\n?)+/g, (match) => {
    if (match.includes('data-type="taskItem"')) return match;
    return `<ul>${match}</ul>`;
  });

  // Ordered lists
  html = html.replace(/^\d+\. (.*$)/gim, '<li>$1</li>');

  // Blockquotes
  html = html.replace(/^> (.*$)/gim, '<blockquote><p>$1</p></blockquote>');

  // Horizontal rules
  html = html.replace(/^---$/gim, '<hr />');

  // Tables (GFM)
  html = html.replace(/^\|(.+)\|\n\|[-| :]+\|\n((?:\|.+\|\n?)*)/gm, (_, header, body) => {
    const headers = header.split('|').map((h: string) => h.trim()).filter(Boolean);
    const rows = body.trim().split('\n').map((row: string) =>
      row.split('|').map((c: string) => c.trim()).filter(Boolean)
    );
    const thead = `<tr>${headers.map((h: string) => `<th>${h}</th>`).join('')}</tr>`;
    const tbody = rows.map((row: string[]) =>
      `<tr>${row.map((c: string) => `<td>${c}</td>`).join('')}</tr>`
    ).join('');
    return `<table><thead>${thead}</thead><tbody>${tbody}</tbody></table>`;
  });

  // Paragraphs (lines that aren't already wrapped)
  html = html.replace(/^(?!<[hublotpi]|<mark|<blockquote|<hr|<pre|<table|<img|<div)(.+)$/gim, '<p>$1</p>');

  return html;
};

const Editor: React.FC<EditorProps> = ({ content, onChange }) => {
  const [spellCheck, setSpellCheck] = useState(() => {
    return localStorage.getItem('spellcheck') !== 'false';
  });
  const [showSettings, setShowSettings] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      Placeholder.configure({
        placeholder: 'Start writing your document...',
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'editor-link' },
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Highlight.configure({ multicolor: false }),
      TextStyle,
      Color,
      Mathematics.configure({
        katexOptions: { throwOnError: false },
      }),
      Footnote,
      YouTubeEmbed,
      LinkCard,
      MermaidDiagram,
    ],
    content: markdownToHtml(content),
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const md = htmlToMarkdown(html);
      onChange(md);
    },
    editorProps: {
      attributes: {
        class: 'ProseMirror',
        spellcheck: spellCheck.toString(),
      },
    },
  });

  useEffect(() => {
    if (editor) {
      const currentMd = htmlToMarkdown(editor.getHTML());
      if (content !== currentMd) {
        editor.commands.setContent(markdownToHtml(content));
      }
    }
  }, [content, editor]);

  useEffect(() => {
    if (editor) {
      editor.view.dom.setAttribute('spellcheck', spellCheck.toString());
    }
  }, [spellCheck, editor]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const url = window.prompt('Enter URL:', 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  const addImage = useCallback(() => {
    if (!editor) return;
    const url = window.prompt('Enter image URL:');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  const insertTable = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  const insertMath = useCallback((inline = true) => {
    if (!editor) return;
    const latex = window.prompt(inline ? 'Enter inline LaTeX:' : 'Enter block LaTeX:', 'E = mc^2');
    if (latex) {
      if (inline) {
        editor.chain().focus().insertContent(`$${latex}$`).run();
      } else {
        editor.chain().focus().insertContent(`$$${latex}$$`).run();
      }
    }
  }, [editor]);

  const insertMermaid = useCallback(() => {
    if (!editor) return;
    const code = window.prompt('Enter Mermaid code:', 'graph TD\n    A[Start] --> B[End]');
    if (code) {
      editor.chain().focus().setMermaid(code).run();
    }
  }, [editor]);

  const addFootnote = useCallback(() => {
    if (!editor) return;
    const id = window.prompt('Enter footnote ID:', '1');
    if (id) {
      editor.chain().focus().setFootnote(id).run();
    }
  }, [editor]);

  const insertYouTube = useCallback(() => {
    if (!editor) return;
    const url = window.prompt('Enter YouTube URL:');
    if (url) {
      editor.chain().focus().setYouTubeVideo({ src: url }).run();
    }
  }, [editor]);

  const insertLinkCard = useCallback(() => {
    if (!editor) return;
    const url = window.prompt('Enter URL:');
    if (url) {
      editor.chain().focus().setLinkCard({ href: url }).run();
    }
  }, [editor]);

  const toggleSpellCheck = useCallback(() => {
    const newValue = !spellCheck;
    setSpellCheck(newValue);
    localStorage.setItem('spellcheck', newValue.toString());
  }, [spellCheck]);

  if (!editor) {
    return <div>Loading editor...</div>;
  }

  const ToolButton = ({ onClick, active, title, children }: {
    onClick: () => void; active?: boolean; title: string; children: React.ReactNode;
  }) => (
    <button onClick={onClick} className={active ? 'primary' : ''} title={title}>
      {children}
    </button>
  );

  const Divider = () => (
    <span style={{ width: '1px', height: '20px', background: 'var(--border)', margin: '0 4px', flexShrink: 0 }} />
  );

  return (
    <div>
      <div className="toolbar">
        {/* Undo / Redo */}
        <ToolButton onClick={() => editor.chain().focus().undo().run()} title="Undo">
          <Undo size={16} />
        </ToolButton>
        <ToolButton onClick={() => editor.chain().focus().redo().run()} title="Redo">
          <Redo size={16} />
        </ToolButton>

        <Divider />

        {/* Text formatting */}
        <ToolButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold (Ctrl+B)">
          <Bold size={16} />
        </ToolButton>
        <ToolButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic (Ctrl+I)">
          <Italic size={16} />
        </ToolButton>
        <ToolButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline (Ctrl+U)">
          <UnderlineIcon size={16} />
        </ToolButton>
        <ToolButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough">
          <Strikethrough size={16} />
        </ToolButton>
        <ToolButton onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')} title="Highlight">
          <Highlighter size={16} />
        </ToolButton>
        <ToolButton onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Inline Code">
          <Code size={16} />
        </ToolButton>

        <Divider />

        {/* Headings */}
        <ToolButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Heading 1">
          <Heading1 size={16} />
        </ToolButton>
        <ToolButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2">
          <Heading2 size={16} />
        </ToolButton>
        <ToolButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3">
          <Heading3 size={16} />
        </ToolButton>

        <Divider />

        {/* Alignment */}
        <ToolButton onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Align Left">
          <AlignLeft size={16} />
        </ToolButton>
        <ToolButton onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Align Center">
          <AlignCenter size={16} />
        </ToolButton>
        <ToolButton onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Align Right">
          <AlignRight size={16} />
        </ToolButton>

        <Divider />

        {/* Lists */}
        <ToolButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet List">
          <List size={16} />
        </ToolButton>
        <ToolButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Ordered List">
          <ListOrdered size={16} />
        </ToolButton>
        <ToolButton onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive('taskList')} title="Task List">
          <CheckSquare size={16} />
        </ToolButton>

        <Divider />

        {/* Block elements */}
        <ToolButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Blockquote">
          <Quote size={16} />
        </ToolButton>
        <ToolButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal Rule">
          <Minus size={16} />
        </ToolButton>

        <Divider />

        {/* Insert */}
        <ToolButton onClick={setLink} active={editor.isActive('link')} title="Insert Link">
          <LinkIcon size={16} />
        </ToolButton>
        <ToolButton onClick={addImage} title="Insert Image">
          <ImageIcon size={16} />
        </ToolButton>
        <ToolButton onClick={insertTable} title="Insert Table">
          <TableIcon size={16} />
        </ToolButton>

        <Divider />

        {/* Math & Advanced */}
        <ToolButton onClick={() => insertMath(true)} title="Inline Math ($...$)">
          <Sigma size={16} />
        </ToolButton>
        <ToolButton onClick={() => insertMath(false)} title="Block Math ($$...$$)">
          <span style={{ fontSize: '16px', fontWeight: 'bold' }}>∑</span>
        </ToolButton>
        <ToolButton onClick={insertMermaid} title="Insert Mermaid Diagram">
          <GitBranch size={16} />
        </ToolButton>
        <ToolButton onClick={addFootnote} title="Add Footnote">
          <Hash size={16} />
        </ToolButton>

        <Divider />

        {/* Embeds */}
        <ToolButton onClick={insertYouTube} title="Embed YouTube Video">
          <PlayCircle size={16} />
        </ToolButton>
        <ToolButton onClick={insertLinkCard} title="Insert Link Card">
          <ExternalLink size={16} />
        </ToolButton>

        <Divider />

        {/* Settings */}
        <div style={{ position: 'relative' }}>
          <ToolButton onClick={() => setShowSettings(!showSettings)} title="Settings">
            <Settings size={16} />
          </ToolButton>
          
          {showSettings && (
            <div className="settings-panel">
              <div className="settings-item">
                <label htmlFor="spellcheck">Spell check</label>
                <input 
                  id="spellcheck"
                  type="checkbox" 
                  checked={spellCheck} 
                  onChange={toggleSpellCheck} 
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
};

export default Editor;