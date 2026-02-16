/**
 * PDF Import — extract text + basic layout from PDF and convert to HTML for TipTap.
 * Uses pdf.js for parsing.
 */

import * as pdfjsLib from 'pdfjs-dist';

// Configure worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface TextBlock {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontName: string;
  bold: boolean;
  italic: boolean;
}

interface PageResult {
  pageNum: number;
  width: number;
  height: number;
  blocks: TextBlock[];
}

/**
 * Extract text content from a PDF file, preserving basic structure.
 */
async function extractPages(file: File): Promise<PageResult[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: PageResult[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.0 });
    const textContent = await page.getTextContent();
    const blocks: TextBlock[] = [];

    for (const item of textContent.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      const tx = item.transform;
      const fontSize = Math.abs(tx[0]) || Math.abs(tx[3]) || 12;
      const fontName = ('fontName' in item ? item.fontName : '') as string;
      const bold = /bold/i.test(fontName);
      const italic = /italic|oblique/i.test(fontName);

      blocks.push({
        text: item.str,
        x: tx[4],
        y: viewport.height - tx[5], // flip Y
        width: item.width || 0,
        height: fontSize,
        fontSize,
        fontName,
        bold,
        italic,
      });
    }

    pages.push({
      pageNum: i,
      width: viewport.width,
      height: viewport.height,
      blocks,
    });
  }

  return pages;
}

/**
 * Group text blocks into lines based on Y proximity.
 */
function groupIntoLines(blocks: TextBlock[]): TextBlock[][] {
  if (blocks.length === 0) return [];

  // Sort by Y then X
  const sorted = [...blocks].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: TextBlock[][] = [];
  let currentLine: TextBlock[] = [sorted[0]];
  let currentY = sorted[0].y;

  for (let i = 1; i < sorted.length; i++) {
    const block = sorted[i];
    // Same line if Y difference is small relative to font size
    if (Math.abs(block.y - currentY) < block.fontSize * 0.5) {
      currentLine.push(block);
    } else {
      lines.push(currentLine);
      currentLine = [block];
      currentY = block.y;
    }
  }
  lines.push(currentLine);
  return lines;
}

/**
 * Detect if a line looks like a heading based on font size relative to body text.
 */
function detectHeadingLevel(fontSize: number, medianSize: number): number {
  const ratio = fontSize / medianSize;
  if (ratio >= 2.0) return 1;
  if (ratio >= 1.6) return 2;
  if (ratio >= 1.3) return 3;
  return 0;
}

/**
 * Convert pages to HTML.
 */
function pagesToHtml(pages: PageResult[]): string {
  // Compute median font size across all text
  const allSizes = pages.flatMap(p => p.blocks.map(b => b.fontSize));
  allSizes.sort((a, b) => a - b);
  const medianSize = allSizes.length > 0 ? allSizes[Math.floor(allSizes.length / 2)] : 12;

  const htmlParts: string[] = [];

  for (let pi = 0; pi < pages.length; pi++) {
    if (pi > 0) {
      htmlParts.push('<hr data-type="page-break" />');
    }

    const page = pages[pi];
    const lines = groupIntoLines(page.blocks);

    for (const line of lines) {
      // Sort blocks in line by X
      line.sort((a, b) => a.x - b.x);

      const lineText = line.map(b => {
        let text = escapeHtml(b.text);
        if (b.bold) text = `<strong>${text}</strong>`;
        if (b.italic) text = `<em>${text}</em>`;
        return text;
      }).join(' ');

      if (!lineText.trim()) continue;

      // Check heading
      const avgFontSize = line.reduce((s, b) => s + b.fontSize, 0) / line.length;
      const headingLevel = detectHeadingLevel(avgFontSize, medianSize);

      // Check if line is indented (potential list item)
      const looksLikeBullet = /^[•\-–—\*]\s/.test(line[0].text);

      if (headingLevel > 0 && headingLevel <= 6) {
        htmlParts.push(`<h${headingLevel}>${lineText}</h${headingLevel}>`);
      } else if (looksLikeBullet) {
        // Collect consecutive bullet lines
        htmlParts.push(`<p>${lineText}</p>`);
      } else {
        htmlParts.push(`<p>${lineText}</p>`);
      }
    }
  }

  return htmlParts.join('\n');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Import a PDF file and return HTML suitable for TipTap editor.
 */
export async function importPdf(file: File): Promise<string> {
  const pages = await extractPages(file);
  return pagesToHtml(pages);
}
