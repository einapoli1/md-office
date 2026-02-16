import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Database, Column, CellValue, DatabaseView, ViewType,
  genId, createDefaultColumn, createDefaultRow, createDefaultView,
  applyFilters, applySorts, groupRows, serializeDatabase, deserializeDatabase,
} from './databaseModel';
import { DATABASE_TEMPLATES } from './databaseTemplates';
import TableView from './views/TableView';
import BoardView from './views/BoardView';
import GalleryView from './views/GalleryView';
import CalendarView from './views/CalendarView';
import ListView from './views/ListView';
import RowDetailModal from './RowDetailModal';
import FilterSortPanel from './FilterSortPanel';
import './database.css';

interface Props {
  initialData: string;
  onSave: (data: string) => void;
}

export default function DatabaseEditor({ initialData, onSave }: Props) {
  const [db, setDb] = useState<Database>(() => {
    try {
      return deserializeDatabase(initialData);
    } catch {
      // If invalid, create empty database
      const { createEmptyDatabase } = require('./databaseModel');
      return createEmptyDatabase('Untitled Database');
    }
  });
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [showFilterSort, setShowFilterSort] = useState(false);
  const [showNewViewMenu, setShowNewViewMenu] = useState(false);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);

  const activeView = useMemo(() => db.views.find(v => v.id === db.activeViewId) ?? db.views[0], [db]);

  const processedRows = useMemo(() => {
    let rows = applyFilters(db.rows, activeView.filters);
    rows = applySorts(rows, activeView.sorts);
    return rows;
  }, [db.rows, activeView.filters, activeView.sorts]);

  const grouped = useMemo(() => {
    if (!activeView.groupByColumnId) return null;
    return groupRows(processedRows, activeView.groupByColumnId);
  }, [processedRows, activeView.groupByColumnId]);

  // Persist on change
  useEffect(() => {
    const timer = setTimeout(() => onSave(serializeDatabase(db)), 300);
    return () => clearTimeout(timer);
  }, [db, onSave]);

  const update = useCallback((fn: (d: Database) => Database) => {
    setDb(prev => {
      const next = fn(prev);
      next.updatedAt = new Date().toISOString();
      return { ...next };
    });
  }, []);

  // Row CRUD
  const addRow = useCallback(() => {
    update(d => ({ ...d, rows: [...d.rows, createDefaultRow(d.columns)] }));
  }, [update]);

  const updateCell = useCallback((rowId: string, colId: string, value: CellValue) => {
    update(d => ({
      ...d,
      rows: d.rows.map(r => r.id === rowId ? { ...r, cells: { ...r.cells, [colId]: value }, updatedAt: new Date().toISOString() } : r),
    }));
  }, [update]);

  const deleteRow = useCallback((rowId: string) => {
    update(d => ({ ...d, rows: d.rows.filter(r => r.id !== rowId) }));
  }, [update]);

  // Column CRUD
  const addColumn = useCallback((type: Column['type'] = 'text') => {
    update(d => {
      const col = createDefaultColumn(`Column ${d.columns.length + 1}`, type);
      const rows = d.rows.map(r => ({ ...r, cells: { ...r.cells, [col.id]: col.type === 'checkbox' ? false : '' } }));
      return { ...d, columns: [...d.columns, col], rows };
    });
  }, [update]);

  const updateColumn = useCallback((colId: string, changes: Partial<Column>) => {
    update(d => ({
      ...d,
      columns: d.columns.map(c => c.id === colId ? { ...c, ...changes } : c),
    }));
  }, [update]);

  const deleteColumn = useCallback((colId: string) => {
    update(d => ({
      ...d,
      columns: d.columns.filter(c => c.id !== colId),
      rows: d.rows.map(r => {
        const cells = { ...r.cells };
        delete cells[colId];
        return { ...r, cells };
      }),
    }));
  }, [update]);

  // View management
  const setActiveView = useCallback((viewId: string) => {
    update(d => ({ ...d, activeViewId: viewId }));
  }, [update]);

  const addView = useCallback((type: ViewType) => {
    const view = createDefaultView(type);
    update(d => ({ ...d, views: [...d.views, view], activeViewId: view.id }));
    setShowNewViewMenu(false);
  }, [update]);

  const updateView = useCallback((viewId: string, changes: Partial<DatabaseView>) => {
    update(d => ({
      ...d,
      views: d.views.map(v => v.id === viewId ? { ...v, ...changes } : v),
    }));
  }, [update]);

  const deleteView = useCallback((viewId: string) => {
    update(d => {
      const views = d.views.filter(v => v.id !== viewId);
      if (views.length === 0) views.push(createDefaultView('table'));
      return { ...d, views, activeViewId: views[0].id };
    });
  }, [update]);

  const applyTemplate = useCallback((templateId: string) => {
    const tmpl = DATABASE_TEMPLATES.find(t => t.id === templateId);
    if (tmpl) setDb(tmpl.create());
    setShowTemplateMenu(false);
  }, []);

  const updateTitle = useCallback((title: string) => {
    update(d => ({ ...d, title }));
  }, [update]);

  const viewProps = {
    columns: db.columns,
    rows: processedRows,
    grouped,
    activeView,
    onCellChange: updateCell,
    onRowClick: setSelectedRowId,
    onAddRow: addRow,
    onDeleteRow: deleteRow,
    onAddColumn: addColumn,
    onUpdateColumn: updateColumn,
    onDeleteColumn: deleteColumn,
  };

  const VIEW_ICONS: Record<ViewType, string> = {
    table: '☰', board: '▦', gallery: '▤', calendar: '📅', list: '☷',
  };

  return (
    <div className="database-editor">
      {/* Header */}
      <div className="db-header">
        <input
          className="db-title"
          value={db.title}
          onChange={e => updateTitle(e.target.value)}
          placeholder="Untitled Database"
        />
        <div className="db-actions">
          <div className="db-template-menu-wrapper" style={{ position: 'relative' }}>
            <button className="db-btn" onClick={() => setShowTemplateMenu(!showTemplateMenu)}>
              📄 Templates
            </button>
            {showTemplateMenu && (
              <div className="db-dropdown">
                {DATABASE_TEMPLATES.map(t => (
                  <button key={t.id} className="db-dropdown-item" onClick={() => applyTemplate(t.id)}>
                    {t.icon} {t.name}
                    <span className="db-dropdown-desc">{t.description}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="db-btn" onClick={() => setShowFilterSort(!showFilterSort)}>
            🔍 Filter &amp; Sort
          </button>
        </div>
      </div>

      {/* View tabs */}
      <div className="db-view-tabs">
        {db.views.map(v => (
          <div
            key={v.id}
            className={`db-view-tab ${v.id === db.activeViewId ? 'active' : ''}`}
            onClick={() => setActiveView(v.id)}
          >
            <span>{VIEW_ICONS[v.type]} {v.name}</span>
            {db.views.length > 1 && (
              <button
                className="db-view-tab-close"
                onClick={e => { e.stopPropagation(); deleteView(v.id); }}
              >×</button>
            )}
          </div>
        ))}
        <div className="db-new-view-wrapper" style={{ position: 'relative' }}>
          <button className="db-btn db-btn-sm" onClick={() => setShowNewViewMenu(!showNewViewMenu)}>+ View</button>
          {showNewViewMenu && (
            <div className="db-dropdown">
              {(['table', 'board', 'gallery', 'calendar', 'list'] as ViewType[]).map(t => (
                <button key={t} className="db-dropdown-item" onClick={() => addView(t)}>
                  {VIEW_ICONS[t]} {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Filter/Sort panel */}
      {showFilterSort && (
        <FilterSortPanel
          view={activeView}
          columns={db.columns}
          onUpdateView={(changes) => updateView(activeView.id, changes)}
          onClose={() => setShowFilterSort(false)}
        />
      )}

      {/* View content */}
      <div className="db-view-content">
        {activeView.type === 'table' && <TableView {...viewProps} />}
        {activeView.type === 'board' && <BoardView {...viewProps} />}
        {activeView.type === 'gallery' && <GalleryView {...viewProps} />}
        {activeView.type === 'calendar' && <CalendarView {...viewProps} />}
        {activeView.type === 'list' && <ListView {...viewProps} />}
      </div>

      {/* Row detail modal */}
      {selectedRowId && (
        <RowDetailModal
          row={db.rows.find(r => r.id === selectedRowId)!}
          columns={db.columns}
          onCellChange={(colId, value) => updateCell(selectedRowId, colId, value)}
          onClose={() => setSelectedRowId(null)}
          onDelete={() => { deleteRow(selectedRowId); setSelectedRowId(null); }}
        />
      )}
    </div>
  );
}

// New database picker shown when creating a new .db.json file
export function DatabasePicker({ onCreate }: { onCreate: (db: Database) => void }) {
  return (
    <div className="db-picker">
      <h2>Create a Database</h2>
      <div className="db-picker-grid">
        <button className="db-picker-card" onClick={() => {
          const { createEmptyDatabase } = require('./databaseModel');
          onCreate(createEmptyDatabase('Untitled Database'));
        }}>
          <span className="db-picker-icon">📊</span>
          <span>Empty Database</span>
        </button>
        {DATABASE_TEMPLATES.map(t => (
          <button key={t.id} className="db-picker-card" onClick={() => onCreate(t.create())}>
            <span className="db-picker-icon">{t.icon}</span>
            <span>{t.name}</span>
            <small>{t.description}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

export { genId };
