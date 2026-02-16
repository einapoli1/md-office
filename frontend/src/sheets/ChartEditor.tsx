import { useState, useRef, useEffect, useCallback } from 'react';
import { ChartConfig, ChartType, SheetData, SeriesConfig, LegendPosition } from './sheetModel';
import { drawChart } from './chartRenderer';

const DEFAULT_COLORS = ['#4285F4', '#EA4335', '#FBBC04', '#34A853', '#FF6D01', '#46BDC6', '#7B1FA2', '#C2185B'];

const CHART_TYPES: { type: ChartType; label: string; icon: string }[] = [
  { type: 'bar', label: 'Bar', icon: '📊' },
  { type: 'line', label: 'Line', icon: '📈' },
  { type: 'pie', label: 'Pie', icon: '🥧' },
  { type: 'scatter', label: 'Scatter', icon: '⚬' },
  { type: 'area', label: 'Area', icon: '▧' },
  { type: 'donut', label: 'Donut', icon: '🍩' },
  { type: 'radar', label: 'Radar', icon: '🕸' },
  { type: 'waterfall', label: 'Waterfall', icon: '🌊' },
  { type: 'combo', label: 'Combo', icon: '📊📈' },
  { type: 'stacked-bar', label: 'Stacked Bar', icon: '▥' },
  { type: 'stacked-bar-100', label: '100% Stacked', icon: '▤' },
  { type: 'histogram', label: 'Histogram', icon: '▦' },
];

interface ChartEditorProps {
  sheet: SheetData;
  initialConfig?: Partial<ChartConfig>;
  onInsert: (config: Omit<ChartConfig, 'id' | 'x' | 'y'>) => void;
  onClose: () => void;
}

type Tab = 'type' | 'data' | 'series' | 'axes' | 'style';

