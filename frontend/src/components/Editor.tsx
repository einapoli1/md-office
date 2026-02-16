import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { TableRow } from '@tiptap/extension-table';
import { TableAdvanced, TableCellAdvanced, TableHeaderAdvanced } from '../extensions/TableAdvanced';
import { Link } from '@tiptap/extension-link';
import { ImageResize } from '../extensions/ImageResize';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Underline } from '@tiptap/extension-underline';
import { TextAlign } from '@tiptap/extension-text-align';
import { Highlight } from '@tiptap/extension-highlight';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { FontFamily } from '@tiptap/extension-font-family';
import { Superscript } from '@tiptap/extension-superscript';
import { Subscript } from '@tiptap/extension-subscript';
import { Blockquote } from '@tiptap/extension-blockquote';
import { CodeBlock } from '@tiptap/extension-code-block';
import { HorizontalRule } from '@tiptap/extension-horizontal-rule';
import { Mathematics } from '@tiptap/extension-mathematics';
import { Collaboration } from '@tiptap/extension-collaboration';
import { CollaborationCursor } from '@tiptap/extension-collaboration-cursor';
import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';
import TurndownService from 'turndown';
// @ts-ignore - turndown-plugin-gfm types
import { gfm } from 'turndown-plugin-gfm';

// Import custom extensions
import { Footnote } from '../extensions/Footnote';
import { TableOfContentsBlock } from '../extensions/TableOfContentsBlock';
import { YouTubeEmbed } from '../extensions/YouTubeEmbed';
import { LinkCard } from '../extensions/LinkCard';
import { MermaidDiagram } from '../extensions/Mermaid';
import { MermaidBlock } from '../extensions/MermaidBlock';
import { PageBreaks } from '../extensions/PageBreaks';
import { CommentExtension } from '../extensions/CommentExtension';
import { LineHeight } from '../extensions/LineHeight';
import { Bookmark } from '../extensions/Bookmark';
import { SuggestionExtension } from '../extensions/SuggestionExtension';
import { ImageDrop } from '../extensions/ImageDrop';
import { Columns } from '../extensions/Columns';
import { TabStop } from '../extensions/TabStop';
import { getUserColor } from '../utils/collabColors';
import { Title, Subtitle } from '../extensions/ParagraphStyles';
import MentionExtension from '../extensions/Mention';
import DateChip from '../extensions/DateChip';
import { VariableChip } from '../extensions/VariableChip';
import { TemplateVariable } from '../extensions/TemplateVariable';
import { EquationEvaluator } from '../extensions/EquationEvaluator';
import TableToolbar from './TableToolbar';
import TableContextMenu from './TableContextMenu';
import { importDocx } from '../utils/docxIO';

