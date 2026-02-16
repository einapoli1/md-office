import mammoth from 'mammoth';
import JSZip from 'jszip';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  LevelFormat,
  convertInchesToTwip,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ImageRun,
  PageBreak,
  Header,
  Footer,
  ShadingType,
  TableLayoutType,
} from 'docx';

/* ================================================================== */
/*  IMPORT: .docx → HTML (enhanced with direct XML parsing)           */
/* ================================================================== */

/**
 * Extract embedded images from DOCX zip so mammoth can reference them.
 */
async function extractImages(zip: JSZip): Promise<Map<string, { src: string; contentType: string }>> {
  const images = new Map<string, { src: string; contentType: string }>();
  const relsFile = zip.file('word/_rels/document.xml.rels');
  if (!relsFile) return images;
  const relsXml = await relsFile.async('text');
  const parser = new DOMParser();
  const relsDoc = parser.parseFromString(relsXml, 'text/xml');
  const rels = relsDoc.querySelectorAll('Relationship');

  for (const rel of Array.from(rels)) {
    const id = rel.getAttribute('Id') || '';
    const target = rel.getAttribute('Target') || '';
    const type = rel.getAttribute('Type') || '';
    if (type.includes('/image')) {
      const path = target.startsWith('/') ? target.slice(1) : `word/${target}`;
      const imgFile = zip.file(path);
      if (imgFile) {
        const data = await imgFile.async('uint8array');
        const ext = path.split('.').pop()?.toLowerCase() || 'png';
        const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
                     ext === 'gif' ? 'image/gif' :
                     ext === 'svg' ? 'image/svg+xml' : 'image/png';
        const blob = new Blob([data as BlobPart], { type: mime });
        const src = URL.createObjectURL(blob);
        images.set(id, { src, contentType: mime });
      }
    }
  }
  return images;
}

/**
 * Enhanced DOCX import: preserves images, tables, styles better than plain mammoth.
 */
export async function importDocx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  // Pre-extract images for potential future use
  await extractImages(zip);

  // Convert images for mammoth
  const convertImage = mammoth.images.imgElement((image: any) => {
    return image.read('base64').then((base64: string) => {
      const contentType = image.contentType || 'image/png';
      return { src: `data:${contentType};base64,${base64}` };
    });
  });

  const result = await mammoth.convertToHtml({
    arrayBuffer,
    convertImage,
    styleMap: [
      "p[style-name='Heading 1'] => h1:fresh",
      "p[style-name='Heading 2'] => h2:fresh",
      "p[style-name='Heading 3'] => h3:fresh",
      "p[style-name='Heading 4'] => h4:fresh",
      "p[style-name='Heading 5'] => h5:fresh",
      "p[style-name='Heading 6'] => h6:fresh",
      "p[style-name='Title'] => h1.title:fresh",
      "p[style-name='Subtitle'] => h2.subtitle:fresh",
      "p[style-name='Quote'] => blockquote:fresh",
      "p[style-name='Intense Quote'] => blockquote.intense:fresh",
      "r[style-name='Strong'] => strong",
      "r[style-name='Emphasis'] => em",
    ],
  } as any);
  let html = result.value;

  // Post-process: add page break markers
  html = html.replace(/<br\s*\/?>\s*<br\s*\/?>/g, '<hr data-type="page-break" />');

  return html;
}

/* ================================================================== */
/*  EXPORT: HTML → .docx via the `docx` npm package (enhanced)        */
/* ================================================================== */

interface ParsedRun {
  text: string;
  bold?: boolean;
  italics?: boolean;
  underline?: boolean;
  strike?: boolean;
  superScript?: boolean;
  subScript?: boolean;
  font?: string;
  color?: string;
  size?: number;
  highlight?: string;
}

function parseInlineNodes(node: Node): ParsedRun[] {
  const runs: ParsedRun[] = [];

  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent || '';
      if (text) runs.push({ text });
      return;
    }

    if (child.nodeType !== Node.ELEMENT_NODE) return;
    const el = child as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (tag === 'br') {
      runs.push({ text: '\n' });
      return;
    }

    const inner = parseInlineNodes(el);

    const applyFormat = (r: ParsedRun): ParsedRun => {
      const out = { ...r };
      if (tag === 'strong' || tag === 'b') out.bold = true;
      if (tag === 'em' || tag === 'i') out.italics = true;
      if (tag === 'u') out.underline = true;
      if (tag === 's' || tag === 'del') out.strike = true;
      if (tag === 'sup') out.superScript = true;
      if (tag === 'sub') out.subScript = true;
      if (tag === 'code') out.font = 'Courier New';
      if (tag === 'mark') out.highlight = 'yellow';
      if (el.style?.color) out.color = el.style.color.replace('#', '');
      if (el.style?.fontFamily) out.font = el.style.fontFamily.replace(/['"]/g, '');
      if (el.style?.fontSize) {
        const px = parseFloat(el.style.fontSize);
        if (!isNaN(px)) out.size = Math.round(px * 1.5); // px to half-points approx
      }
      if (el.style?.backgroundColor) out.highlight = 'yellow';
      return out;
    };

    inner.forEach((r) => runs.push(applyFormat(r)));
  });

  return runs;
}

