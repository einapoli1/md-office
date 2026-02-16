// Slides export: PDF (print), standalone HTML, and PPTX
import PptxGenJS from 'pptxgenjs';
import JSZip from 'jszip';
import { Slide, SlideLayout, genSlideId } from './slideModel';
import { SlideTheme } from './slideThemes';

// ─── PDF Export via print ───

export function exportSlidesPDF() {
  window.print();
}

// ─── Standalone HTML Export ───

export function exportSlidesHTML(slides: Slide[], theme: SlideTheme): string {
  const slidesHtml = slides.map((slide, i) => {
    const layoutClass = slide.layout || 'content';
    // Simple markdown-to-HTML (handles # headings, **bold**, *italic*, - lists, ![img], newlines)
    const html = simpleMarkdownToHTML(slide.content);
    return `<div class="slide ${layoutClass}" data-index="${i}">${html}</div>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Presentation</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 100%; height: 100%; overflow: hidden; font-family: ${theme.vars['--slide-body-font'] || "'Segoe UI', Arial, sans-serif"}; }
.slide {
  width: 100vw; height: 100vh;
  display: none; flex-direction: column; justify-content: center; align-items: center;
  padding: 60px 80px;
  background: ${theme.vars['--slide-bg'] || '#ffffff'};
  color: ${theme.vars['--slide-text'] || '#202124'};
}
.slide.active { display: flex; }
.slide h1 { font-size: 3em; margin-bottom: 0.3em; }
.slide h2 { font-size: 2em; margin-bottom: 0.3em; opacity: 0.8; }
.slide h3 { font-size: 1.5em; margin-bottom: 0.3em; }
.slide p { font-size: 1.3em; margin: 0.3em 0; line-height: 1.6; }
.slide ul, .slide ol { font-size: 1.3em; margin: 0.5em 0; padding-left: 1.5em; text-align: left; }
.slide li { margin: 0.3em 0; line-height: 1.5; }
.slide img { max-width: 80%; max-height: 60vh; border-radius: 8px; }
.slide code { background: rgba(0,0,0,0.08); padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
.slide pre { background: rgba(0,0,0,0.06); padding: 16px; border-radius: 8px; text-align: left; width: 80%; overflow-x: auto; }
.slide.title { text-align: center; }
.slide.section { text-align: center; }
.slide.content { align-items: flex-start; }

.controls {
  position: fixed; bottom: 20px; right: 20px; z-index: 100;
  display: flex; gap: 8px; opacity: 0; transition: opacity 0.3s;
}
body:hover .controls { opacity: 1; }
.controls button {
  background: rgba(0,0,0,0.5); color: #fff; border: none; padding: 8px 16px;
  border-radius: 4px; cursor: pointer; font-size: 16px;
}
.controls button:hover { background: rgba(0,0,0,0.7); }
.slide-counter {
  position: fixed; bottom: 20px; left: 20px; z-index: 100;
  color: rgba(128,128,128,0.6); font-size: 14px;
}
</style>
</head>
<body>
${slidesHtml}
<div class="controls">
  <button onclick="prev()">◀</button>
  <button onclick="next()">▶</button>
</div>
<div class="slide-counter" id="counter"></div>
<script>
let current = 0;
const slides = document.querySelectorAll('.slide');
function show(i) {
  current = Math.max(0, Math.min(slides.length - 1, i));
  slides.forEach((s, idx) => s.classList.toggle('active', idx === current));
  document.getElementById('counter').textContent = (current + 1) + ' / ' + slides.length;
}
function next() { show(current + 1); }
function prev() { show(current - 1); }
document.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') { e.preventDefault(); next(); }
  if (e.key === 'ArrowLeft' || e.key === 'Backspace') { e.preventDefault(); prev(); }
  if (e.key === 'Escape') { /* could exit fullscreen */ }
  if (e.key === 'Home') show(0);
  if (e.key === 'End') show(slides.length - 1);
});
show(0);
</script>
</body>
</html>`;
}

function simpleMarkdownToHTML(md: string): string {
  // Strip layout comments
  let text = md.replace(/<!--\s*slide:\s*\S+\s*-->/g, '').trim();
  // Fragment comments
  text = text.replace(/<!--\s*fragment(?:\s*:\s*\S+)?\s*-->/g, '');

  const lines = text.split('\n');
  const out: string[] = [];
  let inList = false;
  let inCode = false;

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCode) { out.push('</code></pre>'); inCode = false; }
      else { out.push('<pre><code>'); inCode = true; }
      continue;
    }
    if (inCode) { out.push(escapeHtml(line)); continue; }

    const trimmed = line.trim();
    if (!trimmed) {
      if (inList) { out.push('</ul>'); inList = false; }
      continue;
    }

    // Headings
    const hMatch = trimmed.match(/^(#{1,6})\s+(.+)/);
    if (hMatch) {
      if (inList) { out.push('</ul>'); inList = false; }
      const level = hMatch[1].length;
      out.push(`<h${level}>${inlineFormat(hMatch[2])}</h${level}>`);
      continue;
    }

    // List items
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || /^\d+\.\s/.test(trimmed)) {
      if (!inList) { out.push('<ul>'); inList = true; }
      const content = trimmed.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '');
      out.push(`<li>${inlineFormat(content)}</li>`);
      continue;
    }

    // Images
    const imgMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
    if (imgMatch) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<img src="${escapeHtml(imgMatch[2])}" alt="${escapeHtml(imgMatch[1])}" />`);
      continue;
    }

    // Paragraph
    if (inList) { out.push('</ul>'); inList = false; }
    out.push(`<p>${inlineFormat(trimmed)}</p>`);
  }
  if (inList) out.push('</ul>');
  if (inCode) out.push('</code></pre>');

  return out.join('\n');
}

function inlineFormat(text: string): string {
  let s = escapeHtml(text);
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
  s = s.replace(/`(.+?)`/g, '<code>$1</code>');
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return s;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── PPTX Export ───

/** Convert hex color (#RRGGBB) to PPTX color string (RRGGBB) */
function toPptxColor(hex: string): string {
  return hex.replace(/^#/, '');
}

/** Strip markdown formatting, return plain text */
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<!--[^>]*-->/g, '')
    .trim();
}

/** Parse markdown content into structured elements for PPTX */
function parseContentElements(content: string): Array<{
  type: 'heading' | 'bullet' | 'image' | 'text';
  text?: string;
  level?: number;
  bold?: boolean;
  src?: string;
  alt?: string;
}> {
  const elements: Array<{
    type: 'heading' | 'bullet' | 'image' | 'text';
    text?: string;
    level?: number;
    bold?: boolean;
    src?: string;
    alt?: string;
  }> = [];
  const lines = content.replace(/<!--[^>]*-->/g, '').split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const hMatch = trimmed.match(/^(#{1,6})\s+(.+)/);
    if (hMatch) {
      elements.push({ type: 'heading', text: stripMarkdown(hMatch[2]), level: hMatch[1].length });
      continue;
    }

    const imgMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
    if (imgMatch) {
      elements.push({ type: 'image', alt: imgMatch[1], src: imgMatch[2] });
      continue;
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || /^\d+\.\s/.test(trimmed)) {
      const text = trimmed.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '');
      elements.push({ type: 'bullet', text: stripMarkdown(text) });
      continue;
    }

    elements.push({ type: 'text', text: stripMarkdown(trimmed) });
  }
  return elements;
}

export async function exportPPTX(slides: Slide[], theme: SlideTheme): Promise<void> {
  const pptx = new PptxGenJS();

  // Apply theme
  const bgColor = toPptxColor(theme.vars['--slide-bg'] || '#ffffff');
  const textColor = toPptxColor(theme.vars['--slide-text'] || '#202124');
  const accentColor = toPptxColor(theme.vars['--slide-accent'] || '#4285f4');
  const bodyFont = (theme.vars['--slide-body-font'] || 'Arial').replace(/'/g, '').split(',')[0].trim();
  const headingFont = (theme.vars['--slide-heading-font'] || bodyFont).replace(/'/g, '').split(',')[0].trim();

  pptx.layout = 'LAYOUT_WIDE';

  for (const slide of slides) {
    const pptSlide = pptx.addSlide();
    pptSlide.background = { color: bgColor };

    const elements = parseContentElements(slide.content);
    let yPos = 0.5;

    for (const el of elements) {
      switch (el.type) {
        case 'heading': {
          const fontSize = el.level === 1 ? 36 : el.level === 2 ? 28 : 22;
          const color = el.level === 1 ? textColor : accentColor;
          pptSlide.addText(el.text || '', {
            x: 0.5, y: yPos, w: '90%', h: 0.8,
            fontSize, fontFace: headingFont, color, bold: true,
          });
          yPos += 1.0;
          break;
        }
        case 'bullet': {
          pptSlide.addText(el.text || '', {
            x: 0.8, y: yPos, w: '85%', h: 0.5,
            fontSize: 18, fontFace: bodyFont, color: textColor,
            bullet: true,
          });
          yPos += 0.5;
          break;
        }
        case 'image': {
          if (el.src && (el.src.startsWith('http') || el.src.startsWith('data:'))) {
            try {
              pptSlide.addImage({
                path: el.src, x: 1, y: yPos, w: 5, h: 3,
              });
              yPos += 3.3;
            } catch {
              // Skip images that fail to load
            }
          }
          break;
        }
        case 'text': {
          pptSlide.addText(el.text || '', {
            x: 0.5, y: yPos, w: '90%', h: 0.5,
            fontSize: 18, fontFace: bodyFont, color: textColor,
          });
          yPos += 0.6;
          break;
        }
      }
    }

    // Add shapes
    for (const shape of slide.shapes) {
      const shapeMap: Record<string, string> = {
        'rectangle': 'rect',
        'rounded-rectangle': 'roundRect',
        'circle': 'ellipse',
        'ellipse': 'ellipse',
        'triangle': 'triangle',
        'diamond': 'diamond',
        'star': 'star5',
        'line': 'line',
      };
      const pptxShapeName = shapeMap[shape.type] || 'rect';
      // Convert pixel positions to inches (assuming 96dpi slide canvas ~960x540)
      const xIn = (shape.x / 960) * 13.33;
      const yIn = (shape.y / 540) * 7.5;
      const wIn = (shape.width / 960) * 13.33;
      const hIn = (shape.height / 540) * 7.5;

      const shapeOpts: Record<string, unknown> = {
        x: xIn, y: yIn, w: wIn, h: hIn,
        fill: { color: toPptxColor(shape.fill || '#4285f4') },
        line: { color: toPptxColor(shape.stroke || '#000000'), width: shape.strokeWidth || 1 },
      };

      // Use pptxgenjs shape types
      const pptxShape = (PptxGenJS.ShapeType as Record<string, unknown>)[pptxShapeName];
      if (pptxShape) {
        if (shape.text) {
          pptSlide.addText(shape.text, { shape: pptxShape as PptxGenJS.ShapeType, ...shapeOpts } as PptxGenJS.TextPropsOptions);
        } else {
          pptSlide.addShape(pptxShape as PptxGenJS.ShapeType, shapeOpts as PptxGenJS.ShapeProps);
        }
      }
    }

    // Add speaker notes
    if (slide.notes) {
      pptSlide.addNotes(slide.notes);
    }
  }

  await pptx.writeFile({ fileName: 'presentation.pptx' });
}

// ─── PPTX Import ───

/** Extract text from PPTX XML text runs */
function extractTextFromXml(xml: string): Array<{ text: string; bold: boolean; italic: boolean; fontSize?: number }> {
  const runs: Array<{ text: string; bold: boolean; italic: boolean; fontSize?: number }> = [];
  // Match <a:r> runs
  const runRegex = /<a:r>([\s\S]*?)<\/a:r>/g;
  let runMatch: RegExpExecArray | null;
  while ((runMatch = runRegex.exec(xml)) !== null) {
    const runXml = runMatch[1];
    const textMatch = runXml.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/);
    if (!textMatch) continue;
    const text = textMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
    const bold = /<a:rPr[^>]*\bb="1"/.test(runXml);
    const italic = /<a:rPr[^>]*\bi="1"/.test(runXml);
    const szMatch = runXml.match(/<a:rPr[^>]*\bsz="(\d+)"/);
    const fontSize = szMatch ? parseInt(szMatch[1]) / 100 : undefined;
    runs.push({ text, bold, italic, fontSize });
  }
  return runs;
}

/** Determine layout from PPTX slide XML */
function detectPptxLayout(xml: string): SlideLayout {
  // Check for common placeholder types
  if (/<p:ph[^>]*type="ctrTitle"/.test(xml) || /<p:ph[^>]*type="title"/.test(xml)) {
    if (/<p:ph[^>]*type="subTitle"/.test(xml)) return 'title';
  }
  if (/<p:ph[^>]*type="sldImg"/.test(xml)) return 'image';
  return 'content';
}

/** Convert text runs to markdown */
function runsToMarkdown(runs: Array<{ text: string; bold: boolean; italic: boolean; fontSize?: number }>): string {
  return runs.map(r => {
    let t = r.text;
    if (r.bold) t = `**${t}**`;
    if (r.italic) t = `*${t}*`;
    return t;
  }).join('');
}

export async function importPPTX(file: File): Promise<Slide[]> {
  const zip = await JSZip.loadAsync(file);
  const slides: Slide[] = [];
  const mediaFiles: Record<string, string> = {};

  // Extract media files as data URIs
  const mediaFolder = zip.folder('ppt/media');
  if (mediaFolder) {
    const mediaEntries: string[] = [];
    mediaFolder.forEach((path) => { mediaEntries.push(path); });
    for (const path of mediaEntries) {
      const mediaFile = zip.file(`ppt/media/${path}`);
      if (mediaFile) {
        const blob = await mediaFile.async('base64');
        const ext = path.split('.').pop()?.toLowerCase() || 'png';
        const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'gif' ? 'image/gif' : 'image/png';
        mediaFiles[path] = `data:${mime};base64,${blob}`;
      }
    }
  }

  // Find slide files
  const slideFiles: string[] = [];
  zip.forEach((path) => {
    if (/^ppt\/slides\/slide\d+\.xml$/.test(path)) {
      slideFiles.push(path);
    }
  });

  // Sort by slide number
  slideFiles.sort((a, b) => {
    const numA = parseInt(a.match(/slide(\d+)/)?.[1] || '0');
    const numB = parseInt(b.match(/slide(\d+)/)?.[1] || '0');
    return numA - numB;
  });

  for (const slidePath of slideFiles) {
    const xmlFile = zip.file(slidePath);
    if (!xmlFile) continue;
    const xml = await xmlFile.async('text');

    const layout = detectPptxLayout(xml);
    const contentParts: string[] = [];
    let notes = '';

    // Parse text shapes (sp elements with txBody)
    const spRegex = /<p:sp>([\s\S]*?)<\/p:sp>/g;
    let spMatch: RegExpExecArray | null;

    while ((spMatch = spRegex.exec(xml)) !== null) {
      const spXml = spMatch[1];

      // Check for placeholder type
      const phMatch = spXml.match(/<p:ph[^>]*type="([^"]*)"/);
      const phType = phMatch ? phMatch[1] : null;

      // Extract paragraphs
      const paraRegex = /<a:p>([\s\S]*?)<\/a:p>/g;
      let paraMatch: RegExpExecArray | null;
      const paragraphs: string[] = [];

      while ((paraMatch = paraRegex.exec(spXml)) !== null) {
        const paraXml = paraMatch[1];
        const properRuns = extractTextFromXml(paraXml);
        if (properRuns.length === 0) continue;

        const text = runsToMarkdown(properRuns);
        if (!text.trim()) continue;

        // Check if bulleted
        const isBullet = /<a:buChar/.test(paraXml) || /<a:buAutoNum/.test(paraXml) || /<a:buNone/.test(paraXml) === false && /<a:pPr[^>]*lvl="/.test(paraXml);

        if (phType === 'ctrTitle' || phType === 'title') {
          paragraphs.push(`# ${text}`);
        } else if (phType === 'subTitle') {
          paragraphs.push(`## ${text}`);
        } else if (isBullet) {
          paragraphs.push(`- ${text}`);
        } else if (properRuns[0]?.fontSize && properRuns[0].fontSize >= 24) {
          paragraphs.push(`# ${text}`);
        } else if (properRuns[0]?.fontSize && properRuns[0].fontSize >= 20) {
          paragraphs.push(`## ${text}`);
        } else {
          paragraphs.push(text);
        }
      }

      if (paragraphs.length > 0) {
        contentParts.push(paragraphs.join('\n'));
      }
    }

    // Parse images (pic elements)
    const picRegex = /<p:pic>([\s\S]*?)<\/p:pic>/g;
    let picMatch: RegExpExecArray | null;
    while ((picMatch = picRegex.exec(xml)) !== null) {
      const picXml = picMatch[1];
      // Get the relationship ID for the image
      const embedMatch = picXml.match(/r:embed="([^"]*)"/);
      if (embedMatch) {
        const rId = embedMatch[1];
        // Parse relationships to find the image file
        const slideNum = slidePath.match(/slide(\d+)/)?.[1];
        const relsPath = `ppt/slides/_rels/slide${slideNum}.xml.rels`;
        const relsFile = zip.file(relsPath);
        if (relsFile) {
          const relsXml = await relsFile.async('text');
          const relRegex = new RegExp(`Id="${rId}"[^>]*Target="([^"]*)"`, 'i');
          const relMatch = relsXml.match(relRegex);
          if (relMatch) {
            const target = relMatch[1].replace('../', '');
            const mediaName = target.split('/').pop() || '';
            if (mediaFiles[mediaName]) {
              contentParts.push(`![${mediaName}](${mediaFiles[mediaName]})`);
            }
          }
        }
      }
    }

    // Try to extract notes
    const slideNum = slidePath.match(/slide(\d+)/)?.[1];
    const notesPath = `ppt/notesSlides/notesSlide${slideNum}.xml`;
    const notesFile = zip.file(notesPath);
    if (notesFile) {
      const notesXml = await notesFile.async('text');
      const notesRuns = extractTextFromXml(notesXml);
      const notesText = notesRuns.map(r => r.text).join('').trim();
      // Filter out slide number placeholder text
      if (notesText && !/^\d+$/.test(notesText)) {
        notes = notesText;
      }
    }

    const content = contentParts.join('\n\n') || '<!-- Empty slide -->';

    slides.push({
      id: genSlideId(),
      content,
      layout,
      notes,
      transition: 'none',
      transitionDuration: '0.3s',
      fragments: [],
      shapes: [],
      comments: [],
    });
  }

  if (slides.length === 0) {
    slides.push({
      id: genSlideId(),
      content: '# Imported Presentation',
      layout: 'title',
      notes: '',
      transition: 'none',
      transitionDuration: '0.3s',
      fragments: [],
      shapes: [],
      comments: [],
    });
  }

  return slides;
}
