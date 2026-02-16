import { useState, useMemo, useCallback } from 'react';
import { PrintSettings } from './SheetPrintSetup';
import { WorkbookData, SheetData } from './sheetModel';

/* ── helpers ── */

const PAPER: Record<string, { w: number; h: number }> = {
  letter: { w: 8.5, h: 11 },
  a4: { w: 8.27, h: 11.69 },
  legal: { w: 8.5, h: 14 },
};

const MARGINS: Record<string, { top: number; right: number; bottom: number; left: number }> = {
  normal: { top: 0.75, right: 0.7, bottom: 0.75, left: 0.7 },
  narrow: { top: 0.5, right: 0.25, bottom: 0.5, left: 0.25 },
  wide: { top: 1, right: 1, bottom: 1, left: 1 },
};

function resolveMargins(s: PrintSettings) {
  return s.margins === 'custom' ? s.customMargins : MARGINS[s.margins];
}

function resolveToken(tmpl: string, page: number, pages: number, sheetName: string) {
  return tmpl
    .replace(/\{page\}/g, String(page))
    .replace(/\{pages\}/g, String(pages))
    .replace(/\{date\}/g, new Date().toLocaleDateString())
    .replace(/\{sheet\}/g, sheetName);
}



function getCellDisplay(sheet: SheetData, row: number, col: number): string {
  const id = String.fromCharCode(65 + col) + (row + 1);
  const cell = sheet.cells[id];
  if (!cell) return '';
  const v = cell.computed !== undefined ? cell.computed : cell.value;
  return v == null ? '' : String(v);
}

/** Split rows/cols into pages based on available print area size. */
function paginate(sheet: SheetData, settings: PrintSettings) {
  const paper = PAPER[settings.paperSize];
  const m = resolveMargins(settings);
  const orient = settings.orientation === 'landscape';
  const pw = (orient ? paper.h : paper.w) - m.left - m.right;
  const ph = (orient ? paper.w : paper.h) - m.top - m.bottom - 0.5; // 0.5″ for header/footer

  const DPI = 96;
  const availW = pw * DPI;
  const availH = ph * DPI;

  let maxRow = 0, maxCol = 0;
  for (const id of Object.keys(sheet.cells)) {
    const m = id.match(/^([A-Z]+)(\d+)$/);
    if (m) {
      const c = m[1].split('').reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0);
      const r = parseInt(m[2]);
      if (r > maxRow) maxRow = r;
      if (c > maxCol) maxCol = c;
    }
  }
  maxRow = Math.max(maxRow, 20);
  maxCol = Math.max(maxCol, 10);

  const colWidth = 80; // px per col (approx)
  const rowHeight = 24;

  // figure out scale
  let scale = 1;
  if (settings.scaleFit === 'custom') scale = (settings.customScale || 100) / 100;
  else if (settings.scaleFit === 'fitPage') {
    const sx = availW / (maxCol * colWidth);
    const sy = availH / (maxRow * rowHeight);
    scale = Math.min(sx, sy, 1);
  } else if (settings.scaleFit === 'fitWidth') {
    scale = Math.min(availW / (maxCol * colWidth), 1);
  } else if (settings.scaleFit === 'fitHeight') {
    scale = Math.min(availH / (maxRow * rowHeight), 1);
  }

  const colsPerPage = Math.max(1, Math.floor(availW / (colWidth * scale)));
  const rowsPerPage = Math.max(1, Math.floor(availH / (rowHeight * scale)));

  // Build pages
  const pages: { startRow: number; endRow: number; startCol: number; endCol: number }[] = [];
  const colChunks: [number, number][] = [];
  for (let c = 0; c < maxCol; c += colsPerPage) colChunks.push([c, Math.min(c + colsPerPage, maxCol)]);
  const rowChunks: [number, number][] = [];
  for (let r = 0; r < maxRow; r += rowsPerPage) rowChunks.push([r, Math.min(r + rowsPerPage, maxRow)]);

  if (settings.pageOrder === 'downThenOver') {
    for (const [cs, ce] of colChunks) for (const [rs, re] of rowChunks) pages.push({ startRow: rs, endRow: re, startCol: cs, endCol: ce });
  } else {
    for (const [rs, re] of rowChunks) for (const [cs, ce] of colChunks) pages.push({ startRow: rs, endRow: re, startCol: cs, endCol: ce });
  }

  return { pages, scale, colWidth, rowHeight };
}

/* ── component ── */

interface Props {
  workbook: WorkbookData;
  sheetIndex: number;
  settings: PrintSettings;
  onClose: () => void;
  manualBreaks: number[];
  onToggleBreak: (row: number) => void;
}

