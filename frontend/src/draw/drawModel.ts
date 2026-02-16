/** MD Draw — Data model for freehand drawing / whiteboard canvas */

export type DrawToolType =
  | 'pen'
  | 'highlighter'
  | 'eraser'
  | 'line'
  | 'rectangle'
  | 'circle'
  | 'arrow'
  | 'text'
  | 'select';

export type BackgroundStyle = 'none' | 'grid' | 'dots';

export interface Point {
  x: number;
  y: number;
}

export interface DrawObject {
  id: string;
  type: DrawToolType;
  points: Point[];
  color: string;
  width: number;
  opacity: number;
  layer: number;
  /** For text objects */
  text?: string;
  fontSize?: number;
  /** Bounding box (computed for shapes) */
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}

export interface DrawDocument {
  version: 1;
  width: number;
  height: number;
  background: BackgroundStyle;
  layers: { id: number; name: string; visible: boolean }[];
  objects: DrawObject[];
}

export function createEmptyDocument(width = 1920, height = 1080): DrawDocument {
  return {
    version: 1,
    width,
    height,
    background: 'dots',
    layers: [
      { id: 0, name: 'Background', visible: true },
      { id: 1, name: 'Layer 1', visible: true },
    ],
    objects: [],
  };
}

export function serializeDocument(doc: DrawDocument): string {
  return JSON.stringify(doc, null, 2);
}

export function deserializeDocument(json: string): DrawDocument {
  if (!json.trim()) return createEmptyDocument();
  try {
    const parsed = JSON.parse(json);
    if (!parsed.version) return createEmptyDocument();
    return parsed as DrawDocument;
  } catch {
    return createEmptyDocument();
  }
}

// ---------- Command pattern for undo/redo ----------

export interface DrawCommand {
  type: 'add' | 'remove' | 'modify' | 'clear';
  objects: DrawObject[];
  /** For modify: previous state */
  previous?: DrawObject[];
}

export class DrawHistory {
  private undoStack: DrawCommand[] = [];
  private redoStack: DrawCommand[] = [];

  push(cmd: DrawCommand) {
    this.undoStack.push(cmd);
    this.redoStack = [];
  }

  undo(doc: DrawDocument): DrawDocument {
    const cmd = this.undoStack.pop();
    if (!cmd) return doc;
    this.redoStack.push(cmd);
    return this.reverseCommand(doc, cmd);
  }

  redo(doc: DrawDocument): DrawDocument {
    const cmd = this.redoStack.pop();
    if (!cmd) return doc;
    this.undoStack.push(cmd);
    return this.applyCommand(doc, cmd);
  }

  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }

  private applyCommand(doc: DrawDocument, cmd: DrawCommand): DrawDocument {
    switch (cmd.type) {
      case 'add':
        return { ...doc, objects: [...doc.objects, ...cmd.objects] };
      case 'remove':
        const removeIds = new Set(cmd.objects.map(o => o.id));
        return { ...doc, objects: doc.objects.filter(o => !removeIds.has(o.id)) };
      case 'modify':
        const modMap = new Map(cmd.objects.map(o => [o.id, o]));
        return { ...doc, objects: doc.objects.map(o => modMap.get(o.id) || o) };
      case 'clear':
        return { ...doc, objects: [] };
      default:
        return doc;
    }
  }

  private reverseCommand(doc: DrawDocument, cmd: DrawCommand): DrawDocument {
    switch (cmd.type) {
      case 'add':
        const addIds = new Set(cmd.objects.map(o => o.id));
        return { ...doc, objects: doc.objects.filter(o => !addIds.has(o.id)) };
      case 'remove':
        return { ...doc, objects: [...doc.objects, ...cmd.objects] };
      case 'modify':
        if (!cmd.previous) return doc;
        const prevMap = new Map(cmd.previous.map(o => [o.id, o]));
        return { ...doc, objects: doc.objects.map(o => prevMap.get(o.id) || o) };
      case 'clear':
        return { ...doc, objects: cmd.objects };
      default:
        return doc;
    }
  }
}

// ---------- Export helpers ----------

export function exportToPngDataUrl(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png');
}

export function exportToSvg(doc: DrawDocument): string {
  const lines: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${doc.width}" height="${doc.height}" viewBox="0 0 ${doc.width} ${doc.height}">`,
  ];

  for (const obj of doc.objects) {
    if (obj.type === 'text') {
      lines.push(
        `<text x="${obj.points[0]?.x ?? 0}" y="${obj.points[0]?.y ?? 0}" fill="${obj.color}" opacity="${obj.opacity}" font-size="${obj.fontSize ?? 16}">${escapeXml(obj.text ?? '')}</text>`
      );
      continue;
    }
    if (obj.type === 'rectangle' && obj.points.length >= 2) {
      const [p1, p2] = obj.points;
      const x = Math.min(p1.x, p2.x);
      const y = Math.min(p1.y, p2.y);
      const w = Math.abs(p2.x - p1.x);
      const h = Math.abs(p2.y - p1.y);
      lines.push(
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" stroke="${obj.color}" stroke-width="${obj.width}" fill="none" opacity="${obj.opacity}" />`
      );
      continue;
    }
    if (obj.type === 'circle' && obj.points.length >= 2) {
      const [c, edge] = obj.points;
      const r = Math.hypot(edge.x - c.x, edge.y - c.y);
      lines.push(
        `<circle cx="${c.x}" cy="${c.y}" r="${r}" stroke="${obj.color}" stroke-width="${obj.width}" fill="none" opacity="${obj.opacity}" />`
      );
      continue;
    }
    // Pen, highlighter, line, arrow — polyline / line
    if (obj.points.length < 2) continue;
    if (obj.type === 'line' || obj.type === 'arrow') {
      const [p1, p2] = [obj.points[0], obj.points[obj.points.length - 1]];
      let marker = '';
      if (obj.type === 'arrow') {
        marker = ` marker-end="url(#arrow)"`;
      }
      lines.push(
        `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="${obj.color}" stroke-width="${obj.width}" opacity="${obj.opacity}"${marker} />`
      );
    } else {
      const d = obj.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');
      lines.push(
        `<path d="${d}" stroke="${obj.color}" stroke-width="${obj.width}" fill="none" opacity="${obj.opacity}" stroke-linecap="round" stroke-linejoin="round" />`
      );
    }
  }

  // Arrow marker definition
  if (doc.objects.some(o => o.type === 'arrow')) {
    lines.splice(1, 0,
      '<defs><marker id="arrow" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="context-stroke" /></marker></defs>'
    );
  }

  lines.push('</svg>');
  return lines.join('\n');
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

let _idCounter = 0;
export function genId(): string {
  return `obj_${Date.now()}_${++_idCounter}`;
}
