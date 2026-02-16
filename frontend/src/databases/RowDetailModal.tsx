import { Row, Column, CellValue } from './databaseModel';
import CellEditor from './CellEditor';

interface Props {
  row: Row;
  columns: Column[];
  onCellChange: (colId: string, value: CellValue) => void;
  onClose: () => void;
  onDelete: () => void;
}

export default function RowDetailModal({ row, columns, onCellChange, onClose, onDelete }: Props) {
  if (!row) return null;

  return (
    <div className="db-modal-overlay" onClick={onClose}>
      <div className="db-modal" onClick={e => e.stopPropagation()}>
        <div className="db-modal-header">
          <h3>Row Details</h3>
          <div className="db-modal-actions">
            <button className="db-btn db-btn-danger" onClick={onDelete}>Delete</button>
            <button className="db-btn" onClick={onClose}>×</button>
          </div>
        </div>
        <div className="db-modal-body">
          {columns.map(col => (
            <div key={col.id} className="db-modal-field">
              <label className="db-modal-label">{col.name}</label>
              <div className="db-modal-value">
                <CellEditor column={col} value={row.cells[col.id]} onChange={v => onCellChange(col.id, v)} />
              </div>
            </div>
          ))}
        </div>
        <div className="db-modal-footer">
          <span className="db-modal-meta">Created: {new Date(row.createdAt).toLocaleString()}</span>
          <span className="db-modal-meta">Updated: {new Date(row.updatedAt).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}