export default function SheetPrintPreview({ workbook, sheetIndex, settings, onClose, manualBreaks, onToggleBreak }: Props) {
  const sheet = workbook.sheets[sheetIndex];
  const [currentPage, setCurrentPage] = useState(0);

  const { pages, scale, colWidth, rowHeight } = useMemo(() => paginate(sheet, settings), [sheet, settings]);
  const totalPages = pages.length;

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const page = pages[currentPage] || pages[0];
  if (!page) return null;

  const renderPage = (pg: typeof page, pageNum: number) => {
    const m = resolveMargins(settings);
    const rows: React.ReactNode[] = [];
    // Repeat rows
    const repeatEnd = settings.repeatRows;
    const allRows: number[] = [];
    if (repeatEnd > 0 && pg.startRow >= repeatEnd) {
      for (let r = 0; r < repeatEnd; r++) allRows.push(r);
    }
    for (let r = pg.startRow; r < pg.endRow; r++) allRows.push(r);

    for (const r of allRows) {
      const cells: React.ReactNode[] = [];
      // Repeat cols
      const repeatColEnd = settings.repeatCols;
      const allCols: number[] = [];
      if (repeatColEnd > 0 && pg.startCol >= repeatColEnd) {
        for (let c = 0; c < repeatColEnd; c++) allCols.push(c);
      }
      for (let c = pg.startCol; c < pg.endCol; c++) allCols.push(c);

      if (settings.rowColHeaders) {
        cells.push(<td key="rh" style={{ background: '#f0f0f0', fontWeight: 600, textAlign: 'center', padding: '2px 6px', borderRight: '1px solid #999', fontSize: 11 }}>{r + 1}</td>);
      }
      for (const c of allCols) {
        const isBreak = manualBreaks.includes(r) && c === allCols[0];
        cells.push(
          <td key={c} style={{
            border: settings.gridlines ? '1px solid #d0d0d0' : '1px solid transparent',
            padding: '2px 4px', fontSize: 12, minWidth: colWidth * scale, height: rowHeight * scale,
            borderTop: isBreak ? '2px dashed #4285f4' : undefined, cursor: 'default',
          }}
            onDoubleClick={() => onToggleBreak(r)}
          >
            {getCellDisplay(sheet, r, c)}
          </td>
        );
      }
      rows.push(<tr key={r}>{cells}</tr>);
    }

    const headerRow = settings.rowColHeaders ? (
      <tr>
        <th style={{ background: '#f0f0f0' }} />
        {(() => {
          const allCols: number[] = [];
          const rce = settings.repeatCols;
          if (rce > 0 && pg.startCol >= rce) for (let c = 0; c < rce; c++) allCols.push(c);
          for (let c = pg.startCol; c < pg.endCol; c++) allCols.push(c);
          return allCols.map(c => <th key={c} style={{ background: '#f0f0f0', fontWeight: 600, fontSize: 11, padding: '2px 6px', borderBottom: '1px solid #999' }}>{String.fromCharCode(65 + c)}</th>);
        })()}
      </tr>
    ) : null;

    const hdrL = resolveToken(settings.headerLeft, pageNum, totalPages, sheet.name);
    const hdrC = resolveToken(settings.headerCenter, pageNum, totalPages, sheet.name);
    const hdrR = resolveToken(settings.headerRight, pageNum, totalPages, sheet.name);
    const ftrL = resolveToken(settings.footerLeft, pageNum, totalPages, sheet.name);
    const ftrC = resolveToken(settings.footerCenter, pageNum, totalPages, sheet.name);
    const ftrR = resolveToken(settings.footerRight, pageNum, totalPages, sheet.name);

    return (
      <div className="sheet-print-page" style={{ padding: `${m.top * 48}px ${m.right * 48}px ${m.bottom * 48}px ${m.left * 48}px`, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        {(hdrL || hdrC || hdrR) && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#666', marginBottom: 8 }}>
            <span>{hdrL}</span><span>{hdrC}</span><span>{hdrR}</span>
          </div>
        )}
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>{headerRow}</thead>
          <tbody>{rows}</tbody>
        </table>
        {(ftrL || ftrC || ftrR) && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#666', marginTop: 8 }}>
            <span>{ftrL}</span><span>{ftrC}</span><span>{ftrR}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="sheet-print-preview-overlay">
      <div className="sheet-print-preview-toolbar">
        <button className="sheet-tb-btn" onClick={onClose}>✕ Close</button>
        <span style={{ margin: '0 12px', fontSize: 13 }}>
          Page {currentPage + 1} of {totalPages}
        </span>
        <button className="sheet-tb-btn" disabled={currentPage === 0} onClick={() => setCurrentPage(p => p - 1)}>◀ Prev</button>
        <button className="sheet-tb-btn" disabled={currentPage >= totalPages - 1} onClick={() => setCurrentPage(p => p + 1)}>Next ▶</button>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: '#666', marginRight: 8 }}>Double-click a row to toggle page break</span>
        <button className="sheet-tb-btn" style={{ background: '#1a73e8', color: '#fff' }} onClick={handlePrint}>🖨️ Print</button>
      </div>
      <div className="sheet-print-preview-body">
        {renderPage(page, currentPage + 1)}
      </div>
    </div>
  );
}
