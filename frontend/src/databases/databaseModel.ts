// Database model types for Notion-style structured data

export type ColumnType =
  | 'text'
  | 'number'
  | 'date'
  | 'select'
  | 'multi-select'
  | 'checkbox'
  | 'url'
  | 'email'
  | 'person'
  | 'formula'
  | 'relation'
  | 'rollup';

export type ViewType = 'table' | 'board' | 'gallery' | 'calendar' | 'list';

export interface SelectOption {
  id: string;
  label: string;
  color: string;
}

export interface Column {
  id: string;
  name: string;
  type: ColumnType;
  width?: number;
  options?: SelectOption[];       // for select / multi-select
  formula?: string;               // for formula columns
  relationDbId?: string;          // for relation columns
  rollupRelationColId?: string;   // for rollup
  rollupTargetColId?: string;     // for rollup
  rollupFn?: 'count' | 'sum' | 'avg' | 'min' | 'max'; // for rollup
}

export type CellValue = string | number | boolean | string[] | null;

export interface Row {
  id: string;
  cells: Record<string, CellValue>;
  createdAt: string;
  updatedAt: string;
}

export interface FilterCondition {
  columnId: string;
  operator: 'eq' | 'neq' | 'contains' | 'not_contains' | 'gt' | 'lt' | 'gte' | 'lte' | 'is_empty' | 'is_not_empty';
  value: CellValue;
}

export interface FilterGroup {
  conjunction: 'and' | 'or';
  conditions: FilterCondition[];
}

export interface SortRule {
  columnId: string;
  direction: 'asc' | 'desc';
}

export interface DatabaseView {
  id: string;
  name: string;
  type: ViewType;
  filters: FilterGroup;
  sorts: SortRule[];
  groupByColumnId?: string;
  visibleColumns?: string[];
}

export interface Database {
  id: string;
  title: string;
  columns: Column[];
  rows: Row[];
  views: DatabaseView[];
  activeViewId: string;
  createdAt: string;
  updatedAt: string;
}

// ---------- helpers ----------

let _counter = 0;
export function genId(): string {
  return `${Date.now().toString(36)}-${(++_counter).toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export const SELECT_COLORS = [
  '#e3f2fd', '#fce4ec', '#e8f5e9', '#fff3e0', '#f3e5f5',
  '#e0f7fa', '#fff9c4', '#fbe9e7', '#e8eaf6', '#f1f8e9',
];

export function createDefaultColumn(name: string, type: ColumnType): Column {
  return { id: genId(), name, type };
}

export function createDefaultRow(columns: Column[]): Row {
  const cells: Record<string, CellValue> = {};
  for (const col of columns) {
    cells[col.id] = col.type === 'checkbox' ? false : col.type === 'number' ? 0 : '';
  }
  const now = new Date().toISOString();
  return { id: genId(), cells, createdAt: now, updatedAt: now };
}

export function createDefaultView(type: ViewType = 'table'): DatabaseView {
  return {
    id: genId(),
    name: type.charAt(0).toUpperCase() + type.slice(1) + ' View',
    type,
    filters: { conjunction: 'and', conditions: [] },
    sorts: [],
  };
}

export function createEmptyDatabase(title: string): Database {
  const nameCol = createDefaultColumn('Name', 'text');
  const statusCol: Column = {
    ...createDefaultColumn('Status', 'select'),
    options: [
      { id: genId(), label: 'Not Started', color: SELECT_COLORS[0] },
      { id: genId(), label: 'In Progress', color: SELECT_COLORS[3] },
      { id: genId(), label: 'Done', color: SELECT_COLORS[2] },
    ],
  };
  const view = createDefaultView('table');
  const now = new Date().toISOString();
  return {
    id: genId(),
    title,
    columns: [nameCol, statusCol],
    rows: [createDefaultRow([nameCol, statusCol])],
    views: [view],
    activeViewId: view.id,
    createdAt: now,
    updatedAt: now,
  };
}

// ---------- filtering / sorting ----------

function matchCondition(value: CellValue, cond: FilterCondition): boolean {
  const { operator } = cond;
  if (operator === 'is_empty') return value === null || value === '' || (Array.isArray(value) && value.length === 0);
  if (operator === 'is_not_empty') return !matchCondition(value, { ...cond, operator: 'is_empty' });
  const cv = cond.value;
  const strVal = String(value ?? '').toLowerCase();
  const strCv = String(cv ?? '').toLowerCase();
  switch (operator) {
    case 'eq': return strVal === strCv;
    case 'neq': return strVal !== strCv;
    case 'contains': return strVal.includes(strCv);
    case 'not_contains': return !strVal.includes(strCv);
    case 'gt': return Number(value) > Number(cv);
    case 'lt': return Number(value) < Number(cv);
    case 'gte': return Number(value) >= Number(cv);
    case 'lte': return Number(value) <= Number(cv);
    default: return true;
  }
}

export function applyFilters(rows: Row[], filters: FilterGroup): Row[] {
  if (filters.conditions.length === 0) return rows;
  return rows.filter(row => {
    const results = filters.conditions.map(c => matchCondition(row.cells[c.columnId], c));
    return filters.conjunction === 'and' ? results.every(Boolean) : results.some(Boolean);
  });
}

export function applySorts(rows: Row[], sorts: SortRule[]): Row[] {
  if (sorts.length === 0) return rows;
  return [...rows].sort((a, b) => {
    for (const s of sorts) {
      const va = a.cells[s.columnId];
      const vb = b.cells[s.columnId];
      const sa = String(va ?? '');
      const sb = String(vb ?? '');
      const cmp = sa.localeCompare(sb, undefined, { numeric: true });
      if (cmp !== 0) return s.direction === 'asc' ? cmp : -cmp;
    }
    return 0;
  });
}

export function groupRows(rows: Row[], columnId: string): Map<string, Row[]> {
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const val = String(row.cells[columnId] ?? '(empty)');
    const keys = Array.isArray(row.cells[columnId]) ? (row.cells[columnId] as string[]) : [val];
    for (const key of keys) {
      const k = key || '(empty)';
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(row);
    }
  }
  return groups;
}

// ---------- serialization ----------

export function serializeDatabase(db: Database): string {
  return JSON.stringify(db, null, 2);
}

export function deserializeDatabase(raw: string): Database {
  return JSON.parse(raw) as Database;
}
