// Slides export: PDF (print) and standalone HTML
import { Slide } from './slideModel';
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
