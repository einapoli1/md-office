import React, { useState } from 'react';
import { Printer } from 'lucide-react';

interface LabelTemplate {
  name: string;
  pageWidth: number; // inches
  pageHeight: number;
  marginTop: number;
  marginLeft: number;
  labelWidth: number;
  labelHeight: number;
  columns: number;
  rows: number;
  hGap: number;
  vGap: number;
}

const TEMPLATES: LabelTemplate[] = [
  { name: 'Avery 5160 (30/sheet)', pageWidth: 8.5, pageHeight: 11, marginTop: 0.5, marginLeft: 0.1875, labelWidth: 2.625, labelHeight: 1, columns: 3, rows: 10, hGap: 0.125, vGap: 0 },
  { name: 'Avery 5163 (10/sheet)', pageWidth: 8.5, pageHeight: 11, marginTop: 0.5, marginLeft: 0.15625, labelWidth: 4, labelHeight: 2, columns: 2, rows: 5, hGap: 0.1875, vGap: 0 },
  { name: 'Avery 5164 (6/sheet)', pageWidth: 8.5, pageHeight: 11, marginTop: 0.5, marginLeft: 0.15625, labelWidth: 4, labelHeight: 3.3125, columns: 2, rows: 3, hGap: 0.1875, vGap: 0 },
  { name: 'Avery 5260 (30/sheet)', pageWidth: 8.5, pageHeight: 11, marginTop: 0.5, marginLeft: 0.1875, labelWidth: 2.625, labelHeight: 1, columns: 3, rows: 10, hGap: 0.125, vGap: 0 },
  { name: 'Avery 8160 (30/sheet)', pageWidth: 8.5, pageHeight: 11, marginTop: 0.5, marginLeft: 0.1875, labelWidth: 2.625, labelHeight: 1, columns: 3, rows: 10, hGap: 0.125, vGap: 0 },
];

interface LabelPrinterProps {
  onClose: () => void;
}

