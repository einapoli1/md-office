import { Row, Column, DatabaseView, CellValue } from '../databaseModel';

export interface ViewProps {
  columns: Column[];
  rows: Row[];
  grouped: Map<string, Row[]> | null;
  activeView: DatabaseView;
  onCellChange: (rowId: string, colId: string, value: CellValue) => void;
  onRowClick: (rowId: string) => void;
  onAddRow: () => void;
  onDeleteRow: (rowId: string) => void;
  onAddColumn: (type?: Column['type']) => void;
  onUpdateColumn: (colId: string, changes: Partial<Column>) => void;
  onDeleteColumn: (colId: string) => void;
}
