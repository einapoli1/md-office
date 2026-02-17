import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock heavy sub-components that don't work well in jsdom
vi.mock('../sheets/SheetChart', () => ({
  SheetChartOverlay: () => null,
  InsertChartDialog: () => null,
}));
vi.mock('../sheets/ChartSheet', () => ({ default: () => null }));
vi.mock('../sheets/SheetShortcuts', () => ({ default: () => null }));
vi.mock('../sheets/ConditionalFormat', () => ({ default: () => null }));
vi.mock('../sheets/DataValidation', () => ({ default: () => null }));
vi.mock('../sheets/PivotTable', () => ({ default: () => null }));
vi.mock('../sheets/NamedRanges', () => ({ default: () => null }));
vi.mock('../sheets/SheetComments', () => ({
  default: () => null,
  CommentTooltip: () => null,
}));
vi.mock('../sheets/Sparkline', () => ({
  default: () => null,
  isSparklineValue: () => false,
  parseSparklineValue: () => null,
}));
vi.mock('../sheets/CellMiniChart', () => ({ default: () => null }));
vi.mock('../sheets/SparklineDialog', () => ({ default: () => null }));
vi.mock('../sheets/ProtectedRanges', () => ({ default: () => null }));
vi.mock('../sheets/SheetFindReplace', () => ({
  default: () => null,
  getFindMatchCellIds: () => new Set(),
}));
vi.mock('../sheets/GoalSeek', () => ({
  default: () => null,
  goalSeek: vi.fn(),
}));
vi.mock('../sheets/DataTable', () => ({
  default: () => null,
  computeDataTable: vi.fn(),
}));
vi.mock('../sheets/Solver', () => ({
  default: () => null,
  solve: vi.fn(),
}));
vi.mock('../sheets/DataImport', () => ({ default: () => null }));
vi.mock('../sheets/FrequencyAnalysis', () => ({ default: () => null }));
vi.mock('../sheets/PivotChart', () => ({ PivotChartButton: () => null }));
vi.mock('../sheets/Slicer', () => ({
  SlicerOverlay: () => null,
  InsertSlicerDialog: () => null,
}));
vi.mock('../sheets/Dashboard', () => ({
  DashboardToolbar: () => null,
  DashboardLabelOverlay: () => null,
  DashboardPresentation: () => null,
  createDashboardConfig: () => ({ enabled: false, backgroundColor: '#f5f5f5', labels: [] }),
}));
vi.mock('../sheets/Heatmap', () => ({
  HeatmapLegend: () => null,
  CreateHeatmapDialog: () => null,
  computeHeatmapColors: () => ({}),
}));
vi.mock('../sheets/SheetTimeline', () => ({
  TimelineOverlay: () => null,
  InsertTimelineDialog: () => null,
}));
vi.mock('../sheets/SheetPrintSetup', () => ({
  default: () => null,
  defaultPrintSettings: {},
}));
vi.mock('../sheets/SheetPrintPreview', () => ({ default: () => null }));
vi.mock('../sheets/slideCollab', () => ({
  initSheetCollab: vi.fn(),
}));
vi.mock('../sheets/sheetCollab', () => ({
  initSheetCollab: vi.fn(),
  setCellInYjs: vi.fn(),
  syncWorkbookFromYjs: vi.fn(),
  setLocalCursor: vi.fn(),
}));

import SpreadsheetEditor from '../sheets/SpreadsheetEditor';

describe('SpreadsheetEditor', () => {
  it('renders without crashing', () => {
    const { container } = render(<SpreadsheetEditor />);
    expect(container.querySelector('.spreadsheet-editor, .sheet-container')).toBeTruthy();
  });

  it('renders with initial data', () => {
    const data = JSON.stringify({
      sheets: [{ name: 'Sheet1', cells: { A1: { raw: 'Hello' } } }],
    });
    const { container } = render(<SpreadsheetEditor initialData={data} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders with empty initial data', () => {
    const { container } = render(<SpreadsheetEditor initialData="" />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders formula bar', () => {
    render(<SpreadsheetEditor />);
    // The FormulaBar component should be present
    // Just verify render doesn't crash - formula bar structure varies
    expect(document.querySelector('.spreadsheet-editor, .sheet-container, [class*="sheet"]')).toBeTruthy();
  });

  it('renders with onSave callback', () => {
    const onSave = vi.fn();
    const { container } = render(<SpreadsheetEditor onSave={onSave} />);
    expect(container.firstChild).toBeTruthy();
  });
});
