import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Upload, Eye, Download, Wand2 } from 'lucide-react';
import { extractVariables, renderTemplate, parseCSV } from '../lib/templateEngine';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import MailMergeWizard from './MailMergeWizard';

interface TemplatePanelProps {
  content: string;
  onClose: () => void;
  onPreview: (rendered: string) => void;
}

const TemplatePanel: React.FC<TemplatePanelProps> = ({ content, onClose, onPreview }) => {
  const [variables, setVariables] = useState<string[]>([]);
  const [manualData, setManualData] = useState<Record<string, string>>({});
  const [dataRows, setDataRows] = useState<Record<string, string>[]>([]);
  const [currentRow, setCurrentRow] = useState(0);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const vars = extractVariables(content);
    setVariables(vars);
  }, [content]);

  // Listen for variable clicks from the editor
  useEffect(() => {
    const handler = (e: Event) => {
      const varName = (e as CustomEvent).detail?.variable;
      if (varName) {
        const el = document.getElementById(`tpl-var-${varName}`);
        el?.focus();
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };
    window.addEventListener('template-variable-click', handler);
    return () => window.removeEventListener('template-variable-click', handler);
  }, []);

  const currentData = useCallback((): Record<string, string> => {
    if (dataRows.length > 0) {
      return { ...manualData, ...dataRows[currentRow] };
    }
    return manualData;
  }, [manualData, dataRows, currentRow]);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (file.name.endsWith('.csv')) {
        const rows = parseCSV(text);
        setDataRows(rows);
        setCurrentRow(0);
      } else if (file.name.endsWith('.json')) {
        try {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            setDataRows(parsed);
            setCurrentRow(0);
          } else {
            setManualData(prev => ({ ...prev, ...parsed }));
          }
        } catch {
          alert('Invalid JSON file');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handlePreview = () => {
    const rendered = renderTemplate(content, currentData());
    onPreview(rendered);
    setIsPreviewing(!isPreviewing);
  };

  const handleGenerateAll = async () => {
    const rows = dataRows.length > 0 ? dataRows : [manualData];
    const zip = new JSZip();
    rows.forEach((row, i) => {
      const rendered = renderTemplate(content, row);
      zip.file(`document_${i + 1}.md`, rendered);
    });
    const blob = await zip.generateAsync({ type: 'blob' });
    saveAs(blob, 'mail_merge_output.zip');
  };

  const headers = dataRows.length > 0 ? Object.keys(dataRows[0]) : [];

  return (
    <div className="template-panel" style={{
      position: 'fixed', right: 0, top: 0, bottom: 0, width: 360,
      background: 'var(--bg-primary, #fff)', borderLeft: '1px solid var(--border-color, #e0e0e0)',
      display: 'flex', flexDirection: 'column', zIndex: 50,
      boxShadow: '-2px 0 8px rgba(0,0,0,0.1)', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderBottom: '1px solid var(--border-color, #e0e0e0)',
      }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Mail Merge</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <X size={18} />
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {/* Variables */}
        <div style={{ marginBottom: 16 }}>
          <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: '#666' }}>
            Template Variables ({variables.length})
          </h4>
          {variables.length === 0 ? (
            <p style={{ fontSize: 13, color: '#999', margin: 0 }}>
              No <code style={{ background: '#f0f0f0', padding: '1px 4px', borderRadius: 3 }}>{'{{variables}}'}</code> found in document.
            </p>
          ) : (
            variables.map(v => (
              <div key={v} style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#555', display: 'block', marginBottom: 2 }}>
                  {v}
                </label>
                <input
                  id={`tpl-var-${v}`}
                  type="text"
                  value={dataRows.length > 0 ? (dataRows[currentRow]?.[v] || '') : (manualData[v] || '')}
                  onChange={e => setManualData(prev => ({ ...prev, [v]: e.target.value }))}
                  readOnly={dataRows.length > 0}
                  style={{
                    width: '100%', padding: '6px 8px', fontSize: 13, border: '1px solid #ddd',
                    borderRadius: 4, boxSizing: 'border-box',
                    background: dataRows.length > 0 ? '#f5f5f5' : '#fff',
                  }}
                />
              </div>
            ))
          )}
        </div>

        {/* Import */}
        <div style={{ marginBottom: 16 }}>
          <input ref={fileInputRef} type="file" accept=".csv,.json" onChange={handleImport} style={{ display: 'none' }} />
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              background: '#f0f0f0', border: '1px solid #ddd', borderRadius: 6,
              cursor: 'pointer', fontSize: 13, width: '100%', justifyContent: 'center',
            }}
          >
            <Upload size={14} /> Import Data (CSV / JSON)
          </button>
          <button
            onClick={() => setShowWizard(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 6,
              cursor: 'pointer', fontSize: 13, width: '100%', justifyContent: 'center',
              marginTop: 8,
            }}
          >
            <Wand2 size={14} /> Mail Merge Wizard
          </button>
        </div>

        {/* Data Table Preview */}
        {dataRows.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#666' }}>
                Data ({dataRows.length} rows)
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  onClick={() => setCurrentRow(r => Math.max(0, r - 1))}
                  disabled={currentRow === 0}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, opacity: currentRow === 0 ? 0.3 : 1 }}
                >
                  <ChevronLeft size={16} />
                </button>
                <span style={{ fontSize: 12, minWidth: 50, textAlign: 'center' }}>
                  Row {currentRow + 1} / {dataRows.length}
                </span>
                <button
                  onClick={() => setCurrentRow(r => Math.min(dataRows.length - 1, r + 1))}
                  disabled={currentRow >= dataRows.length - 1}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, opacity: currentRow >= dataRows.length - 1 ? 0.3 : 1 }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
            <div style={{ maxHeight: 200, overflow: 'auto', border: '1px solid #e0e0e0', borderRadius: 4, fontSize: 12 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '4px 8px', background: '#f5f5f5', borderBottom: '1px solid #ddd', textAlign: 'left', position: 'sticky', top: 0 }}>#</th>
                    {headers.map(h => (
                      <th key={h} style={{ padding: '4px 8px', background: '#f5f5f5', borderBottom: '1px solid #ddd', textAlign: 'left', position: 'sticky', top: 0, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dataRows.map((row, i) => (
                    <tr
                      key={i}
                      onClick={() => setCurrentRow(i)}
                      style={{
                        cursor: 'pointer',
                        background: i === currentRow ? '#e3f2fd' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '3px 8px', borderBottom: '1px solid #f0f0f0' }}>{i + 1}</td>
                      {headers.map(h => (
                        <td key={h} style={{ padding: '3px 8px', borderBottom: '1px solid #f0f0f0', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row[h]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div style={{
        padding: '12px 16px', borderTop: '1px solid var(--border-color, #e0e0e0)',
        display: 'flex', gap: 8,
      }}>
        <button
          onClick={handlePreview}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '8px 12px', background: isPreviewing ? '#1a73e8' : '#fff',
            color: isPreviewing ? '#fff' : '#333',
            border: '1px solid #1a73e8', borderRadius: 6, cursor: 'pointer', fontSize: 13,
          }}
        >
          <Eye size={14} /> Preview
        </button>
        <button
          onClick={handleGenerateAll}
          disabled={variables.length === 0}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '8px 12px', background: '#1a73e8', color: '#fff',
            border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13,
            opacity: variables.length === 0 ? 0.5 : 1,
          }}
        >
          <Download size={14} /> Generate All
        </button>
      </div>
      {showWizard && (
        <MailMergeWizard template={content} onClose={() => setShowWizard(false)} />
      )}
    </div>
  );
};

export default TemplatePanel;
