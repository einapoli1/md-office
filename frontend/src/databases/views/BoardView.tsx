import { useMemo } from 'react';
import { ViewProps } from './viewTypes';
import { groupRows } from '../databaseModel';

export default function BoardView({ columns, rows, activeView, onCellChange, onRowClick, onAddRow }: ViewProps) {
  // Board groups by the first select column or the groupBy column
  const groupColId = activeView.groupByColumnId ?? columns.find(c => c.type === 'select')?.id ?? columns[0]?.id;
  const groupCol = columns.find(c => c.id === groupColId);

  const groups = useMemo(() => {
    if (!groupColId) return new Map<string, typeof rows>();
    const g = groupRows(rows, groupColId);
    // Ensure all select options are represented
    if (groupCol?.options) {
      for (const opt of groupCol.options) {
        if (!g.has(opt.label)) g.set(opt.label, []);
      }
    }
    return g;
  }, [rows, groupColId, groupCol]);

  const titleCol = columns[0];

  return (
    <div className="db-board">
      {Array.from(groups.entries()).map(([group, groupRows]) => (
        <div key={group} className="db-board-column">
          <div className="db-board-column-header">
            <span className="db-board-column-title">{group}</span>
            <span className="db-board-count">{groupRows.length}</span>
          </div>
          <div className="db-board-cards">
            {groupRows.map(row => (
              <div key={row.id} className="db-board-card" onClick={() => onRowClick(row.id)}>
                <div className="db-board-card-title">{String(row.cells[titleCol?.id] ?? '')}</div>
                {columns.filter(c => c.id !== titleCol?.id && c.id !== groupColId).slice(0, 3).map(col => (
                  <div key={col.id} className="db-board-card-field">
                    <span className="db-board-card-label">{col.name}:</span>
                    <span>{formatCellPreview(row.cells[col.id])}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <button className="db-btn db-btn-sm db-board-add" onClick={() => {
            onAddRow();
            // Set the group value on the newly added row
            // This is a best-effort approach; the row is added to db.rows and we update it
            setTimeout(() => {
              const lastRowId = document.querySelector('.db-board-card:last-child')?.getAttribute('data-row-id');
              if (lastRowId && groupColId) onCellChange(lastRowId, groupColId, group);
            }, 0);
          }}>
            + Add
          </button>
        </div>
      ))}
    </div>
  );
}

function formatCellPreview(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? '✓' : '✗';
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}
