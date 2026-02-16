import mammoth from 'mammoth';
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
} from 'docx';

/**
 * Import a .docx file and return HTML suitable for TipTap.
 */
export async function importDocx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });
  return result.value;
}

/* ------------------------------------------------------------------ */
/*  Export: HTML → docx via the `docx` npm package                     */
/* ------------------------------------------------------------------ */

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
  size?: number; // half-points
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

    // Recurse and apply formatting
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
      // Inline styles
      if (el.style?.color) out.color = el.style.color.replace('#', '');
      if (el.style?.fontFamily) out.font = el.style.fontFamily.replace(/['"]/g, '');
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
  if (!src.startsWith('data:')) return null; // only base64
  try {
    const resp = await fetch(src);
    const buf = await resp.arrayBuffer();
    const w = img.width || 300;
    const h = img.height || 200;
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
    // Filter out nested list text that will be handled recursively
    result.push(
      new Paragraph({
        children: makeTextRuns(runs.length ? runs : [{ text: li.textContent || '' }]),
        numbering: { reference: ordered ? 'ordered-list' : 'bullet-list', level },
      }),
    );
    // Handle nested lists
    li.querySelectorAll(':scope > ul, :scope > ol').forEach((nested) => {
      collectListItems(nested as HTMLElement, nested.tagName.toLowerCase() === 'ol', level + 1, result);
    });
  });
}

function parseTable(tableEl: HTMLElement): Table {
  const rows: TableRow[] = [];
  tableEl.querySelectorAll('tr').forEach((tr) => {
    const cells: TableCell[] = [];
    tr.querySelectorAll('th, td').forEach((td) => {
      cells.push(
        new TableCell({
          children: [new Paragraph({ children: makeTextRuns(parseInlineNodes(td)) })],
          width: { size: 100, type: WidthType.AUTO },
        }),
      );
    });
    if (cells.length) rows.push(new TableRow({ children: cells }));
  });
  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

async function htmlToDocxChildren(container: HTMLElement): Promise<(Paragraph | Table)[]> {
  const children: (Paragraph | Table)[] = [];

  for (let i = 0; i < container.children.length; i++) {
    const el = container.children[i] as HTMLElement;
    const tag = el.tagName.toLowerCase();

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
      inner.forEach((p) => {
        if (p instanceof Paragraph) {
          children.push(
            new Paragraph({
              children: makeTextRuns(parseInlineNodes(el)),
              indent: { left: convertInchesToTwip(0.5) },
            }),
          );
        } else {
          children.push(p);
        }
      });
      continue;
    }

    // Pre / code blocks
    if (tag === 'pre') {
      const text = el.textContent || '';
      text.split('\n').forEach((line) => {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: line, font: { name: 'Courier New' }, size: 20 })],
          }),
        );
      });
      continue;
    }

    // HR
    if (tag === 'hr') {
      children.push(
        new Paragraph({
          children: [],
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'auto' } },
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

    // Fallback: treat as paragraph
    const runs = parseInlineNodes(el);
    if (runs.length) {
      children.push(new Paragraph({ children: makeTextRuns(runs) }));
    }
  }

  return children;
}

/**
 * Export editor HTML to a .docx Blob.
 */
export async function exportDocx(html: string, title: string): Promise<Blob> {
  // Parse HTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<body>${html}</body>`, 'text/html');
  const body = doc.body;

  const docxChildren = await htmlToDocxChildren(body);

  // Ensure at least one paragraph
  if (docxChildren.length === 0) {
    docxChildren.push(new Paragraph({ children: [new TextRun('')] }));
  }

  const document = new Document({
    title,
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
        children: docxChildren,
      },
    ],
  });

  return Packer.toBlob(document);
}
