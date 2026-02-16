import { useState, useMemo, useCallback } from 'react';
import type { WorkbookData, SheetData, ChartConfig, ChartType } from './sheetModel';
import { PivotConfig, buildPivot, extractDataFromRange } from './pivotEngine';

interface PivotChartDialogProps {
  workbook: WorkbookData;
  pivotConfig: PivotConfig;
  onInsert: (config: Omit<ChartConfig, 'id' | 'x' | 'y'>) => void;
  onClose: () => void;
}

function suggestChartType(result: { headers: string[]; rows: string[][] }, config: PivotConfig): ChartType {
  const numRows = result.rows.length;
  const numValues = config.valueFields.length;
  if (numValues === 1 && numRows <= 6) return 'pie';
  if (config.colFields.length > 0) return 'bar';
  if (numRows > 10) return 'line';
  return 'bar';
}

export function PivotChartDialog({ workbook, pivotConfig, onInsert, onClose }: PivotChartDialogProps) {
  const sheet = workbook.sheets[pivotConfig.sourceSheet] as SheetData | undefined;
  const { data } = useMemo(() => {
    if (!sheet) return { headers: [] as string[], data: [] as Record<string, string>[] };
    return extractDataFromRange(sheet, pivotConfig.sourceRange);
  }, [sheet, pivotConfig.sourceRange]);

  const pivotResult = useMemo(() => {
    try { return buildPivot(data, pivotConfig); } catch { return null; }
  }, [data, pivotConfig]);

  const suggested = useMemo(() => pivotResult ? suggestChartType(pivotResult, pivotConfig) : 'bar' as ChartType, [pivotResult, pivotConfig]);
  const [chartType, setChartType] = useState<ChartType>(suggested);
  const [title, setTitle] = useState(`Pivot Chart - ${pivotConfig.valueFields.map(v => v.field).join(', ')}`);

  const handleInsert = useCallback(() => {
    if (!pivotResult) return;
    // Build label and data ranges from pivot result
    // We encode pivot data as a special range marker so SheetChart can render
    const labelCount = pivotConfig.rowFields.length;
    // Create labels from row keys
    const labels = pivotResult.rows.map(r => r.slice(0, labelCount).join(' / '));
    // First value column
    const values = pivotResult.rows.map(r => r[labelCount] || '0');

    onInsert({
      type: chartType,
      dataRange: `__PIVOT_DATA__${JSON.stringify(values)}`,
      labelRange: `__PIVOT_LABELS__${JSON.stringify(labels)}`,
      title,
      width: 450,
      height: 320,
    });
  }, [pivotResult, pivotConfig, chartType, title, onInsert]);

  if (!pivotResult || pivotResult.rows.length === 0) {
    return (
      <div style={overlayStyle}>
        <div style={dialogStyle}>
          <h3 style={{ margin: '0 0 12px' }}>Pivot Chart</h3>
          <p>No pivot data available. Create a pivot table first.</p>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <div style={overlayStyle}>
      <div style={dialogStyle}>
        <h3 style={{ margin: '0 0 16px' }}>Create Pivot Chart</h3>
        <label style={{ display: 'block', marginBottom: 8 }}>
          Chart Type:
          <select value={chartType} onChange={e => setChartType(e.target.value as ChartType)} style={{ marginLeft: 8 }}>
            <option value="bar">Bar</option>
            <option value="line">Line</option>
            <option value="pie">Pie</option>
            <option value="area">Area</option>
          </select>
        </label>
        <label style={{ display: 'block', marginBottom: 8 }}>
          Title:
          <input value={title} onChange={e => setTitle(e.target.value)} style={{ marginLeft: 8, width: 220 }} />
        </label>
        <div style={{ marginBottom: 12, fontSize: 12, color: '#666' }}>
          Data: {pivotResult.rows.length} rows, {pivotConfig.valueFields.length} value field(s)
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose}>Cancel</button>
          <button onClick={handleInsert} style={{ background: '#4285F4', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: 4, cursor: 'pointer' }}>
            Insert Chart
          </button>
        </div>
      </div>
    </div>
  );
}

// Button shown when pivot tables exist
interface PivotChartButtonProps {
  workbook: WorkbookData;
  onInsertChart: (config: Omit<ChartConfig, 'id' | 'x' | 'y'>) => void;
}

export function PivotChartButton({ workbook, onInsertChart }: PivotChartButtonProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [selectedPivot, setSelectedPivot] = useState(0);

  if (!workbook.pivotTables || workbook.pivotTables.length === 0) return null;

  return (
    <>
      <button
        className="sheet-tb-btn"
        onClick={() => setShowDialog(true)}
        title="Create Pivot Chart"
        style={{ fontSize: 11 }}
      >
        📊 Pivot Chart
      </button>
      {showDialog && (
        <div style={overlayStyle}>
          <div style={dialogStyle}>
            <h3 style={{ margin: '0 0 12px' }}>Select Pivot Table</h3>
            <select value={selectedPivot} onChange={e => setSelectedPivot(Number(e.target.value))} style={{ marginBottom: 12, width: '100%' }}>
              {workbook.pivotTables.map((pt, i) => (
                <option key={pt.id} value={i}>{pt.id} ({pt.rowFields.join(', ')} → {pt.valueFields.map(v => v.field).join(', ')})</option>
              ))}
            </select>
            <PivotChartDialog
              workbook={workbook}
              pivotConfig={workbook.pivotTables[selectedPivot]}
              onInsert={(config) => { onInsertChart(config); setShowDialog(false); }}
              onClose={() => setShowDialog(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000,
};
const dialogStyle: React.CSSProperties = {
  background: '#fff', borderRadius: 8, padding: 24, minWidth: 380,
  boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
};
