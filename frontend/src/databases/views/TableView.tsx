import { useState } from 'react';
import { ViewProps } from './viewTypes';
import { ColumnType } from '../databaseModel';
import CellEditor from '../CellEditor';

const COL_TYPES: { value: ColumnType; label: string }[] = [
  { value: 'text', label: 'Text' }, { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' }, { value: 'select', label: 'Select' },
  { value: 'multi-select', label: 'Multi-Select' }, { value: 'checkbox', label: 'Checkbox' },
  { value: 'url', label: 'URL' }, { value: 'email', label: 'Email' },
  { value: 'person', label: 'Person' },
];

export default function TableView({ columns, rows, grouped, onCellChange, onRowClick, onAddRow, onAddColumn, onUpdateColumn, onDeleteColumn }: ViewProps) {
  const [editingColId, setEditingColId] = useState<string | null>(null);

  const renderRows = (rowList: typeof rows) => rowList.map(row => (
    <tr key={row.id} className="db-table-row" onClick={() => onRowClick(row.id)}>
      {columns.map(col => (
        <td key={col.id} className="db-table-cell" onClick={e => e.stopPropagation()}>
          <CellEditor column={col} value={row.cells[col.id]} onChange={v => onCellChange(row.id, col.id, v)} inline />
        </td>
      ))}
    </tr>
  ));

  return (
    <div className="db-table-wrapper">
      <table className="db-table">
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.id} className="db-table-header">
                {editingColId === col.id ? (
                  <div className="db-col-edit" onClick={e => e.stopPropagation()}>
                    <input
                      value={col.name}
                      onChange={e => onUpdateColumn(col.id, { name: e.target.value })}
                      onBlur={() => setEditingColId(null)}
                      onKeyDown={e => { if (e.key === 'Enter') setEditingColId(null); }}
                      autoFocus
                    />
                    <select value={col.type} onChange={e => { onUpdateColumn(col.id, { type: e.target.value as ColumnType }); }}>
                      {COL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <button className="db-btn db-btn-sm db-btn-danger" onClick={() => { onDeleteColumn(col.id); setEditingColId(null); }}>Delete</button>
                  </div>
                ) : (
                  <span onDoubleClick={() => setEditingColId(col.id)}>{col.name}</span>
                )}
              </th>
            ))}
            <th className="db-table-header db-table-add-col">
              <button className="db-btn db-btn-sm" onClick={() => onAddColumn('text')}>+</button>
            </th>
          </tr>
        </thead>
        <tbody>
          {grouped ? (
            Array.from(grouped.entries()).map(([group, groupRows]) => (
              <GroupSection key={group} label={group} rows={groupRows} renderRows={renderRows} colSpan={columns.length + 1} />
            ))
          ) : renderRows(rows)}
        </tbody>
      </table>
      <button className="db-btn db-add-row-btn" onClick={onAddRow}>+ New Row</button>
    </div>
  );
}

function GroupSection({ label, rows, renderRows, colSpan }: { label: string; rows: typeof TableView extends (p: infer P) => unknown ? P extends { rows: infer R } ? R : never : never; renderRows: (r: typeof rows) => React.ReactNode; colSpan: number }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <tr className="db-group-header" onClick={() => setOpen(!open)}>
        <td colSpan={colSpan}>{open ? '▼' : '▶'} {label} ({rows.length})</td>
      </tr>
      {open && renderRows(rows)}
    </>
  );
}
