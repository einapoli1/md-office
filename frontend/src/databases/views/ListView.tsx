import { ViewProps } from './viewTypes';

export default function ListView({ columns, rows, onRowClick, onAddRow }: ViewProps) {
  const titleCol = columns[0];
  const previewCols = columns.slice(1, 5);

  return (
    <div className="db-list">
      {rows.map(row => (
        <div key={row.id} className="db-list-item" onClick={() => onRowClick(row.id)}>
          <div className="db-list-item-title">{String(row.cells[titleCol?.id] ?? 'Untitled')}</div>
          <div className="db-list-item-fields">
            {previewCols.map(col => (
              <span key={col.id} className="db-list-item-field">
                <span className="db-list-item-label">{col.name}:</span> {formatValue(row.cells[col.id])}
              </span>
            ))}
          </div>
        </div>
      ))}
      <button className="db-btn db-add-row-btn" onClick={onAddRow}>+ New Row</button>
    </div>
  );
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? '✓' : '✗';
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
}
