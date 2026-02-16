/**
 * TableAdvanced.ts — Extended TipTap table extensions with advanced cell/table attributes.
 *
 * Extends TableCell and Table with:
 *   - Cell background color, border customization, vertical alignment, padding
 *   - Table width mode, banded rows
 */
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Table } from '@tiptap/extension-table';

// ─── Custom TableCell with extra attributes ───────────────────────────────────

export const TableCellAdvanced = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).style.backgroundColor || null,
        renderHTML: (attrs) => {
          if (!attrs.backgroundColor) return {};
          return { style: `background-color: ${attrs.backgroundColor}` };
        },
      },
      borderColor: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-border-color') || null,
        renderHTML: (attrs) => {
          if (!attrs.borderColor) return {};
          return { 'data-border-color': attrs.borderColor };
        },
      },
      borderWidth: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-border-width') || null,
        renderHTML: (attrs) => {
          if (!attrs.borderWidth) return {};
          return { 'data-border-width': attrs.borderWidth };
        },
      },
      borderStyle: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-border-style') || null,
        renderHTML: (attrs) => {
          if (!attrs.borderStyle) return {};
          return { 'data-border-style': attrs.borderStyle };
        },
      },
      verticalAlign: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).style.verticalAlign || null,
        renderHTML: (attrs) => {
          if (!attrs.verticalAlign) return {};
          return { style: `vertical-align: ${attrs.verticalAlign}` };
        },
      },
      cellPadding: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-cell-padding') || null,
        renderHTML: (attrs) => {
          if (!attrs.cellPadding) return {};
          return { 'data-cell-padding': attrs.cellPadding };
        },
      },
    };
  },

  renderHTML({ node, HTMLAttributes }) {
    const styles: string[] = [];
    const existing = (HTMLAttributes.style as string) || '';
    if (existing) styles.push(existing);

    const bc = node.attrs.borderColor || '#000';
    const bw = node.attrs.borderWidth || '1px';
    const bs = node.attrs.borderStyle || 'solid';
    if (node.attrs.borderColor || node.attrs.borderWidth || node.attrs.borderStyle) {
      styles.push(`border: ${bw} ${bs} ${bc}`);
    }
    if (node.attrs.cellPadding) {
      styles.push(`padding: ${node.attrs.cellPadding}`);
    }

    const finalAttrs = { ...HTMLAttributes };
    if (styles.length) {
      finalAttrs.style = styles.join('; ');
    }

    return ['td', finalAttrs, 0];
  },
});

// ─── Custom TableHeader with same attributes ─────────────────────────────────

export const TableHeaderAdvanced = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).style.backgroundColor || null,
        renderHTML: (attrs) => {
          if (!attrs.backgroundColor) return {};
          return { style: `background-color: ${attrs.backgroundColor}` };
        },
      },
      borderColor: { default: null },
      borderWidth: { default: null },
      borderStyle: { default: null },
      verticalAlign: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).style.verticalAlign || null,
        renderHTML: (attrs) => {
          if (!attrs.verticalAlign) return {};
          return { style: `vertical-align: ${attrs.verticalAlign}` };
        },
      },
      cellPadding: { default: null },
    };
  },

  renderHTML({ node, HTMLAttributes }) {
    const styles: string[] = [];
    const existing = (HTMLAttributes.style as string) || '';
    if (existing) styles.push(existing);

    const bc = node.attrs.borderColor || '#000';
    const bw = node.attrs.borderWidth || '1px';
    const bs = node.attrs.borderStyle || 'solid';
    if (node.attrs.borderColor || node.attrs.borderWidth || node.attrs.borderStyle) {
      styles.push(`border: ${bw} ${bs} ${bc}`);
    }
    if (node.attrs.cellPadding) {
      styles.push(`padding: ${node.attrs.cellPadding}`);
    }

    const finalAttrs = { ...HTMLAttributes };
    if (styles.length) {
      finalAttrs.style = styles.join('; ');
    }

    return ['th', finalAttrs, 0];
  },
});

// ─── Custom Table with width mode & banded rows ──────────────────────────────

export const TableAdvanced = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      tableWidthMode: {
        default: 'auto',
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-width-mode') || 'auto',
        renderHTML: (attrs) => {
          if (!attrs.tableWidthMode || attrs.tableWidthMode === 'auto') return {};
          return { 'data-width-mode': attrs.tableWidthMode };
        },
      },
      bandedRows: {
        default: false,
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-banded-rows') === 'true',
        renderHTML: (attrs) => {
          if (!attrs.bandedRows) return {};
          return { 'data-banded-rows': 'true' };
        },
      },
      tableStyle: {
        default: 'plain',
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-table-style') || 'plain',
        renderHTML: (attrs) => {
          if (!attrs.tableStyle || attrs.tableStyle === 'plain') return {};
          return { 'data-table-style': attrs.tableStyle };
        },
      },
      tableAlignment: {
        default: 'left',
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-table-align') || 'left',
        renderHTML: (attrs) => {
          if (!attrs.tableAlignment || attrs.tableAlignment === 'left') return {};
          return { 'data-table-align': attrs.tableAlignment };
        },
      },
    };
  },
});

// ─── Table style presets ──────────────────────────────────────────────────────

export interface TableStylePreset {
  id: string;
  name: string;
  headerBg: string;
  headerFg: string;
  headerBorderColor: string;
  cellBorderColor: string;
  cellBorderStyle: string;
  cellBorderWidth: string;
  evenRowBg: string;
  oddRowBg: string;
  bandedRows: boolean;
}

