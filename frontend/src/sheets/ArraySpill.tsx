// ArraySpill — Visual indicator for array formula spill ranges

import { useMemo } from 'react';
import type { ArrayResult } from './formulaEngine';
import { parseCellRef, cellId } from './formulaEngine';

export interface SpillRange {
  sourceCell: string;
  result: ArrayResult;
  blocked?: string; // cell that blocks the spill, if any
}

interface ArraySpillProps {
  spillRanges: SpillRange[];
  colWidths: (col: number) => number;
  rowHeights: (row: number) => number;
  scrollLeft: number;
  scrollTop: number;
  frozenCols: number;
  frozenRows: number;
  selectedCell?: string;
  onSelectSource?: (sourceCell: string) => void;
}

export default function ArraySpill({
  spillRanges,
  colWidths,
  rowHeights,
  scrollLeft,
  scrollTop,
  frozenCols,
  frozenRows,
  selectedCell,
  onSelectSource,
}: ArraySpillProps) {
  const overlays = useMemo(() => {
    const items: {
      key: string;
      x: number;
      y: number;
      width: number;
      height: number;
      sourceCell: string;
      isSource: boolean;
      isBlocked: boolean;
      ghostLabel?: string;
    }[] = [];

    for (const spill of spillRanges) {
      const source = parseCellRef(spill.sourceCell);
      if (!source) continue;

      const isBlocked = !!spill.blocked;

      // Calculate positions for each cell in the spill range
      for (let r = 0; r < spill.result.values.length; r++) {
        const row = spill.result.values[r];
        if (!row) continue;
        for (let c = 0; c < row.length; c++) {
          const cellRow = source.row + r;
          const cellCol = source.col + c;
          const id = cellId(cellCol, cellRow);
          const isSourceCell = r === 0 && c === 0;

          // Calculate pixel position
          let x = 0;
          for (let ci = 0; ci < cellCol; ci++) x += colWidths(ci);
          let y = 0;
          for (let ri = 0; ri < cellRow; ri++) y += rowHeights(ri);

          // Adjust for scroll (respecting frozen panes)
          if (cellCol >= frozenCols) x -= scrollLeft;
          if (cellRow >= frozenRows) y -= scrollTop;

          items.push({
            key: id,
            x,
            y,
            width: colWidths(cellCol),
            height: rowHeights(cellRow),
            sourceCell: spill.sourceCell,
            isSource: isSourceCell,
            isBlocked,
            ghostLabel: !isSourceCell ? `↓ from ${spill.sourceCell}` : undefined,
          });
        }
      }
    }
    return items;
  }, [spillRanges, colWidths, rowHeights, scrollLeft, scrollTop, frozenCols, frozenRows]);

  if (overlays.length === 0) return null;

  // Group by sourceCell to draw borders around each spill range
  const groups = new Map<string, typeof overlays>();
  for (const item of overlays) {
    const arr = groups.get(item.sourceCell) ?? [];
    arr.push(item);
    groups.set(item.sourceCell, arr);
  }

  return (
    <div className="array-spill-overlay" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 5 }}>
      {Array.from(groups.entries()).map(([sourceCell, cells]) => {
        if (cells.length === 0) return null;
        const isBlocked = cells[0].isBlocked;

        // Calculate bounding box
        const minX = Math.min(...cells.map(c => c.x));
        const minY = Math.min(...cells.map(c => c.y));
        const maxX = Math.max(...cells.map(c => c.x + c.width));
        const maxY = Math.max(...cells.map(c => c.y + c.height));

        return (
          <div key={sourceCell}>
            {/* Blue border around entire spill range */}
            <div
              style={{
                position: 'absolute',
                left: minX,
                top: minY,
                width: maxX - minX,
                height: maxY - minY,
                border: isBlocked ? '2px dashed #e53935' : '2px solid #1a73e8',
                borderRadius: 1,
                pointerEvents: 'none',
              }}
            />
            {/* Ghost labels for non-source cells */}
            {cells.map(cell => {
              if (!cell.ghostLabel) return null;
              const isSelected = selectedCell === cell.key;
              return (
                <div
                  key={cell.key}
                  style={{
                    position: 'absolute',
                    left: cell.x + 2,
                    top: cell.y + 2,
                    fontSize: 9,
                    color: '#9e9e9e',
                    pointerEvents: isSelected ? 'auto' : 'none',
                    cursor: isSelected ? 'pointer' : 'default',
                    userSelect: 'none',
                  }}
                  onClick={isSelected && onSelectSource ? () => onSelectSource(cell.sourceCell) : undefined}
                >
                  {cell.ghostLabel}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
