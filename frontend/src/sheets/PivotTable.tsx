import { useState, useMemo } from 'react';
import { PivotConfig, AggregationType, buildPivot, extractDataFromRange } from './pivotEngine';
import type { WorkbookData, SheetData } from './sheetModel';

interface PivotTableDialogProps {
  workbook: WorkbookData;
  onClose: () => void;
  onCreatePivot: (config: PivotConfig, result: { headers: string[]; rows: string[][] }) => void;
}

type DropZone = 'rows' | 'cols' | 'values' | 'filters';

export default function PivotTableDialog({ workbook, onClose, onCreatePivot }: PivotTableDialogProps) {
  const [sourceRange, setSourceRange] = useState('A1:Z100');
  const [sourceSheet, setSourceSheet] = useState(workbook.activeSheet);
  const [rowFields, setRowFields] = useState<string[]>([]);
  const [colFields, setColFields] = useState<string[]>([]);
  const [valueFields, setValueFields] = useState<{ field: string; aggregation: AggregationType }[]>([]);
  const [filterFields, setFilterFields] = useState<{ field: string; selectedValues: string[] }[]>([]);
  const [showGrandTotals, setShowGrandTotals] = useState(true);
  const [dragField, setDragField] = useState<string | null>(null);

  const sheet = workbook.sheets[sourceSheet];
  const { headers, data } = useMemo(() => extractDataFromRange(sheet, sourceRange), [sheet, sourceRange]);

  // Available fields = headers not yet assigned
  const assigned = new Set([...rowFields, ...colFields, ...valueFields.map(v => v.field), ...filterFields.map(f => f.field)]);
  const availableFields = headers.filter(h => !assigned.has(h));

  const config: PivotConfig = {
    id: '',
    sourceRange,
    sourceSheet,
    rowFields,
    colFields,
    valueFields,
    filterFields,
    showGrandTotals,
  };

  const preview = useMemo(() => {
    if (valueFields.length === 0) return null;
    try {
      return buildPivot(data, config);
    } catch {
      return null;
    }
  }, [data, rowFields, colFields, valueFields, filterFields, showGrandTotals]);

  const handleDrop = (zone: DropZone) => {
    if (!dragField) return;
    // Remove from all zones first
    setRowFields(f => f.filter(x => x !== dragField));
    setColFields(f => f.filter(x => x !== dragField));
    setValueFields(f => f.filter(x => x.field !== dragField));
    setFilterFields(f => f.filter(x => x.field !== dragField));

    switch (zone) {
      case 'rows': setRowFields(f => [...f, dragField!]); break;
      case 'cols': setColFields(f => [...f, dragField!]); break;
      case 'values': setValueFields(f => [...f, { field: dragField!, aggregation: 'SUM' }]); break;
      case 'filters': setFilterFields(f => [...f, { field: dragField!, selectedValues: [] }]); break;
    }
    setDragField(null);
  };

  const removeField = (field: string) => {
    setRowFields(f => f.filter(x => x !== field));
    setColFields(f => f.filter(x => x !== field));
    setValueFields(f => f.filter(x => x.field !== field));
    setFilterFields(f => f.filter(x => x.field !== field));
  };

  const handleCreate = () => {
    if (!preview) return;
    const pivotConfig: PivotConfig = {
      ...config,
      id: `pivot_${Date.now()}`,
    };
    onCreatePivot(pivotConfig, { headers: preview.headers, rows: preview.rows });
  };

  return (
    <div className="sheet-dialog-overlay" style={overlayStyle}>
      <div style={dialogStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>Create Pivot Table</h3>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>

        {/* Source config */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <label style={{ flex: 1 }}>
            <span style={labelStyle}>Source Sheet</span>
            <select value={sourceSheet} onChange={e => setSourceSheet(Number(e.target.value))} style={inputStyle}>
              {workbook.sheets.map((s: SheetData, i: number) => <option key={i} value={i}>{s.name}</option>)}
            </select>
          </label>
          <label style={{ flex: 1 }}>
            <span style={labelStyle}>Data Range</span>
            <input value={sourceRange} onChange={e => setSourceRange(e.target.value.toUpperCase())} style={inputStyle} />
          </label>
        </div>

        {/* Field layout */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          {/* Available fields */}
          <div style={{ flex: 1 }}>
            <div style={labelStyle}>Available Fields</div>
            <div style={fieldListStyle}>
              {availableFields.map(f => (
                <div
                  key={f}
                  draggable
                  onDragStart={() => setDragField(f)}
                  style={fieldChipStyle}
                >
                  {f}
                </div>
              ))}
              {availableFields.length === 0 && <div style={{ color: '#999', fontSize: 11 }}>All fields assigned</div>}
            </div>
          </div>

          {/* Drop zones */}
          <div style={{ flex: 2, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <DropZoneBox label="Filters" zone="filters" fields={filterFields.map(f => f.field)} onDrop={handleDrop} onRemove={removeField} onDragStart={setDragField} />
            <DropZoneBox label="Columns" zone="cols" fields={colFields} onDrop={handleDrop} onRemove={removeField} onDragStart={setDragField} />
            <DropZoneBox label="Rows" zone="rows" fields={rowFields} onDrop={handleDrop} onRemove={removeField} onDragStart={setDragField} />
            <div>
              <div style={labelStyle}>Values</div>
              <div
                style={dropZoneStyle}
                onDragOver={e => e.preventDefault()}
                onDrop={() => handleDrop('values')}
              >
                {valueFields.map(vf => (
                  <div key={vf.field} style={fieldChipStyle}>
                    <span draggable onDragStart={() => setDragField(vf.field)}>{vf.field}</span>
                    <select
                      value={vf.aggregation}
                      onChange={e => setValueFields(fs => fs.map(f => f.field === vf.field ? { ...f, aggregation: e.target.value as AggregationType } : f))}
                      style={{ marginLeft: 4, fontSize: 10, border: 'none', background: 'transparent' }}
                    >
                      <option value="SUM">SUM</option>
                      <option value="COUNT">COUNT</option>
                      <option value="AVERAGE">AVG</option>
                      <option value="MIN">MIN</option>
                      <option value="MAX">MAX</option>
                    </select>
                    <button onClick={() => removeField(vf.field)} style={removeChipStyle}>×</button>
                  </div>
                ))}
                {valueFields.length === 0 && <div style={{ color: '#999', fontSize: 11 }}>Drop value fields here</div>}
              </div>
            </div>
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, fontSize: 12 }}>
          <input type="checkbox" checked={showGrandTotals} onChange={e => setShowGrandTotals(e.target.checked)} />
          Show grand totals
        </label>

        {/* Preview */}
        {preview && (
          <div style={{ marginBottom: 16, maxHeight: 200, overflow: 'auto', border: '1px solid #ddd', borderRadius: 4 }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 11, width: '100%' }}>
              <thead>
                <tr>
                  {preview.headers.map((h, i) => (
                    <th key={i} style={{ border: '1px solid #ddd', padding: '4px 8px', background: '#f5f5f5', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 20).map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td key={ci} style={{ border: '1px solid #ddd', padding: '4px 8px', whiteSpace: 'nowrap' }}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.rows.length > 20 && <div style={{ padding: 4, fontSize: 11, color: '#999' }}>...and {preview.rows.length - 20} more rows</div>}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '6px 16px', fontSize: 13 }}>Cancel</button>
          <button
            onClick={handleCreate}
            disabled={!preview}
            style={{ padding: '6px 16px', fontSize: 13, background: '#4285F4', color: '#fff', border: 'none', borderRadius: 4, cursor: preview ? 'pointer' : 'default', opacity: preview ? 1 : 0.5 }}
          >
            Create Pivot Table
          </button>
        </div>
      </div>
    </div>
  );
}

function DropZoneBox({ label, zone, fields, onDrop, onRemove, onDragStart }: {
  label: string; zone: DropZone; fields: string[];
  onDrop: (zone: DropZone) => void; onRemove: (f: string) => void; onDragStart: (f: string) => void;
}) {
  return (
    <div>
      <div style={labelStyle}>{label}</div>
      <div
        style={dropZoneStyle}
        onDragOver={e => e.preventDefault()}
        onDrop={() => onDrop(zone)}
      >
        {fields.map(f => (
          <div key={f} style={fieldChipStyle} draggable onDragStart={() => onDragStart(f)}>
            {f}
            <button onClick={() => onRemove(f)} style={removeChipStyle}>×</button>
          </div>
        ))}
        {fields.length === 0 && <div style={{ color: '#999', fontSize: 11 }}>Drop fields here</div>}
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000,
};
const dialogStyle: React.CSSProperties = {
  background: '#fff', borderRadius: 8, padding: 24, minWidth: 700, maxWidth: 900, maxHeight: '90vh', overflow: 'auto',
  boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
};
const closeBtnStyle: React.CSSProperties = { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' };
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 };
const inputStyle: React.CSSProperties = { width: '100%', padding: '4px 8px', fontSize: 12, border: '1px solid #ccc', borderRadius: 3, boxSizing: 'border-box' };
const fieldListStyle: React.CSSProperties = { border: '1px solid #ddd', borderRadius: 4, padding: 6, minHeight: 80, display: 'flex', flexWrap: 'wrap', gap: 4, alignContent: 'flex-start' };
const dropZoneStyle: React.CSSProperties = { border: '2px dashed #ccc', borderRadius: 4, padding: 6, minHeight: 60, display: 'flex', flexWrap: 'wrap', gap: 4, alignContent: 'flex-start' };
const fieldChipStyle: React.CSSProperties = { background: '#e8f0fe', padding: '2px 8px', borderRadius: 3, fontSize: 11, cursor: 'grab', display: 'flex', alignItems: 'center', gap: 4 };
const removeChipStyle: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#999', padding: 0 };