export const TABLE_STYLE_PRESETS: TableStylePreset[] = [
  {
    id: 'plain', name: 'Plain',
    headerBg: 'transparent', headerFg: '#000',
    headerBorderColor: '#999', cellBorderColor: '#999',
    cellBorderStyle: 'solid', cellBorderWidth: '1px',
    evenRowBg: 'transparent', oddRowBg: 'transparent', bandedRows: false,
  },
  {
    id: 'grid', name: 'Grid',
    headerBg: '#f3f4f6', headerFg: '#111',
    headerBorderColor: '#333', cellBorderColor: '#d1d5db',
    cellBorderStyle: 'solid', cellBorderWidth: '1px',
    evenRowBg: 'transparent', oddRowBg: 'transparent', bandedRows: false,
  },
  {
    id: 'light', name: 'Light',
    headerBg: '#f9fafb', headerFg: '#374151',
    headerBorderColor: '#e5e7eb', cellBorderColor: '#f3f4f6',
    cellBorderStyle: 'solid', cellBorderWidth: '1px',
    evenRowBg: 'transparent', oddRowBg: 'transparent', bandedRows: false,
  },
  {
    id: 'banded-gray', name: 'Banded Gray',
    headerBg: '#6b7280', headerFg: '#fff',
    headerBorderColor: '#6b7280', cellBorderColor: '#e5e7eb',
    cellBorderStyle: 'solid', cellBorderWidth: '1px',
    evenRowBg: '#f9fafb', oddRowBg: '#ffffff', bandedRows: true,
  },
  {
    id: 'banded-blue', name: 'Banded Blue',
    headerBg: '#2563eb', headerFg: '#fff',
    headerBorderColor: '#2563eb', cellBorderColor: '#dbeafe',
    cellBorderStyle: 'solid', cellBorderWidth: '1px',
    evenRowBg: '#eff6ff', oddRowBg: '#ffffff', bandedRows: true,
  },
  {
    id: 'colorful-green', name: 'Colorful Green',
    headerBg: '#16a34a', headerFg: '#fff',
    headerBorderColor: '#16a34a', cellBorderColor: '#bbf7d0',
    cellBorderStyle: 'solid', cellBorderWidth: '1px',
    evenRowBg: '#f0fdf4', oddRowBg: '#ffffff', bandedRows: true,
  },
  {
    id: 'colorful-purple', name: 'Colorful Purple',
    headerBg: '#7c3aed', headerFg: '#fff',
    headerBorderColor: '#7c3aed', cellBorderColor: '#ddd6fe',
    cellBorderStyle: 'solid', cellBorderWidth: '1px',
    evenRowBg: '#f5f3ff', oddRowBg: '#ffffff', bandedRows: true,
  },
  {
    id: 'colorful-orange', name: 'Colorful Orange',
    headerBg: '#ea580c', headerFg: '#fff',
    headerBorderColor: '#ea580c', cellBorderColor: '#fed7aa',
    cellBorderStyle: 'solid', cellBorderWidth: '1px',
    evenRowBg: '#fff7ed', oddRowBg: '#ffffff', bandedRows: true,
  },
  {
    id: 'dark', name: 'Dark',
    headerBg: '#1f2937', headerFg: '#f9fafb',
    headerBorderColor: '#1f2937', cellBorderColor: '#374151',
    cellBorderStyle: 'solid', cellBorderWidth: '1px',
    evenRowBg: '#f3f4f6', oddRowBg: '#ffffff', bandedRows: true,
  },
  {
    id: 'minimal', name: 'Minimal',
    headerBg: 'transparent', headerFg: '#111',
    headerBorderColor: 'transparent', cellBorderColor: 'transparent',
    cellBorderStyle: 'none', cellBorderWidth: '0',
    evenRowBg: 'transparent', oddRowBg: 'transparent', bandedRows: false,
  },
];

/**
 * Apply a table style preset to all cells in the current table.
 */
export function applyTableStyle(editor: any, preset: TableStylePreset): void {
  const { state } = editor;
  const { $anchor } = state.selection;

  // Find table node
  let tablePos = -1;
  let tableNode: any = null;
  let depth = $anchor.depth;
  while (depth > 0) {
    const node = $anchor.node(depth);
    if (node.type.name === 'table') {
      tableNode = node;
      tablePos = $anchor.before(depth);
      break;
    }
    depth--;
  }
  if (!tableNode || tablePos < 0) return;

  const { tr } = state;

  // Update table attributes
  tr.setNodeMarkup(tablePos, undefined, {
    ...tableNode.attrs,
    bandedRows: preset.bandedRows,
    tableStyle: preset.id,
  });

  // Walk rows and cells
  let rowIdx = 0;
  tableNode.forEach((row: any, rowOffset: number) => {
    let cellIdx = 0;
    row.forEach((cell: any, cellOffset: number) => {
      const cellPos = tablePos + 1 + rowOffset + 1 + cellOffset;
      const isHeader = cell.type.name === 'tableHeader';

      let bg: string;
      if (isHeader) {
        bg = preset.headerBg;
      } else if (preset.bandedRows) {
        bg = rowIdx % 2 === 0 ? preset.evenRowBg : preset.oddRowBg;
      } else {
        bg = 'transparent';
      }

      tr.setNodeMarkup(cellPos, undefined, {
        ...cell.attrs,
        backgroundColor: bg,
        borderColor: isHeader ? preset.headerBorderColor : preset.cellBorderColor,
        borderStyle: preset.cellBorderStyle,
        borderWidth: preset.cellBorderWidth,
      });

      cellIdx++;
    });
    rowIdx++;
  });

  editor.view.dispatch(tr);
}
