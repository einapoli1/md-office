import { DatabaseView, Column, FilterCondition, SortRule, genId } from './databaseModel';

interface Props {
  view: DatabaseView;
  columns: Column[];
  onUpdateView: (changes: Partial<DatabaseView>) => void;
  onClose: () => void;
}

const OPERATORS = [
  { value: 'eq', label: '=' },
  { value: 'neq', label: '≠' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'not contains' },
  { value: 'gt', label: '>' },
  { value: 'lt', label: '<' },
  { value: 'gte', label: '≥' },
  { value: 'lte', label: '≤' },
  { value: 'is_empty', label: 'is empty' },
  { value: 'is_not_empty', label: 'is not empty' },
] as const;

export default function FilterSortPanel({ view, columns, onUpdateView, onClose }: Props) {
  const { filters, sorts } = view;

  const addFilter = () => {
    if (columns.length === 0) return;
    const cond: FilterCondition = { columnId: columns[0].id, operator: 'contains', value: '' };
    onUpdateView({ filters: { ...filters, conditions: [...filters.conditions, cond] } });
  };

  const updateFilter = (idx: number, changes: Partial<FilterCondition>) => {
    const conditions = filters.conditions.map((c, i) => i === idx ? { ...c, ...changes } : c);
    onUpdateView({ filters: { ...filters, conditions } });
  };

  const removeFilter = (idx: number) => {
    onUpdateView({ filters: { ...filters, conditions: filters.conditions.filter((_, i) => i !== idx) } });
  };

  const addSort = () => {
    if (columns.length === 0) return;
    const rule: SortRule = { columnId: columns[0].id, direction: 'asc' };
    onUpdateView({ sorts: [...sorts, rule] });
  };

  const updateSort = (idx: number, changes: Partial<SortRule>) => {
    onUpdateView({ sorts: sorts.map((s, i) => i === idx ? { ...s, ...changes } : s) });
  };

  const removeSort = (idx: number) => {
    onUpdateView({ sorts: sorts.filter((_, i) => i !== idx) });
  };

  return (
    <div className="db-filter-sort-panel">
      <div className="db-panel-header">
        <h4>Filters &amp; Sorting</h4>
        <button className="db-btn db-btn-sm" onClick={onClose}>×</button>
      </div>

      {/* Filters */}
      <div className="db-panel-section">
        <div className="db-panel-section-header">
          <span>Filters</span>
          <select
            value={filters.conjunction}
            onChange={e => onUpdateView({ filters: { ...filters, conjunction: e.target.value as 'and' | 'or' } })}
            className="db-conjunction-select"
          >
            <option value="and">AND</option>
            <option value="or">OR</option>
          </select>
          <button className="db-btn db-btn-sm" onClick={addFilter}>+ Add</button>
        </div>
        {filters.conditions.map((cond, idx) => (
          <div key={`f-${genId()}-${idx}`} className="db-filter-row">
            <select value={cond.columnId} onChange={e => updateFilter(idx, { columnId: e.target.value })}>
              {columns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={cond.operator} onChange={e => updateFilter(idx, { operator: e.target.value as FilterCondition['operator'] })}>
              {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {!['is_empty', 'is_not_empty'].includes(cond.operator) && (
              <input
                value={String(cond.value ?? '')}
                onChange={e => updateFilter(idx, { value: e.target.value })}
                placeholder="Value..."
              />
            )}
            <button className="db-btn db-btn-sm db-btn-danger" onClick={() => removeFilter(idx)}>×</button>
          </div>
        ))}
        {filters.conditions.length === 0 && <div className="db-empty-hint">No filters applied</div>}
      </div>

      {/* Sorts */}
      <div className="db-panel-section">
        <div className="db-panel-section-header">
          <span>Sorting</span>
          <button className="db-btn db-btn-sm" onClick={addSort}>+ Add</button>
        </div>
        {sorts.map((sort, idx) => (
          <div key={`s-${idx}`} className="db-filter-row">
            <select value={sort.columnId} onChange={e => updateSort(idx, { columnId: e.target.value })}>
              {columns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={sort.direction} onChange={e => updateSort(idx, { direction: e.target.value as 'asc' | 'desc' })}>
              <option value="asc">A → Z</option>
              <option value="desc">Z → A</option>
            </select>
            <button className="db-btn db-btn-sm db-btn-danger" onClick={() => removeSort(idx)}>×</button>
          </div>
        ))}
        {sorts.length === 0 && <div className="db-empty-hint">No sorting applied</div>}
      </div>

      {/* Grouping */}
      <div className="db-panel-section">
        <div className="db-panel-section-header">
          <span>Group by</span>
        </div>
        <select
          value={view.groupByColumnId ?? ''}
          onChange={e => onUpdateView({ groupByColumnId: e.target.value || undefined })}
        >
          <option value="">None</option>
          {columns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
    </div>
  );
}
