import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  X, Upload, ClipboardPaste, Table, ChevronRight, ChevronLeft,
  FileText, Files, Printer, Download, Check,
} from 'lucide-react';
import { extractVariables, parseCSV } from '../lib/templateEngine';
import { generateMailMerge, MergeOutputOptions } from '../lib/mailMergePDF';
import MailMergePreview from './MailMergePreview';

interface MailMergeWizardProps {
  template: string;
  onClose: () => void;
}

type Step = 1 | 2 | 3 | 4;

const STEP_LABELS: Record<Step, string> = {
  1: 'Data Source',
  2: 'Map Columns',
  3: 'Preview',
  4: 'Output',
};

const MailMergeWizard: React.FC<MailMergeWizardProps> = ({ template, onClose }) => {
  const [step, setStep] = useState<Step>(1);
  const [dataRows, setDataRows] = useState<Record<string, string>[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const [previewIndex, setPreviewIndex] = useState(0);
  const [filenameTemplate, setFilenameTemplate] = useState('document_{index}');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [manualRows, setManualRows] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const variables = useMemo(() => extractVariables(template), [template]);
  const dataColumns = useMemo(
    () => (dataRows.length > 0 ? Object.keys(dataRows[0]) : []),
    [dataRows],
  );

  // Auto-map columns → variables by name match
  const autoMap = useCallback(
    (cols: string[]) => {
      const map: Record<string, string> = {};
      variables.forEach((v) => {
        const lower = v.toLowerCase();
        const match = cols.find((c) => c.toLowerCase() === lower);
        if (match) map[v] = match;
      });
      setColumnMap(map);
    },
    [variables],
  );

  // ---- Step 1 handlers ----
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      let rows: Record<string, string>[] = [];
      if (file.name.endsWith('.csv')) {
        rows = parseCSV(text);
      } else {
        try {
          const parsed = JSON.parse(text);
          rows = Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          alert('Invalid JSON');
          return;
        }
      }
      setDataRows(rows);
      autoMap(Object.keys(rows[0] ?? {}));
      setStep(2);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const rows = parseCSV(text);
      if (rows.length === 0) {
        alert('Could not parse clipboard as CSV');
        return;
      }
      setDataRows(rows);
      autoMap(Object.keys(rows[0]));
      setStep(2);
    } catch {
      alert('Clipboard access denied');
    }
  };

  const handleManualEntry = () => {
    // Parse textarea as CSV
    const text = manualRows.trim();
    if (!text) return;
    const rows = parseCSV(text);
    if (rows.length === 0) {
      alert('Enter header row + at least one data row');
      return;
    }
    setDataRows(rows);
    autoMap(Object.keys(rows[0]));
    setStep(2);
  };

  // ---- Apply column mapping to produce final rows ----
  const mappedRows = useMemo(() => {
    // If map is identity (col name == var name), return raw rows
    const needsMapping = Object.entries(columnMap).some(([v, c]) => v !== c);
    if (!needsMapping) return dataRows;
    return dataRows.map((row) => {
      const mapped: Record<string, string> = { ...row };
      Object.entries(columnMap).forEach(([variable, column]) => {
        if (variable !== column) {
          mapped[variable] = row[column] ?? '';
        }
      });
      return mapped;
    });
  }, [dataRows, columnMap]);

  // ---- Step 4: generate ----
  const handleGenerate = async (mode: MergeOutputOptions['mode']) => {
    setProgress({ done: 0, total: mappedRows.length });
    try {
      await generateMailMerge(template, mappedRows, {
        mode,
        filenameTemplate,
        onProgress: (done, total) => setProgress({ done, total }),
      });
    } finally {
      setTimeout(() => setProgress(null), 1000);
    }
  };

  return (
    <div style={overlay}>
      <div style={dialog}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            {([1, 2, 3, 4] as Step[]).map((s) => (
              <span
                key={s}
                style={{
                  fontSize: 12,
                  fontWeight: step === s ? 700 : 400,
                  color: step === s ? '#1a73e8' : step > s ? '#4caf50' : '#999',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                {step > s ? <Check size={12} /> : <span style={stepCircle(step === s)}>{s}</span>}
                {STEP_LABELS[s]}
                {s < 4 && <ChevronRight size={12} style={{ color: '#ccc', marginLeft: 4 }} />}
              </span>
            ))}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          {/* Step 1: Data source */}
          {step === 1 && (
            <div>
              <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Choose Data Source</h3>
              <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
                Found <strong>{variables.length}</strong> template variables: {variables.map((v) => `{{${v}}}`).join(', ') || 'none'}
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <input ref={fileRef} type="file" accept=".csv,.json" onChange={handleFile} style={{ display: 'none' }} />
                <button onClick={() => fileRef.current?.click()} style={sourceBtn}>
                  <Upload size={20} /> Upload CSV
                </button>
                <button onClick={() => { if (fileRef.current) { fileRef.current.accept = '.json'; fileRef.current.click(); fileRef.current.accept = '.csv,.json'; } }} style={sourceBtn}>
                  <FileText size={20} /> Upload JSON
                </button>
                <button onClick={handlePaste} style={sourceBtn}>
                  <ClipboardPaste size={20} /> Paste from Clipboard
                </button>
              </div>
              <div style={{ marginTop: 20 }}>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                  <Table size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
                  Or enter data manually (CSV format):
                </label>
                <textarea
                  value={manualRows}
                  onChange={(e) => setManualRows(e.target.value)}
                  placeholder={`name,email,amount\nJohn,john@example.com,100\nJane,jane@example.com,200`}
                  rows={6}
                  style={{ width: '100%', fontFamily: 'monospace', fontSize: 12, padding: 8, border: '1px solid #ddd', borderRadius: 6, boxSizing: 'border-box' }}
                />
                <button onClick={handleManualEntry} disabled={!manualRows.trim()} style={{ ...primaryBtn, marginTop: 8 }}>
                  Use This Data
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Column mapping */}
          {step === 2 && (
            <div>
              <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Map Columns to Variables</h3>
              <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
                {dataRows.length} records loaded. Map each template variable to a data column.
              </p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Template Variable</th>
                    <th style={thStyle}>Data Column</th>
                    <th style={thStyle}>Sample Value</th>
                  </tr>
                </thead>
                <tbody>
                  {variables.map((v) => (
                    <tr key={v}>
                      <td style={tdStyle}><code>{`{{${v}}}`}</code></td>
                      <td style={tdStyle}>
                        <select
                          value={columnMap[v] || ''}
                          onChange={(e) => setColumnMap((m) => ({ ...m, [v]: e.target.value }))}
                          style={{ padding: '4px 8px', fontSize: 13, borderRadius: 4, border: '1px solid #ddd', width: '100%' }}
                        >
                          <option value="">— unmapped —</option>
                          {dataColumns.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ ...tdStyle, color: '#666', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {columnMap[v] ? (dataRows[0]?.[columnMap[v]] ?? '') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 3 && (
            <div style={{ height: '100%' }}>
              <MailMergePreview
                template={template}
                rows={mappedRows}
                currentIndex={previewIndex}
                onIndexChange={setPreviewIndex}
              />
            </div>
          )}

          {/* Step 4: Output */}
          {step === 4 && (
            <div>
              <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Generate Output</h3>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Filename template
                </label>
                <input
                  value={filenameTemplate}
                  onChange={(e) => setFilenameTemplate(e.target.value)}
                  placeholder="Invoice_{name}_{date}"
                  style={{ width: '100%', padding: '6px 10px', fontSize: 13, border: '1px solid #ddd', borderRadius: 6, boxSizing: 'border-box' }}
                />
                <span style={{ fontSize: 11, color: '#999' }}>
                  Use {'{variable}'} placeholders. {'{index}'} = record number.
                </span>
              </div>

              {progress && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ background: '#e0e0e0', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                    <div style={{ background: '#1a73e8', height: '100%', width: `${(progress.done / progress.total) * 100}%`, transition: 'width 0.2s' }} />
                  </div>
                  <span style={{ fontSize: 12, color: '#666' }}>{progress.done} / {progress.total}</span>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button onClick={() => handleGenerate('combined')} style={outputBtn}>
                  <Files size={16} /> Combined PDF (one file, page breaks)
                </button>
                <button onClick={() => handleGenerate('individual')} style={outputBtn}>
                  <FileText size={16} /> Individual PDFs (one per record)
                </button>
                <button onClick={() => handleGenerate('markdown')} style={outputBtn}>
                  <Download size={16} /> Markdown files (ZIP)
                </button>
                <button onClick={() => handleGenerate('print')} style={outputBtn}>
                  <Printer size={16} /> Print all
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between' }}>
          <button
            onClick={() => setStep((s) => (s > 1 ? (s - 1) as Step : s))}
            disabled={step === 1}
            style={{ ...navButton, opacity: step === 1 ? 0.4 : 1 }}
          >
            <ChevronLeft size={14} /> Back
          </button>
          {step < 4 && (
            <button
              onClick={() => setStep((s) => (s < 4 ? (s + 1) as Step : s))}
              disabled={step === 1 && dataRows.length === 0}
              style={{ ...primaryBtn, opacity: step === 1 && dataRows.length === 0 ? 0.4 : 1 }}
            >
              Next <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ---- Styles ----
const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const dialog: React.CSSProperties = {
  background: '#fff', borderRadius: 12, width: '90vw', maxWidth: 800,
  height: '80vh', display: 'flex', flexDirection: 'column',
  boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
};
const headerStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '14px 20px', borderBottom: '1px solid #e0e0e0',
};
const stepCircle = (active: boolean): React.CSSProperties => ({
  width: 20, height: 20, borderRadius: '50%', display: 'inline-flex',
  alignItems: 'center', justifyContent: 'center', fontSize: 11,
  background: active ? '#1a73e8' : '#e0e0e0', color: active ? '#fff' : '#666',
});
const sourceBtn: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
  padding: '20px 24px', border: '2px dashed #ddd', borderRadius: 10,
  background: '#fafafa', cursor: 'pointer', fontSize: 13, color: '#333',
  minWidth: 120,
};
const primaryBtn: React.CSSProperties = {
  padding: '8px 16px', background: '#1a73e8', color: '#fff', border: 'none',
  borderRadius: 6, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4,
};
const navButton: React.CSSProperties = {
  padding: '8px 14px', background: '#f0f0f0', border: '1px solid #ddd',
  borderRadius: 6, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4,
};
const outputBtn: React.CSSProperties = {
  padding: '12px 16px', background: '#f8f9fa', border: '1px solid #ddd',
  borderRadius: 8, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 10,
  textAlign: 'left',
};
const thStyle: React.CSSProperties = {
  padding: '8px 12px', background: '#f5f5f5', borderBottom: '1px solid #ddd',
  textAlign: 'left', fontWeight: 600,
};
const tdStyle: React.CSSProperties = {
  padding: '8px 12px', borderBottom: '1px solid #f0f0f0',
};

export default MailMergeWizard;