function makeTextRuns(runs: ParsedRun[]): TextRun[] {
  return runs.map(
    (r) =>
      new TextRun({
        text: r.text,
        bold: r.bold,
        italics: r.italics,
        underline: r.underline ? {} : undefined,
        strike: r.strike,
        superScript: r.superScript,
        subScript: r.subScript,
        font: r.font ? { name: r.font } : undefined,
        color: r.color,
        size: r.size,
        highlight: r.highlight as any,
      }),
  );
}

function getAlignment(el: HTMLElement): (typeof AlignmentType)[keyof typeof AlignmentType] | undefined {
  const ta = el.style?.textAlign;
  if (ta === 'center') return AlignmentType.CENTER;
  if (ta === 'right') return AlignmentType.RIGHT;
  if (ta === 'justify') return AlignmentType.JUSTIFIED;
  return undefined;
}

const HEADING_MAP: Record<string, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  h1: HeadingLevel.HEADING_1,
  h2: HeadingLevel.HEADING_2,
  h3: HeadingLevel.HEADING_3,
  h4: HeadingLevel.HEADING_4,
  h5: HeadingLevel.HEADING_5,
  h6: HeadingLevel.HEADING_6,
};

async function tryImageRun(el: HTMLElement): Promise<ImageRun | null> {
  const img = el.tagName.toLowerCase() === 'img' ? el as HTMLImageElement : el.querySelector('img');
  if (!img) return null;
  const src = img.getAttribute('src') || '';
  if (!src) return null;

  try {
    let buf: ArrayBuffer;
    if (src.startsWith('data:')) {
      const resp = await fetch(src);
      buf = await resp.arrayBuffer();
    } else if (src.startsWith('blob:')) {
      const resp = await fetch(src);
      buf = await resp.arrayBuffer();
    } else {
      return null; // Skip external URLs
    }
    const w = img.width || img.naturalWidth || 300;
    const h = img.height || img.naturalHeight || 200;
    return new ImageRun({ data: new Uint8Array(buf), transformation: { width: w, height: h }, type: 'png' });
  } catch {
    return null;
  }
}

function collectListItems(
  el: HTMLElement,
  ordered: boolean,
  level: number,
  result: Paragraph[],
) {
  el.querySelectorAll(':scope > li').forEach((li) => {
    const runs = parseInlineNodes(li);
    result.push(
      new Paragraph({
        children: makeTextRuns(runs.length ? runs : [{ text: li.textContent || '' }]),
        numbering: { reference: ordered ? 'ordered-list' : 'bullet-list', level },
      }),
    );
    li.querySelectorAll(':scope > ul, :scope > ol').forEach((nested) => {
      collectListItems(nested as HTMLElement, nested.tagName.toLowerCase() === 'ol', level + 1, result);
    });
  });
}

function parseCSSColor(color: string): string | undefined {
  if (!color) return undefined;
  if (color.startsWith('#')) return color.replace('#', '');
  if (color.startsWith('rgb')) {
    const m = color.match(/\d+/g);
    if (m && m.length >= 3) {
      return m.slice(0, 3).map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
    }
  }
  return undefined;
}

function parseTable(tableEl: HTMLElement): Table {
  const rows: TableRow[] = [];
  tableEl.querySelectorAll('tr').forEach((tr) => {
    const cells: TableCell[] = [];
    tr.querySelectorAll('th, td').forEach((td) => {
      const cellEl = td as HTMLElement;
      const colspan = parseInt(cellEl.getAttribute('colspan') || '1');
      const rowspan = parseInt(cellEl.getAttribute('rowspan') || '1');

      // Cell shading
      const bgColor = parseCSSColor(cellEl.style?.backgroundColor || '');
      let shading: { type: typeof ShadingType.CLEAR; fill: string } | undefined;
      if (bgColor) {
        shading = { type: ShadingType.CLEAR, fill: bgColor };
      }
      if (td.tagName.toLowerCase() === 'th' && !shading) {
        shading = { type: ShadingType.CLEAR, fill: 'D9E2F3' };
      }

      // Cell borders
      const borderStyle = cellEl.style?.border || cellEl.style?.borderWidth;
      const borders = borderStyle ? {
        top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
        left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
        right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      } : undefined;

      cells.push(new TableCell({
        children: [new Paragraph({ children: makeTextRuns(parseInlineNodes(td)) })],
        width: { size: 100, type: WidthType.AUTO },
        columnSpan: colspan > 1 ? colspan : undefined,
        rowSpan: rowspan > 1 ? rowspan : undefined,
        shading,
        borders,
      }));
    });
    if (cells.length) rows.push(new TableRow({ children: cells }));
  });

  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.AUTOFIT,
  });
}

