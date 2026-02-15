import React, { useEffect, useRef } from 'react';
import { markdownToHtml } from '../utils/markdown';
import { processMermaidDiagrams } from '../utils/mermaid';
import { useTheme } from '../hooks/useTheme';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface PreviewProps {
  content: string;
  className?: string;
}

// Enhanced markdown to HTML with math and mermaid support
const enhancedMarkdownToHtml = (markdown: string): string => {
  let html = markdown;

  // Process footnotes first ([^1] references and [^1]: definitions)
  const footnoteRefs: Array<{ id: string; text: string }> = [];
  const footnoteDefinitions: Record<string, string> = {};

  // Extract footnote definitions
  html = html.replace(/^\[\^([^\]]+)\]:\s*(.+)$/gm, (_match, id, definition) => {
    footnoteDefinitions[id] = definition.trim();
    return ''; // Remove from main content
  });

  // Replace footnote references
  html = html.replace(/\[\^([^\]]+)\]/g, (_match, id) => {
    if (footnoteDefinitions[id]) {
      footnoteRefs.push({ id, text: footnoteDefinitions[id] });
    }
    return `<sup class="footnote-ref" data-footnote="${id}"><a href="#fn-${id}">${id}</a></sup>`;
  });

  // Process math expressions (must be before other markdown processing)
  // Block math: $$...$$
  html = html.replace(/\$\$([\s\S]*?)\$\$/g, (_match, content) => {
    try {
      const rendered = katex.renderToString(content.trim(), {
        displayMode: true,
        throwOnError: false,
      });
      return `<div class="katex-display">${rendered}</div>`;
    } catch (error) {
      return `<div class="math-error">Error rendering math: ${content}</div>`;
    }
  });

  // Inline math: $...$
  html = html.replace(/\$([^$\n]+)\$/g, (_match, content) => {
    try {
      const rendered = katex.renderToString(content.trim(), {
        displayMode: false,
        throwOnError: false,
      });
      return rendered;
    } catch (error) {
      return `<span class="math-error">Error: ${content}</span>`;
    }
  });

  // Process mermaid code blocks
  html = html.replace(/```mermaid\n([\s\S]*?)```/g, (_match, code) => {
    return `<div class="mermaid-container" data-mermaid-code="${encodeURIComponent(code.trim())}">
      <div class="mermaid-rendered" data-processed="false"></div>
    </div>`;
  });

  // YouTube embeds
  html = html.replace(/https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/g, (_match, _www, _urlPart, videoId) => {
    return `<div class="embed-container">
      <div class="youtube-embed">
        <iframe src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>
      </div>
    </div>`;
  });

  // Generic link cards for other URLs (but not YouTube)
  html = html.replace(/^(https?:\/\/(?!.*youtube\.com|.*youtu\.be)[^\s]+)$/gm, (_match, url) => {
    const domain = new URL(url).hostname.replace('www.', '');
    return `<div class="embed-container">
      <a href="${url}" target="_blank" rel="noopener noreferrer" class="link-card">
        <div class="link-card-title">${url}</div>
        <div class="link-card-url">${domain}</div>
      </a>
    </div>`;
  });

  // Now process regular markdown
  html = markdownToHtml(html);

  // Add footnotes section if we have any
  if (footnoteRefs.length > 0) {
    const footnotesHtml = footnoteRefs
      .map(({ id, text }) => 
        `<div class="footnote-item" id="fn-${id}">
          <span class="footnote-number">${id}:</span>
          <span>${text}</span>
        </div>`
      )
      .join('');
    
    html += `<div class="footnotes">
      <hr />
      <h4>Footnotes</h4>
      ${footnotesHtml}
    </div>`;
  }

  return html;
};

const Preview: React.FC<PreviewProps> = ({ content, className }) => {
  const previewRef = useRef<HTMLDivElement>(null);
  const { isDark } = useTheme();

  useEffect(() => {
    // Process mermaid diagrams after content is rendered
    if (previewRef.current) {
      processMermaidDiagrams(previewRef.current, isDark);
    }
  }, [content, isDark]);

  const htmlContent = enhancedMarkdownToHtml(content);

  return (
    <div className={`preview ${className || ''}`}>
      <h4 style={{ 
        marginBottom: '15px', 
        color: 'var(--text-secondary)', 
        borderBottom: '1px solid var(--border)', 
        paddingBottom: '5px' 
      }}>
        Preview
      </h4>
      <div 
        ref={previewRef}
        dangerouslySetInnerHTML={{ __html: htmlContent }}
        style={{ 
          lineHeight: '1.6',
          fontSize: '16px'
        }}
      />
    </div>
  );
};

export default Preview;