export default function ChartEditor({ sheet, initialConfig, onInsert, onClose }: ChartEditorProps) {
  const [tab, setTab] = useState<Tab>('type');
  const [chartType, setChartType] = useState<ChartType>(initialConfig?.type || 'bar');
  const [dataRange, setDataRange] = useState(initialConfig?.dataRange || '');
  const [labelRange, setLabelRange] = useState(initialConfig?.labelRange || '');
  const [title, setTitle] = useState(initialConfig?.title || '');
  const [subtitle, setSubtitle] = useState(initialConfig?.subtitle || '');
  const [titleFontSize, setTitleFontSize] = useState(initialConfig?.titleFontSize || 14);
  const [subtitleFontSize, setSubtitleFontSize] = useState(initialConfig?.subtitleFontSize || 11);
  const [series, setSeries] = useState<SeriesConfig[]>(initialConfig?.series || []);
  const [xAxisTitle, setXAxisTitle] = useState(initialConfig?.xAxis?.title || '');
  const [yAxisTitle, setYAxisTitle] = useState(initialConfig?.yAxis?.title || '');
  const [yMin, setYMin] = useState<string>(initialConfig?.yAxis?.min?.toString() ?? '');
  const [yMax, setYMax] = useState<string>(initialConfig?.yAxis?.max?.toString() ?? '');
  const [logScale, setLogScale] = useState(initialConfig?.yAxis?.logScale || false);
  const [gridlines, setGridlines] = useState(initialConfig?.yAxis?.gridlines !== false);
  const [labelRotation, setLabelRotation] = useState(initialConfig?.xAxis?.labelRotation || 0);
  const [legendPosition, setLegendPosition] = useState<LegendPosition>(initialConfig?.legendPosition || 'top');
  const [showDataLabels, setShowDataLabels] = useState(initialConfig?.showDataLabels || false);
  const [smoothLines, setSmoothLines] = useState(initialConfig?.smoothLines || false);

  const previewRef = useRef<HTMLCanvasElement>(null);

  const buildConfig = useCallback((): Omit<ChartConfig, 'id' | 'x' | 'y'> => ({
    type: chartType,
    dataRange: dataRange.toUpperCase(),
    labelRange: labelRange.toUpperCase(),
    title,
    subtitle: subtitle || undefined,
    titleFontSize,
    subtitleFontSize,
    width: 400,
    height: 300,
    series: series.length > 0 ? series : undefined,
    xAxis: { title: xAxisTitle || undefined, labelRotation: labelRotation || undefined },
    yAxis: {
      title: yAxisTitle || undefined,
      min: yMin !== '' ? parseFloat(yMin) : undefined,
      max: yMax !== '' ? parseFloat(yMax) : undefined,
      logScale: logScale || undefined,
      gridlines,
    },
    legendPosition,
    showDataLabels,
    smoothLines,
  }), [chartType, dataRange, labelRange, title, subtitle, titleFontSize, subtitleFontSize, series, xAxisTitle, yAxisTitle, yMin, yMax, logScale, gridlines, labelRotation, legendPosition, showDataLabels, smoothLines]);

  // Live preview
  useEffect(() => {
    if (!previewRef.current) return;
    const canvas = previewRef.current;
    canvas.width = 320;
    canvas.height = 220;
    const cfg = { ...buildConfig(), id: 'preview', x: 0, y: 0 } as ChartConfig;
    cfg.width = 320;
    cfg.height = 220;
    drawChart(canvas, cfg, sheet);
  }, [buildConfig, sheet]);

  const addSeries = () => {
    setSeries([...series, { dataRange: '', label: `Series ${series.length + 1}`, color: DEFAULT_COLORS[series.length % DEFAULT_COLORS.length] }]);
  };

  const updateSeries = (idx: number, patch: Partial<SeriesConfig>) => {
    const next = [...series];
    next[idx] = { ...next[idx], ...patch };
    setSeries(next);
  };

  const removeSeries = (idx: number) => {
    setSeries(series.filter((_, i) => i !== idx));
  };

  const sectionStyle: React.CSSProperties = { marginBottom: 12 };
  const labelStyle: React.CSSProperties = { display: 'block', marginBottom: 6, fontSize: 12, color: '#555' };
  const inputStyle: React.CSSProperties = { width: '100%', padding: '4px 6px', border: '1px solid #ccc', borderRadius: 3, fontSize: 12, boxSizing: 'border-box' };
  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 12px', border: 'none', borderBottom: active ? '2px solid #4285F4' : '2px solid transparent',
    background: 'none', cursor: 'pointer', fontSize: 12, fontWeight: active ? 600 : 400, color: active ? '#4285F4' : '#555',
  });

  return (
    <div className="sheet-dialog-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.2)', width: 720, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 20px 0', borderBottom: '1px solid #eee' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Chart Editor</h3>
          <div style={{ display: 'flex', gap: 0 }}>
            {(['type', 'data', 'series', 'axes', 'style'] as Tab[]).map(t => (
              <button key={t} style={tabBtnStyle(tab === t)} onClick={() => setTab(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Config panel */}
          <div style={{ flex: 1, padding: 16, overflowY: 'auto', minWidth: 0 }}>
            {tab === 'type' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {CHART_TYPES.map(ct => (
                  <div
                    key={ct.type}
                    onClick={() => setChartType(ct.type)}
                    style={{
                      border: chartType === ct.type ? '2px solid #4285F4' : '1px solid #ddd',
                      borderRadius: 6, padding: '12px 8px', textAlign: 'center', cursor: 'pointer',
                      background: chartType === ct.type ? '#E8F0FE' : '#fff',
                    }}
                  >
                    <div style={{ fontSize: 24 }}>{ct.icon}</div>
                    <div style={{ fontSize: 11, marginTop: 4 }}>{ct.label}</div>
                  </div>
                ))}
              </div>
            )}

            {tab === 'data' && (
              <>
                <div style={sectionStyle}>
                  <label style={labelStyle}>Data Range</label>
                  <input value={dataRange} onChange={e => setDataRange(e.target.value)} placeholder="e.g. B1:B10" style={inputStyle} />
                </div>
                <div style={sectionStyle}>
                  <label style={labelStyle}>Label Range</label>
                  <input value={labelRange} onChange={e => setLabelRange(e.target.value)} placeholder="e.g. A1:A10" style={inputStyle} />
                </div>
              </>
            )}

            {tab === 'series' && (
              <>
                {series.map((s, i) => (
                  <div key={i} style={{ border: '1px solid #eee', borderRadius: 4, padding: 10, marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <strong style={{ fontSize: 12 }}>Series {i + 1}</strong>
                      <button onClick={() => removeSeries(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', fontSize: 14 }}>✕</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      <div>
                        <label style={labelStyle}>Label</label>
                        <input value={s.label} onChange={e => updateSeries(i, { label: e.target.value })} style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Data Range</label>
                        <input value={s.dataRange} onChange={e => updateSeries(i, { dataRange: e.target.value })} placeholder="e.g. C1:C10" style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Color</label>
                        <input type="color" value={s.color} onChange={e => updateSeries(i, { color: e.target.value })} style={{ width: '100%', height: 28, border: 'none', cursor: 'pointer' }} />
                      </div>
                      <div>
                        <label style={labelStyle}>Line Style</label>
                        <select value={s.lineStyle || 'solid'} onChange={e => updateSeries(i, { lineStyle: e.target.value as SeriesConfig['lineStyle'] })} style={inputStyle}>
                          <option value="solid">Solid</option>
                          <option value="dashed">Dashed</option>
                          <option value="dotted">Dotted</option>
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>Marker</label>
                        <select value={s.markerStyle || 'circle'} onChange={e => updateSeries(i, { markerStyle: e.target.value as SeriesConfig['markerStyle'] })} style={inputStyle}>
                          <option value="circle">Circle</option>
                          <option value="square">Square</option>
                          <option value="diamond">Diamond</option>
                          <option value="triangle">Triangle</option>
                          <option value="none">None</option>
                        </select>
                      </div>
                      {chartType === 'combo' && (
                        <div>
                          <label style={labelStyle}>Combo Type</label>
                          <select value={s.comboType || 'bar'} onChange={e => updateSeries(i, { comboType: e.target.value as 'bar' | 'line' })} style={inputStyle}>
                            <option value="bar">Bar</option>
                            <option value="line">Line</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <button onClick={addSeries} style={{ background: '#f0f0f0', border: '1px dashed #ccc', borderRadius: 4, padding: '8px 16px', cursor: 'pointer', width: '100%', fontSize: 12 }}>
                  + Add Series
                </button>
              </>
            )}

            {tab === 'axes' && (
              <>
                <div style={sectionStyle}>
                  <label style={labelStyle}>X-Axis Title</label>
                  <input value={xAxisTitle} onChange={e => setXAxisTitle(e.target.value)} style={inputStyle} />
                </div>
                <div style={sectionStyle}>
                  <label style={labelStyle}>Y-Axis Title</label>
                  <input value={yAxisTitle} onChange={e => setYAxisTitle(e.target.value)} style={inputStyle} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, ...sectionStyle }}>
                  <div>
                    <label style={labelStyle}>Y Min</label>
                    <input value={yMin} onChange={e => setYMin(e.target.value)} placeholder="Auto" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Y Max</label>
                    <input value={yMax} onChange={e => setYMax(e.target.value)} placeholder="Auto" style={inputStyle} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16, ...sectionStyle }}>
                  <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input type="checkbox" checked={logScale} onChange={e => setLogScale(e.target.checked)} /> Log Scale
                  </label>
                  <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input type="checkbox" checked={gridlines} onChange={e => setGridlines(e.target.checked)} /> Gridlines
                  </label>
                </div>
                <div style={sectionStyle}>
                  <label style={labelStyle}>Label Rotation: {labelRotation}°</label>
                  <input type="range" min={-90} max={90} value={labelRotation} onChange={e => setLabelRotation(parseInt(e.target.value))} style={{ width: '100%' }} />
                </div>
              </>
            )}

            {tab === 'style' && (
              <>
                <div style={sectionStyle}>
                  <label style={labelStyle}>Chart Title</label>
                  <input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, ...sectionStyle }}>
                  <div>
                    <label style={labelStyle}>Subtitle</label>
                    <input value={subtitle} onChange={e => setSubtitle(e.target.value)} style={inputStyle} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, ...sectionStyle }}>
                  <div>
                    <label style={labelStyle}>Title Size</label>
                    <input type="number" value={titleFontSize} onChange={e => setTitleFontSize(parseInt(e.target.value) || 14)} style={inputStyle} min={8} max={32} />
                  </div>
                  <div>
                    <label style={labelStyle}>Subtitle Size</label>
                    <input type="number" value={subtitleFontSize} onChange={e => setSubtitleFontSize(parseInt(e.target.value) || 11)} style={inputStyle} min={8} max={24} />
                  </div>
                </div>
                <div style={sectionStyle}>
                  <label style={labelStyle}>Legend Position</label>
                  <select value={legendPosition} onChange={e => setLegendPosition(e.target.value as LegendPosition)} style={inputStyle}>
                    <option value="top">Top</option>
                    <option value="bottom">Bottom</option>
                    <option value="left">Left</option>
                    <option value="right">Right</option>
                    <option value="none">None</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 16, ...sectionStyle }}>
                  <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input type="checkbox" checked={showDataLabels} onChange={e => setShowDataLabels(e.target.checked)} /> Data Labels
                  </label>
                  <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input type="checkbox" checked={smoothLines} onChange={e => setSmoothLines(e.target.checked)} /> Smooth Lines
                  </label>
                </div>
              </>
            )}
          </div>

          {/* Preview pane */}
          <div style={{ width: 340, borderLeft: '1px solid #eee', padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>Live Preview</div>
            <canvas ref={previewRef} style={{ width: 320, height: 220, border: '1px solid #eee', borderRadius: 4 }} />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid #eee', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '6px 16px', border: '1px solid #ccc', borderRadius: 4, background: '#fff', cursor: 'pointer' }}>Cancel</button>
          <button
            onClick={() => { if (dataRange || series.some(s => s.dataRange)) onInsert(buildConfig()); }}
            style={{ background: '#4285F4', color: '#fff', border: 'none', padding: '6px 20px', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
          >Insert Chart</button>
        </div>
      </div>
    </div>
  );
}