async function htmlToDocxChildren(container: HTMLElement): Promise<(Paragraph | Table)[]> {
  const children: (Paragraph | Table)[] = [];

  for (let i = 0; i < container.children.length; i++) {
    const el = container.children[i] as HTMLElement;
    const tag = el.tagName.toLowerCase();

    // Page break
    if (tag === 'hr' || (tag === 'div' && el.dataset.type === 'page-break')) {
      children.push(
        new Paragraph({
          children: [new PageBreak()],
        }),
      );
      continue;
    }

    // Headings
    if (HEADING_MAP[tag]) {
      children.push(
        new Paragraph({
          children: makeTextRuns(parseInlineNodes(el)),
          heading: HEADING_MAP[tag],
          alignment: getAlignment(el),
        }),
      );
      continue;
    }

    // Paragraph
    if (tag === 'p') {
      const imgRun = await tryImageRun(el);
      if (imgRun) {
        children.push(new Paragraph({ children: [imgRun] }));
      } else {
        const runs = parseInlineNodes(el);
        children.push(
          new Paragraph({
            children: makeTextRuns(runs),
            alignment: getAlignment(el),
          }),
        );
      }
      continue;
    }

    // Lists
    if (tag === 'ul' || tag === 'ol') {
      const paragraphs: Paragraph[] = [];
      collectListItems(el, tag === 'ol', 0, paragraphs);
      children.push(...paragraphs);
      continue;
    }

    // Table
    if (tag === 'table') {
      children.push(parseTable(el));
      continue;
    }

    // Blockquote
    if (tag === 'blockquote') {
      const inner = await htmlToDocxChildren(el);
      for (const p of inner) {
        if (p instanceof Paragraph) {
          children.push(
            new Paragraph({
              children: makeTextRuns(parseInlineNodes(el)),
              indent: { left: convertInchesToTwip(0.5) },
              style: 'Quote',
            }),
          );
        } else {
          children.push(p);
        }
      }
      continue;
    }

    // Pre / code blocks
    if (tag === 'pre') {
      const text = el.textContent || '';
      text.split('\n').forEach((line) => {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: line, font: { name: 'Courier New' }, size: 20 })],
            shading: { type: ShadingType.CLEAR, fill: 'F5F5F5' },
          }),
        );
      });
      continue;
    }

    // HR (page breaks)
    if (tag === 'hr') {
      children.push(
        new Paragraph({
          children: [new PageBreak()],
        }),
      );
      continue;
    }

    // Images at top level
    if (tag === 'img') {
      const imgRun = await tryImageRun(el);
      if (imgRun) children.push(new Paragraph({ children: [imgRun] }));
      continue;
    }

    // Div containers - recurse
    if (tag === 'div' || tag === 'section' || tag === 'article') {
      const innerChildren = await htmlToDocxChildren(el);
      children.push(...innerChildren);
      continue;
    }

    // Fallback: treat as paragraph
    const runs = parseInlineNodes(el);
    if (runs.length) {
      children.push(new Paragraph({ children: makeTextRuns(runs) }));
    }
  }

  return children;
}

export interface DocxExportOptions {
  title?: string;
  headerText?: string;
  footerText?: string;
}

/**
 * Export editor HTML to a .docx Blob with enhanced fidelity.
 */
export async function exportDocx(html: string, title: string, options?: DocxExportOptions): Promise<Blob> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<body>${html}</body>`, 'text/html');
  const body = doc.body;

  const docxChildren = await htmlToDocxChildren(body);

  if (docxChildren.length === 0) {
    docxChildren.push(new Paragraph({ children: [new TextRun('')] }));
  }

  const headerText = options?.headerText || '';
  const footerText = options?.footerText || '';

  const document = new Document({
    title: options?.title || title,
    styles: {
      paragraphStyles: [
        {
          id: 'Quote',
          name: 'Quote',
          basedOn: 'Normal',
          next: 'Normal',
          run: { italics: true, color: '404040' },
          paragraph: { indent: { left: convertInchesToTwip(0.5) } },
        },
      ],
    },
    numbering: {
      config: [
        {
          reference: 'bullet-list',
          levels: [
            { level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.25) } } } },
            { level: 1, format: LevelFormat.BULLET, text: '\u25E6', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: convertInchesToTwip(1), hanging: convertInchesToTwip(0.25) } } } },
            { level: 2, format: LevelFormat.BULLET, text: '\u25AA', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: convertInchesToTwip(1.5), hanging: convertInchesToTwip(0.25) } } } },
          ],
        },
        {
          reference: 'ordered-list',
          levels: [
            { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.25) } } } },
            { level: 1, format: LevelFormat.LOWER_LETTER, text: '%2.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: convertInchesToTwip(1), hanging: convertInchesToTwip(0.25) } } } },
            { level: 2, format: LevelFormat.LOWER_ROMAN, text: '%3.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: convertInchesToTwip(1.5), hanging: convertInchesToTwip(0.25) } } } },
          ],
        },
      ],
    },
    sections: [
      {
        headers: headerText ? {
          default: new Header({
            children: [new Paragraph({ children: [new TextRun({ text: headerText, size: 18, color: '888888' })] })],
          }),
        } : undefined,
        footers: footerText ? {
          default: new Footer({
            children: [new Paragraph({
              children: [new TextRun({ text: footerText, size: 18, color: '888888' })],
              alignment: AlignmentType.CENTER,
            })],
          }),
        } : undefined,
        children: docxChildren,
      },
    ],
  });

  return Packer.toBlob(document);
}