const LabelPrinter: React.FC<LabelPrinterProps> = ({ onClose }) => {
  const [templateIdx, setTemplateIdx] = useState(0);
  const [sameForAll, setSameForAll] = useState(true);
  const [content, setContent] = useState('');
  const [labelContents, setLabelContents] = useState<string[]>([]);
  const [mergeData, setMergeData] = useState('');

  const tmpl = TEMPLATES[templateIdx];
  const totalLabels = tmpl.columns * tmpl.rows;

  const handleTemplateChange = (idx: number) => {
    setTemplateIdx(idx);
    const t = TEMPLATES[idx];
    setLabelContents(Array(t.columns * t.rows).fill(''));
  };

  const getLabelContent = (idx: number): string => {
    if (mergeData.trim()) {
      try {
        const rows = mergeData.trim().split('\n').map(r => r.split('\t'));
        const headers = rows[0];
        if (idx + 1 < rows.length) {
          let text = content;
          headers.forEach((h, ci) => {
            text = text.replace(new RegExp(`\\{\\{${h.trim()}\\}\\}`, 'g'), rows[idx + 1]?.[ci]?.trim() || '');
          });
          return text;
        }
      } catch { /* ignore */ }
    }
    if (sameForAll) return content;
    return labelContents[idx] || '';
  };

  const handlePrint = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    const labels = Array.from({ length: totalLabels }, (_, i) => {
      const col = i % tmpl.columns;
      const row = Math.floor(i / tmpl.columns);
      const left = tmpl.marginLeft + col * (tmpl.labelWidth + tmpl.hGap);
      const top = tmpl.marginTop + row * (tmpl.labelHeight + tmpl.vGap);
      const text = getLabelContent(i).replace(/</g, '&lt;').replace(/\n/g, '<br>');
      return `<div style="position:absolute;left:${left}in;top:${top}in;width:${tmpl.labelWidth}in;height:${tmpl.labelHeight}in;overflow:hidden;font-size:10pt;font-family:Arial;padding:0.05in;box-sizing:border-box;">${text}</div>`;
    }).join('');

    w.document.write(`<!DOCTYPE html><html><head><style>
      @page { size: ${tmpl.pageWidth}in ${tmpl.pageHeight}in; margin: 0; }
      * { margin: 0; padding: 0; }
      body { width: ${tmpl.pageWidth}in; height: ${tmpl.pageHeight}in; position: relative; }
    </style></head><body>${labels}</body></html>`);
    w.document.close();
    w.print();
  };

  const scale = 0.07;

  return (
    <div style={{ padding: 24 }}>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={{ fontWeight: 600, fontSize: 13 }}>Label Template</label>
            <select value={templateIdx} onChange={e => handleTemplateChange(+e.target.value)} style={{ width: '100%', padding: 6, marginTop: 4 }}>
              {TEMPLATES.map((t, i) => <option key={i} value={i}>{t.name}</option>)}
            </select>
            <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
              {tmpl.columns}×{tmpl.rows} = {totalLabels} labels · {tmpl.labelWidth}″×{tmpl.labelHeight}″ each
            </div>
          </div>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginTop: 20 }}>
              <input type="checkbox" checked={sameForAll} onChange={e => setSameForAll(e.target.checked)} />
              Same content for all labels
            </label>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontWeight: 600, fontSize: 13 }}>Label Content {!sameForAll && '(label #1 — edit individually below)'}</label>
          <textarea value={content} onChange={e => setContent(e.target.value)} rows={3} style={{ width: '100%', marginTop: 4, padding: 8, fontFamily: 'Arial', fontSize: 13 }} placeholder={'John Doe\n123 Main Street\nCity, ST 12345'} />
        </div>

        <details style={{ marginBottom: 16 }}>
          <summary style={{ fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Mail Merge Data (tab-separated)</summary>
          <p style={{ fontSize: 11, color: '#888', margin: '4px 0' }}>
            First row = headers. Use {'{{Header}}'} in content. One row per label.
          </p>
          <textarea value={mergeData} onChange={e => setMergeData(e.target.value)} rows={4} style={{ width: '100%', padding: 8, fontFamily: 'monospace', fontSize: 12 }} placeholder={'Name\tAddress\tCity\nJohn\t123 Main\tNY\nJane\t456 Oak\tLA'} />
        </details>

        {!sameForAll && !mergeData.trim() && (
          <details style={{ marginBottom: 16 }}>
            <summary style={{ fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Individual Label Contents</summary>
            <div style={{ maxHeight: 200, overflow: 'auto', marginTop: 8 }}>
              {Array.from({ length: totalLabels }, (_, i) => (
                <div key={i} style={{ marginBottom: 4 }}>
                  <label style={{ fontSize: 11 }}>Label {i + 1}</label>
                  <input value={labelContents[i] || ''} onChange={e => {
                    const c = [...labelContents];
                    while (c.length <= i) c.push('');
                    c[i] = e.target.value;
                    setLabelContents(c);
                  }} style={{ width: '100%', padding: 4, fontSize: 12 }} />
                </div>
              ))}
            </div>
          </details>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontWeight: 600, fontSize: 13 }}>Preview</label>
          <div style={{ marginTop: 8, border: '1px solid #ccc', background: '#fff', color: '#000', width: tmpl.pageWidth * 96 * scale, height: tmpl.pageHeight * 96 * scale, position: 'relative', margin: '0 auto' }}>
            {Array.from({ length: totalLabels }, (_, i) => {
              const col = i % tmpl.columns;
              const row = Math.floor(i / tmpl.columns);
              const left = tmpl.marginLeft + col * (tmpl.labelWidth + tmpl.hGap);
              const top = tmpl.marginTop + row * (tmpl.labelHeight + tmpl.vGap);
              return (
                <div key={i} style={{
                  position: 'absolute',
                  left: left * 96 * scale,
                  top: top * 96 * scale,
                  width: tmpl.labelWidth * 96 * scale,
                  height: tmpl.labelHeight * 96 * scale,
                  border: '0.5px solid #ddd',
                  fontSize: 3,
                  overflow: 'hidden',
                  padding: 1,
                  lineHeight: 1.2,
                  whiteSpace: 'pre-wrap',
                  color: '#000',
                }}>
                  {getLabelContent(i).slice(0, 30)}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 4, border: '1px solid #ccc', background: 'transparent', cursor: 'pointer' }}>Cancel</button>
          <button onClick={handlePrint} style={{ padding: '8px 16px', borderRadius: 4, border: 'none', background: '#1a73e8', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Printer size={16} /> Print Labels
          </button>
        </div>
    </div>
  );
};

export default LabelPrinter;
