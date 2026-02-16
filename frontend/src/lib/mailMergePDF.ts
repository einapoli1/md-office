/**
 * Mail Merge batch PDF/markdown generation engine.
 *
 * PDF generation uses a hidden iframe + window.print flow (browser-native).
 * Markdown generation produces individual .md files bundled in a ZIP.
 */

import { renderTemplate } from './templateEngine';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export interface MergeOutputOptions {
  /** 'individual' | 'combined' | 'markdown' | 'print' */
  mode: 'individual' | 'combined' | 'markdown' | 'print';
  /** Filename template, e.g. "Invoice_{name}_{date}" (no extension). Fallback: "document_{index}" */
  filenameTemplate?: string;
  /** Called with (completedCount, totalCount) */
  onProgress?: (done: number, total: number) => void;
}

/**
 * Resolve a filename template against a data row.
 * Supports {key} placeholders + {index} (1-based).
 */
export function resolveFilename(
  template: string,
  data: Record<string, string>,
  index: number,
): string {
  let name = template.replace(/\{(\w+)\}/g, (_, key: string) => {
    if (key === 'index') return String(index + 1);
    return data[key] ?? key;
  });
  // sanitise for filesystem
  name = name.replace(/[/\\?%*:|"<>]/g, '_').trim() || `document_${index + 1}`;
  return name;
}

/** Convert markdown text to simple HTML suitable for printing */
function mdToHtml(md: string): string {
  // Minimal markdown→HTML (headings, bold, italic, paragraphs, lists, hr)
  let html = md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^---$/gm, '<hr/>')
    .replace(/^- (.+)$/gm, '<li>$1</li>');

  // Wrap consecutive <li> in <ul>
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

  // Paragraphs: split on double newlines
  html = html
    .split(/\n{2,}/)
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      if (/^<[hulo]/.test(trimmed)) return trimmed;
      return `<p>${trimmed.replace(/\n/g, '<br/>')}</p>`;
    })
    .join('\n');

  return html;
}

function printPage(htmlBody: string): Promise<void> {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.left = '-9999px';
    iframe.style.width = '210mm';
    iframe.style.height = '297mm';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20mm; font-size: 12pt; line-height: 1.6; }
        @media print { .page-break { page-break-after: always; } }
      </style>
    </head><body>${htmlBody}</body></html>`);
    doc.close();

    iframe.contentWindow!.onafterprint = () => {
      document.body.removeChild(iframe);
      resolve();
    };

    // Small delay to let content render
    setTimeout(() => {
      iframe.contentWindow!.print();
      // Fallback cleanup if onafterprint doesn't fire
      setTimeout(() => {
        if (iframe.parentElement) {
          document.body.removeChild(iframe);
          resolve();
        }
      }, 3000);
    }, 200);
  });
}

/**
 * Run the mail merge batch generation.
 */
export async function generateMailMerge(
  template: string,
  rows: Record<string, string>[],
  options: MergeOutputOptions,
): Promise<void> {
  const { mode, filenameTemplate, onProgress } = options;
  const total = rows.length;

  if (mode === 'markdown') {
    const zip = new JSZip();
    rows.forEach((row, i) => {
      const rendered = renderTemplate(template, row);
      const fname = resolveFilename(filenameTemplate || 'document_{index}', row, i);
      zip.file(`${fname}.md`, rendered);
      onProgress?.(i + 1, total);
    });
    const blob = await zip.generateAsync({ type: 'blob' });
    saveAs(blob, 'mail_merge_output.zip');
    return;
  }

  if (mode === 'combined' || mode === 'print') {
    const pages = rows.map((row, i) => {
      const rendered = renderTemplate(template, row);
      onProgress?.(i + 1, total);
      return mdToHtml(rendered);
    });
    const combined = pages.join('<div class="page-break"></div>\n');
    await printPage(combined);
    return;
  }

  // individual – print each separately (browser will show print dialogs)
  for (let i = 0; i < rows.length; i++) {
    const rendered = renderTemplate(template, rows[i]);
    const html = mdToHtml(rendered);
    await printPage(html);
    onProgress?.(i + 1, total);
  }
}
