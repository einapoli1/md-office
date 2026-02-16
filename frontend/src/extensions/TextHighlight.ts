/**
 * TextHighlight Extension
 * Enhances the built-in highlight with 8 colors, keyboard shortcut cycling,
 * and a find-all-highlights command.
 */
import { Extension } from '@tiptap/core';

export const HIGHLIGHT_COLORS = [
  { name: 'Yellow', color: '#ffff00' },
  { name: 'Green', color: '#00ff00' },
  { name: 'Blue', color: '#00cfff' },
  { name: 'Pink', color: '#ff69b4' },
  { name: 'Orange', color: '#ffa500' },
  { name: 'Purple', color: '#da70d6' },
  { name: 'Red', color: '#ff4444' },
  { name: 'Cyan', color: '#00ffff' },
] as const;

export interface HighlightResult {
  color: string;
  text: string;
  from: number;
  to: number;
}

/** Find all highlighted text in the document */
export function findAllHighlights(editor: any): HighlightResult[] {
  const results: HighlightResult[] = [];
  const { doc } = editor.state;

  doc.descendants((node: any, pos: number) => {
    if (node.isText) {
      const highlightMark = node.marks.find((m: any) => m.type.name === 'highlight');
      if (highlightMark) {
        results.push({
          color: highlightMark.attrs.color || '#ffff00',
          text: node.text || '',
          from: pos,
          to: pos + node.nodeSize,
        });
      }
    }
  });

  return results;
}

/**
 * TextHighlight extension: adds Cmd+Shift+H to cycle highlight colors
 */
export const TextHighlight = Extension.create({
  name: 'textHighlightCycler',

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-h': () => {
        const editor = this.editor;
        const currentHighlight = editor.getAttributes('highlight');
        const currentColor = currentHighlight?.color || null;

        if (!currentColor) {
          // No highlight → apply first color
          editor.chain().focus().setHighlight({ color: HIGHLIGHT_COLORS[0].color }).run();
          return true;
        }

        const idx = HIGHLIGHT_COLORS.findIndex(c => c.color === currentColor);
        if (idx >= 0 && idx < HIGHLIGHT_COLORS.length - 1) {
          // Cycle to next color
          editor.chain().focus().setHighlight({ color: HIGHLIGHT_COLORS[idx + 1].color }).run();
        } else {
          // Last color or unknown → remove highlight
          editor.chain().focus().unsetHighlight().run();
        }
        return true;
      },
    };
  },
});

export default TextHighlight;