interface EditorProps {
  content: string;
  onChange: (content: string) => void;
  onEditorReady?: (editor: any) => void;
  documentName?: string; // For collaboration
  enableCollaboration?: boolean; // Whether to enable real-time collaboration
  collaborationServerUrl?: string; // Hocuspocus server URL
  userName?: string; // Current user name for cursor display
  onProviderReady?: (provider: HocuspocusProvider | null) => void;
  pageless?: boolean;
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

const Editor: React.FC<EditorProps> = ({ 
  content, 
  onChange, 
  onEditorReady, 
  documentName,
  enableCollaboration = false,
  collaborationServerUrl = 'ws://localhost:1234',
  userName = 'Anonymous User',
  onProviderReady,
  pageless = false
}) => {
  const [spellCheck, setSpellCheck] = useState(() => {
    return localStorage.getItem('spellcheck') !== 'false';
  });
  const [showSettings, setShowSettings] = useState(false);
  
  // Paint Format state
  const paintFormatRef = useRef<{ marks: any[]; persistent: boolean } | null>(null);
  const [collaborationStatus, setCollaborationStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [connectedUsers, setConnectedUsers] = useState<number>(0);
  
  // Throttle onUpdate markdown conversion (expensive on large docs)
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Refs for collaboration
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<HocuspocusProvider | null>(null);
  
  // getUserColor imported from utils/collabColors

  // Setup collaboration
  useEffect(() => {
    if (enableCollaboration && documentName) {
      // Create Y.Doc and provider
      const newYdoc = new Y.Doc();
      const newProvider = new HocuspocusProvider({
        url: collaborationServerUrl,
        name: documentName,
        document: newYdoc,
      });

      setYdoc(newYdoc);
      setProvider(newProvider);
      onProviderReady?.(newProvider);

      // Connection status handlers
      newProvider.on('status', ({ status }: { status: string }) => {
        if (status === 'connecting') {
          setCollaborationStatus('connecting');
          window.dispatchEvent(new CustomEvent('collab-status', { detail: { status: 'connecting' } }));
        } else if (status === 'connected') {
          setCollaborationStatus('connected');
          window.dispatchEvent(new CustomEvent('collab-status', { detail: { status: 'connected' } }));
        } else {
          setCollaborationStatus('disconnected');
          window.dispatchEvent(new CustomEvent('collab-status', { detail: { status: 'disconnected' } }));
        }
      });

      // Track connected users
      if (newProvider.awareness) {
        newProvider.awareness.on('change', () => {
          const states = newProvider.awareness!.getStates();
          setConnectedUsers(states.size);
            window.dispatchEvent(new CustomEvent('collab-users', { detail: { count: states.size } }));
        });

        // Set current user info
        newProvider.awareness.setLocalStateField('user', {
          name: userName,
          color: getUserColor(userName),
        });
      }

      return () => {
        newProvider.destroy();
        newYdoc.destroy();
        setYdoc(null);
        setProvider(null);
        onProviderReady?.(null);
      };
    }
  }, [enableCollaboration, documentName, collaborationServerUrl, userName]);

  // Determine if collab is ready (ydoc + provider both exist)
  const collabReady = enableCollaboration && ydoc != null && provider != null;
  
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        // Disable built-in Link/Underline since we configure them separately
        link: false,
        underline: false,
        // Disable undo/redo when collaboration is active (Y.js handles it)
        undoRedo: collabReady ? false : undefined,
      }),
      Placeholder.configure({
        placeholder: 'Start writing your document...',
      }),
      TableAdvanced.configure({ resizable: true }),
      TableRow,
      TableCellAdvanced,
      TableHeaderAdvanced,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'editor-link' },
      }),
      ImageResize.configure({
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
      FontFamily,
      Superscript,
      Subscript,
      Blockquote,
      CodeBlock,
      LineHeight,
      HorizontalRule,
      Mathematics.configure({
        katexOptions: { throwOnError: false },
      }),
      Footnote,
      TableOfContentsBlock,
      YouTubeEmbed,
      LinkCard,
      MermaidDiagram,
      MermaidBlock,
      SuggestionExtension.configure({
        onSuggestionClick: (suggestionId: string) => {
          window.dispatchEvent(new CustomEvent('suggestion-click', { detail: { suggestionId } }));
        },
      }),
      CommentExtension.configure({
        onCommentClick: (commentId: string) => {
          // Dispatch custom event so App can handle it
          window.dispatchEvent(new CustomEvent('comment-click', { detail: { commentId } }));
        },
      }),
      Bookmark,
      ImageDrop,
      Columns,
      TabStop,
      Title,
      Subtitle,
      MentionExtension,
      DateChip,
      VariableChip,
      TemplateVariable,
      EquationEvaluator,
      PageBreaks.configure({
        pageHeight: 1056,
        gapHeight: 24,
        enabled: !pageless,
      }),
      // Collaboration extension (only when ydoc is ready)
      ...(collabReady ? [
        Collaboration.configure({
          document: ydoc,
        }),
        CollaborationCursor.configure({
          provider: provider,
          user: {
            name: userName,
            color: getUserColor(userName),
          },
        }),
      ] : []),
    ],
    // When collab is active, TipTap will use Yjs state if available,
    // or fall back to this content for initial population of empty Yjs docs
    content: markdownToHtml(content),
    onUpdate: ({ editor }) => {
      // Only call onChange in non-collaborative mode
      // In collaborative mode, the Hocuspocus server handles saving
      if (!enableCollaboration) {
        // Throttle markdown conversion to 300ms — turndown is expensive on large docs
        if (throttleTimerRef.current) clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = setTimeout(() => {
          const html = editor.getHTML();
          const md = htmlToMarkdown(html);
          onChangeRef.current(md);
        }, 300);
      }
    },
    editorProps: {
      attributes: {
        class: 'ProseMirror',
        spellcheck: spellCheck.toString(),
      },
    },
  }, [collabReady]);

  // Seed collaborative editor with initial content when Yjs doc is empty
  useEffect(() => {
    if (editor && collabReady && provider) {
      const handleSynced = () => {
        const fragment = ydoc!.getXmlFragment('default');
        if (fragment.length === 0 && content) {
          // Yjs doc is empty after sync — seed it with the local content
          editor.commands.setContent(markdownToHtml(content));
        }
      };
      // If already synced, check immediately
      if (provider.isSynced) {
        handleSynced();
      }
      provider.on('synced', handleSynced);
      return () => {
        provider.off('synced', handleSynced);
      };
    }
  }, [editor, collabReady, provider, ydoc]);

  useEffect(() => {
    if (editor && !enableCollaboration) {
      const currentMd = htmlToMarkdown(editor.getHTML());
      if (content !== currentMd) {
        editor.commands.setContent(markdownToHtml(content));
      }
    }
  }, [content, editor, enableCollaboration]);

  const toggleSpellCheck = useCallback(() => {
    const newValue = !spellCheck;
    setSpellCheck(newValue);
    localStorage.setItem('spellcheck', newValue.toString());
  }, [spellCheck]);

  // Listen for spellcheck toggle from MenuBar
  useEffect(() => {
    const handleSpellCheckToggle = () => {
      toggleSpellCheck();
    };
    window.addEventListener('spellcheck-toggle', handleSpellCheckToggle);
    return () => window.removeEventListener('spellcheck-toggle', handleSpellCheckToggle);
  }, [toggleSpellCheck]);

  // Keyboard shortcuts handler
  useEffect(() => {
    if (!editor) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      // Cmd+\ — Clear formatting
      if (e.key === '\\' && !e.shiftKey) {
        e.preventDefault();
        editor.chain().focus().clearNodes().unsetAllMarks().run();
        return;
      }
      // Cmd+E — Center align
      if (e.key === 'e' && !e.shiftKey) {
        e.preventDefault();
        editor.chain().focus().setTextAlign('center').run();
        return;
      }
      // Cmd+J — Justify
      if (e.key === 'j' && !e.shiftKey) {
        e.preventDefault();
        editor.chain().focus().setTextAlign('justify').run();
        return;
      }
      // Cmd+L — Left align
      if (e.key === 'l' && !e.shiftKey) {
        e.preventDefault();
        editor.chain().focus().setTextAlign('left').run();
        return;
      }
      // Cmd+R — Right align
      if (e.key === 'r' && !e.shiftKey) {
        e.preventDefault();
        editor.chain().focus().setTextAlign('right').run();
        return;
      }

      if (!e.shiftKey) return;

      // Cmd+Shift+C — Copy formatting
      if (e.key === 'C') {
        e.preventDefault();
        const marks = editor.state.storedMarks || editor.state.selection.$from.marks();
        paintFormatRef.current = { marks: marks.map((m: any) => m.toJSON()), persistent: false };
        window.dispatchEvent(new CustomEvent('paint-format-change', { detail: { active: true, persistent: false } }));
        return;
      }
      // Cmd+Shift+V — Paste without formatting (or apply stored format)
      if (e.key === 'V') {
        if (paintFormatRef.current) {
          // Apply stored formatting
          e.preventDefault();
          const chain = editor.chain().focus().unsetAllMarks();
          for (const mark of paintFormatRef.current.marks) {
            chain.setMark(mark.type, mark.attrs);
          }
          chain.run();
          if (!paintFormatRef.current.persistent) {
            paintFormatRef.current = null;
            window.dispatchEvent(new CustomEvent('paint-format-change', { detail: { active: false, persistent: false } }));
          }
        } else {
          // Paste as plain text
          e.preventDefault();
          navigator.clipboard.readText().then(text => {
            editor.chain().focus().insertContent(text).run();
          });
        }
        return;
      }
      // Cmd+Shift+L — Bullet list
      if (e.key === 'L') {
        e.preventDefault();
        editor.chain().focus().toggleBulletList().run();
        return;
      }
      // Cmd+Shift+7 — Numbered list
      if (e.key === '7' || e.code === 'Digit7') {
        e.preventDefault();
        editor.chain().focus().toggleOrderedList().run();
        return;
      }
      // Cmd+Shift+8 — Bullet list
      if (e.key === '8' || e.code === 'Digit8') {
        e.preventDefault();
        editor.chain().focus().toggleBulletList().run();
        return;
      }
    };

    // Escape to cancel paint format
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && paintFormatRef.current) {
        paintFormatRef.current = null;
        window.dispatchEvent(new CustomEvent('paint-format-change', { detail: { active: false, persistent: false } }));
      }
    };

    // Apply paint format on click in editor
    const handleEditorClick = () => {
      if (!paintFormatRef.current) return;
      const chain = editor.chain().focus().unsetAllMarks();
      for (const mark of paintFormatRef.current.marks) {
        chain.setMark(mark.type, mark.attrs);
      }
      chain.run();
      if (!paintFormatRef.current.persistent) {
        paintFormatRef.current = null;
        window.dispatchEvent(new CustomEvent('paint-format-change', { detail: { active: false, persistent: false } }));
      }
    };

    // Listen for paint-format-copy events from toolbar
    const handlePaintFormatCopy = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const marks = editor.state.storedMarks || editor.state.selection.$from.marks();
      paintFormatRef.current = { marks: marks.map((m: any) => m.toJSON()), persistent: detail?.persistent || false };
    };
    const handlePaintFormatClear = () => {
      paintFormatRef.current = null;
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keydown', handleEscape);
    editor.view.dom.addEventListener('click', handleEditorClick);
    window.addEventListener('paint-format-copy', handlePaintFormatCopy);
    window.addEventListener('paint-format-clear', handlePaintFormatClear);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keydown', handleEscape);
      editor.view.dom.removeEventListener('click', handleEditorClick);
      window.removeEventListener('paint-format-copy', handlePaintFormatCopy);
      window.removeEventListener('paint-format-clear', handlePaintFormatClear);
    };
  }, [editor]);

  useEffect(() => {
    if (editor) {
      editor.view.dom.setAttribute('spellcheck', spellCheck.toString());
      if (onEditorReady) {
        onEditorReady(editor);
      }
    }
  }, [spellCheck, editor, onEditorReady]);

  // Update PageBreaks enabled state when pageless changes
  useEffect(() => {
    if (editor) {
      const pbExt = editor.extensionManager.extensions.find((e: any) => e.name === 'pageBreaks');
      if (pbExt) {
        pbExt.options.enabled = !pageless;
        // Force a re-render of decorations by dispatching a doc-changed-like transaction
        editor.view.dispatch(editor.state.tr.setMeta('forcePageBreakRecalc', true));
      }
    }
  }, [pageless, editor]);

  // Drag-and-drop .docx import
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    const handleDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) {
        e.preventDefault();
      }
    };
    const handleDrop = async (e: DragEvent) => {
      const file = e.dataTransfer?.files?.[0];
      if (!file || !file.name.endsWith('.docx')) return;
      e.preventDefault();
      e.stopPropagation();
      try {
        const html = await importDocx(file);
        editor.commands.setContent(html);
      } catch (err) {
        console.error('DOCX drop import failed:', err);
      }
    };
    dom.addEventListener('dragover', handleDragOver);
    dom.addEventListener('drop', handleDrop as unknown as EventListener);
    return () => {
      dom.removeEventListener('dragover', handleDragOver);
      dom.removeEventListener('drop', handleDrop as unknown as EventListener);
    };
  }, [editor]);

  if (!editor) {
    return <div className="editor-loading">Loading editor...</div>;
  }

  return (
    <div className="google-docs-editor">
      {/* Collaboration status indicator */}
      {enableCollaboration && (
        <div className="collaboration-status">
          <div className={`status-indicator ${collaborationStatus}`}>
            {collaborationStatus === 'connected' && (
              <>
                <span className="status-dot"></span>
                Connected • {connectedUsers} user{connectedUsers !== 1 ? 's' : ''}
              </>
            )}
            {collaborationStatus === 'connecting' && (
              <>
                <span className="status-dot connecting"></span>
                Connecting...
              </>
            )}
            {collaborationStatus === 'disconnected' && (
              <>
                <span className="status-dot disconnected"></span>
                Disconnected
              </>
            )}
          </div>
        </div>
      )}
      
      <div className="editor-content-area" style={{ position: 'relative' }}>
        <TableToolbar editor={editor} />
        <TableContextMenu editor={editor} />
        <EditorContent 
          editor={editor} 
          className="docs-editor-content"
        />
      </div>

      {/* Settings panel (if needed) */}
      {showSettings && (
        <div className="settings-overlay" onClick={() => setShowSettings(false)}>
          <div className="settings-panel" onClick={e => e.stopPropagation()}>
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
        </div>
      )}
    </div>
  );
};

export default Editor;