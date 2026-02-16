import { ViewProps } from './viewTypes';

export default function GalleryView({ columns, rows, onRowClick }: ViewProps) {
  const titleCol = columns[0];
  const previewCols = columns.slice(1, 4);

  return (
    <div className="db-gallery">
      {rows.map(row => (
        <div key={row.id} className="db-gallery-card" onClick={() => onRowClick(row.id)}>
          <div className="db-gallery-card-thumb">
            {titleCol ? String(row.cells[titleCol.id] ?? '').charAt(0).toUpperCase() || '?' : '?'}
          </div>
          <div className="db-gallery-card-body">
            <div className="db-gallery-card-title">{String(row.cells[titleCol?.id] ?? 'Untitled')}</div>
            {previewCols.map(col => (
              <div key={col.id} className="db-gallery-card-field">
                <span className="db-gallery-label">{col.name}</span>
                <span>{formatValue(row.cells[col.id])}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? '✓' : '✗';
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
}
