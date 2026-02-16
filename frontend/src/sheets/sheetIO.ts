// Sheet import/export: CSV and XLSX
import * as XLSX from 'xlsx';
import { SheetData, CellData, createEmptySheet } from './sheetModel';
import { CellFormat } from './cellFormat';
import { cellId, indexToCol, parseCellRef } from './formulaEngine';

// ─── CSV ───

function csvEscape(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('\r')) {
    return '"' + val.replace(/"/g, '""') + '"';
  }
  return val;
}

export function exportCSV(sheet: SheetData): string {
  let maxRow = 0, maxCol = 0;
  for (const key of Object.keys(sheet.cells)) {
    const ref = parseCellRef(key);
    if (ref) {
      maxRow = Math.max(maxRow, ref.row);
      maxCol = Math.max(maxCol, ref.col);
    }
  }

  const lines: string[] = [];
  for (let r = 0; r <= maxRow; r++) {
    const cols: string[] = [];
    for (let c = 0; c <= maxCol; c++) {
      const cell = sheet.cells[cellId(c, r)];
      const val = cell ? (cell.computed ?? cell.value) : '';
      cols.push(csvEscape(val));
    }
    lines.push(cols.join(','));
  }
  return lines.join('\n');
}

export function importCSV(csv: string): SheetData {
  const sheet = createEmptySheet('Sheet1');
  const rows = parseCSVRows(csv);
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      const val = rows[r][c];
      if (val) {
        const id = cellId(c, r);
        if (val.startsWith('=')) {
          sheet.cells[id] = { value: '', formula: val };
        } else {
          sheet.cells[id] = { value: val };
        }
      }
    }
  }
  return sheet;
}

function parseCSVRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < csv.length) {
    const ch = csv[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < csv.length && csv[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        field += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ',') {
        row.push(field);
        field = '';
        i++;
      } else if (ch === '\n' || ch === '\r') {
        row.push(field);
        field = '';
        rows.push(row);
        row = [];
        if (ch === '\r' && i + 1 < csv.length && csv[i + 1] === '\n') i++;
        i++;
      } else {
        field += ch;
        i++;
      }
    }
  }
  // Last field
  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// ─── XLSX ───

export function exportXLSX(sheets: SheetData[]): Blob {
  const wb = XLSX.utils.book_new();

  for (const sheet of sheets) {
    let maxRow = 0, maxCol = 0;
    for (const key of Object.keys(sheet.cells)) {
      const ref = parseCellRef(key);
      if (ref) {
        maxRow = Math.max(maxRow, ref.row);
        maxCol = Math.max(maxCol, ref.col);
      }
    }

    const wsData: (string | number)[][] = [];
    for (let r = 0; r <= maxRow; r++) {
      const row: (string | number)[] = [];
      for (let c = 0; c <= maxCol; c++) {
        const cell = sheet.cells[cellId(c, r)];
        if (!cell) {
          row.push('');
        } else {
          const val = cell.computed ?? cell.value;
          const num = parseFloat(val);
          row.push(!isNaN(num) && val.trim() !== '' ? num : val);
        }
      }
      wsData.push(row);
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Apply formulas
    for (const key of Object.keys(sheet.cells)) {
      const cell = sheet.cells[key];
      if (cell?.formula) {
        const ref = parseCellRef(key);
        if (ref) {
          const addr = indexToCol(ref.col) + (ref.row + 1);
          if (!ws[addr]) ws[addr] = {};
          ws[addr].f = cell.formula.slice(1); // strip leading =
        }
      }
    }

    // Apply col widths
    const colWidths: XLSX.ColInfo[] = [];
    for (let c = 0; c <= maxCol; c++) {
      const w = sheet.colWidths[c];
      colWidths.push({ wch: w ? Math.round(w / 7) : 14 });
    }
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, sheet.name || `Sheet${sheets.indexOf(sheet) + 1}`);
  }

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export async function importXLSX(file: File): Promise<SheetData[]> {
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { cellFormula: true, cellStyles: true });

  return wb.SheetNames.map(name => {
    const ws = wb.Sheets[name];
    const sheet = createEmptySheet(name);
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');

    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const wsCell = ws[addr];
        if (!wsCell) continue;

        const id = cellId(c, r);
        const cellData: CellData = { value: '' };

        if (wsCell.f) {
          cellData.formula = '=' + wsCell.f;
          cellData.value = '';
        }
        if (wsCell.v !== undefined && wsCell.v !== null) {
          cellData.value = String(wsCell.v);
        }

        // Basic formatting from style
        if (wsCell.s) {
          const fmt: CellFormat = {};
          const s = wsCell.s as Record<string, any>;
          if (s.font?.bold) fmt.bold = true;
          if (s.font?.italic) fmt.italic = true;
          if (s.font?.underline) fmt.underline = true;
          if (s.font?.strike) fmt.strikethrough = true;
          if (s.font?.sz) fmt.fontSize = s.font.sz;
          if (s.font?.color?.rgb) fmt.textColor = '#' + s.font.color.rgb.slice(-6);
          if (s.fill?.fgColor?.rgb) fmt.backgroundColor = '#' + s.fill.fgColor.rgb.slice(-6);
          if (s.alignment?.horizontal) fmt.textAlign = s.alignment.horizontal as any;
          if (Object.keys(fmt).length > 0) cellData.format = fmt;
        }

        sheet.cells[id] = cellData;
      }
    }

    // Column widths
    if (ws['!cols']) {
      ws['!cols'].forEach((col: XLSX.ColInfo, idx: number) => {
        if (col && col.wch) sheet.colWidths[idx] = col.wch * 7;
        else if (col && col.wpx) sheet.colWidths[idx] = col.wpx;
      });
    }

    return sheet;
  });
}

// ─── Helpers for UI ───

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadString(content: string, filename: string, mimeType: string) {
  downloadBlob(new Blob([content], { type: mimeType }), filename);
}
