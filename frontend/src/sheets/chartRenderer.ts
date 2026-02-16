import { ChartConfig, SheetData, SeriesConfig } from './sheetModel';
import { expandRange } from './formulaEngine';

const DEFAULT_COLORS = ['#4285F4', '#EA4335', '#FBBC04', '#34A853', '#FF6D01', '#46BDC6', '#7B1FA2', '#C2185B', '#00ACC1', '#8D6E63', '#607D8B', '#D81B60'];

export function getValues(sheet: SheetData, range: string): string[] {
  if (!range) return [];
  const refs = expandRange(range);
  return refs.map(r => {
    const cell = sheet.cells[r];
    if (!cell) return '';
    return cell.computed ?? cell.value;
  });
}

export function getNumericValues(sheet: SheetData, range: string): number[] {
  return getValues(sheet, range).map(v => parseFloat(v) || 0);
}

interface Padding { top: number; right: number; bottom: number; left: number; }

function getColors(chart: ChartConfig): string[] {
  return chart.colors?.length ? chart.colors : DEFAULT_COLORS;
}

function getSeries(chart: ChartConfig, sheet: SheetData): { data: number[]; label: string; color: string; config?: SeriesConfig }[] {
  if (chart.series && chart.series.length > 0) {
    return chart.series.map((s, i) => ({
      data: getNumericValues(sheet, s.dataRange),
      label: s.label || `Series ${i + 1}`,
      color: s.color || getColors(chart)[i % getColors(chart).length],
      config: s,
    }));
  }
  return [{
    data: getNumericValues(sheet, chart.dataRange),
    label: chart.title || 'Data',
    color: getColors(chart)[0],
  }];
}

function setLineDash(ctx: CanvasRenderingContext2D, style?: string) {
  if (style === 'dashed') ctx.setLineDash([6, 3]);
  else if (style === 'dotted') ctx.setLineDash([2, 2]);
  else ctx.setLineDash([]);
}

function drawTitle(ctx: CanvasRenderingContext2D, chart: ChartConfig, w: number) {
  ctx.fillStyle = '#333';
  ctx.font = `bold ${chart.titleFontSize || 14}px Arial`;
  ctx.textAlign = 'center';
  ctx.fillText(chart.title || 'Chart', w / 2, 20);
  if (chart.subtitle) {
    ctx.fillStyle = '#666';
    ctx.font = `${chart.subtitleFontSize || 11}px Arial`;
    ctx.fillText(chart.subtitle, w / 2, 34);
  }
}

function drawLegend(ctx: CanvasRenderingContext2D, chart: ChartConfig, labels: string[], colors: string[], w: number, h: number, pad: Padding) {
  if (chart.legendPosition === 'none') return;
  const pos = chart.legendPosition || 'top';
  ctx.font = '10px Arial';
  ctx.textAlign = 'left';

  const items = labels.map((l, i) => ({ label: l, color: colors[i % colors.length] }));
  const itemWidth = 80;

  if (pos === 'top' || pos === 'bottom') {
    const totalW = items.length * itemWidth;
    const startX = (w - totalW) / 2;
    const y = pos === 'top' ? pad.top - 10 : h - 10;
    items.forEach((item, i) => {
      const x = startX + i * itemWidth;
      ctx.fillStyle = item.color;
      ctx.fillRect(x, y - 6, 12, 8);
      ctx.fillStyle = '#555';
      ctx.fillText(item.label.slice(0, 10), x + 16, y);
    });
  } else {
    const x = pos === 'left' ? 5 : w - 80;
    items.forEach((item, i) => {
      const y = pad.top + 10 + i * 16;
      ctx.fillStyle = item.color;
      ctx.fillRect(x, y - 6, 12, 8);
      ctx.fillStyle = '#555';
      ctx.fillText(item.label.slice(0, 10), x + 16, y);
    });
  }
}

function drawAxes(ctx: CanvasRenderingContext2D, chart: ChartConfig, pad: Padding, cw: number, ch: number, minVal: number, range: number, _labels?: string[]) {
  ctx.strokeStyle = '#ccc';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top);
  ctx.lineTo(pad.left, pad.top + ch);
  ctx.lineTo(pad.left + cw, pad.top + ch);
  ctx.stroke();

  // Y-axis gridlines and labels
  const showGrid = chart.yAxis?.gridlines !== false;
  ctx.fillStyle = '#888';
  ctx.font = '10px Arial';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const v = minVal + (range * i) / 4;
    const y = pad.top + ch - (range ? ((v - minVal) / range) * ch : 0);
    if (showGrid) {
      ctx.beginPath();
      ctx.strokeStyle = '#eee';
      ctx.setLineDash([]);
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + cw, y);
      ctx.stroke();
    }
    // Tick mark
    ctx.beginPath();
    ctx.strokeStyle = '#ccc';
    ctx.moveTo(pad.left - 4, y);
    ctx.lineTo(pad.left, y);
    ctx.stroke();
    ctx.fillText(v.toFixed(1), pad.left - 6, y + 3);
  }

  // Axis titles
  if (chart.xAxis?.title) {
    ctx.fillStyle = '#555';
    ctx.font = '11px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(chart.xAxis.title, pad.left + cw / 2, pad.top + ch + 35);
  }
  if (chart.yAxis?.title) {
    ctx.save();
    ctx.translate(12, pad.top + ch / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#555';
    ctx.font = '11px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(chart.yAxis.title, 0, 0);
    ctx.restore();
  }
}

function drawDataLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
  ctx.fillStyle = '#333';
  ctx.font = '9px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y - 5);
}

function drawMarker(ctx: CanvasRenderingContext2D, style: string | undefined, x: number, y: number, color: string) {
  if (style === 'none') return;
  ctx.fillStyle = color;
  ctx.beginPath();
  const s = 3;
  switch (style) {
    case 'square':
      ctx.fillRect(x - s, y - s, s * 2, s * 2);
      return;
    case 'diamond':
      ctx.moveTo(x, y - s - 1);
      ctx.lineTo(x + s + 1, y);
      ctx.lineTo(x, y + s + 1);
      ctx.lineTo(x - s - 1, y);
      ctx.closePath();
      ctx.fill();
      return;
    case 'triangle':
      ctx.moveTo(x, y - s - 1);
      ctx.lineTo(x + s + 1, y + s);
      ctx.lineTo(x - s - 1, y + s);
      ctx.closePath();
      ctx.fill();
      return;
    default: // circle
      ctx.arc(x, y, s, 0, Math.PI * 2);
      ctx.fill();
  }
}

export function drawChart(canvas: HTMLCanvasElement, chart: ChartConfig, sheet: SheetData) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const colors = getColors(chart);
  const labels = getValues(sheet, chart.labelRange);
  const allSeries = getSeries(chart, sheet);
  const data = allSeries[0]?.data ?? [];

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);

  drawTitle(ctx, chart, w);

  if (!data.length && chart.type !== 'combo') return;

  const subtitleOffset = chart.subtitle ? 16 : 0;
  const pad: Padding = { top: 35 + subtitleOffset, right: 20, bottom: 45, left: 50 };
  if (chart.yAxisSecondary?.title) pad.right = 50;
  const cw = w - pad.left - pad.right;
  const ch = h - pad.top - pad.bottom;

  // Compute global min/max across all series
  const allData = allSeries.flatMap(s => s.data);
  const rawMax = Math.max(...allData, 1);
  const rawMin = Math.min(...allData, 0);
  const maxVal = chart.yAxis?.max ?? rawMax;
  const minVal = chart.yAxis?.min ?? rawMin;
  const range = maxVal - minVal || 1;

  const toX = (i: number, count: number) => pad.left + (i / (count - 1 || 1)) * cw;
  const toY = (v: number) => pad.top + ch - ((v - minVal) / range) * ch;

  // Draw X labels
  const drawXLabels = (count: number) => {
    ctx.fillStyle = '#555';
    ctx.font = '9px Arial';
    ctx.textAlign = 'center';
    const rot = chart.xAxis?.labelRotation || 0;
    for (let i = 0; i < count; i++) {
      const x = toX(i, count);
      const y = pad.top + ch + 14;
      if (rot) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate((rot * Math.PI) / 180);
        ctx.fillText(labels[i] || String(i + 1), 0, 0);
        ctx.restore();
      } else {
        ctx.fillText(labels[i] || String(i + 1), x, y);
      }
    }
  };

  const isPieType = chart.type === 'pie' || chart.type === 'donut';

  if (!isPieType && chart.type !== 'radar') {
    drawAxes(ctx, chart, pad, cw, ch, minVal, range);
  }

  switch (chart.type) {
    case 'bar':
      drawBarChart(ctx, chart, data, labels, colors, pad, cw, ch, minVal, range, toY);
      break;
    case 'line':
    case 'area':
      drawLineChart(ctx, chart, allSeries, pad, cw, ch, toX, toY, data.length);
      drawXLabels(data.length);
      break;
    case 'scatter':
      drawScatterChart(ctx, data, colors, pad, cw, ch, toX, toY);
      drawXLabels(data.length);
      break;
    case 'pie':
      drawPieChart(ctx, chart, data, labels, colors, w, h, pad, ch, cw, false);
      break;
    case 'donut':
      drawPieChart(ctx, chart, data, labels, colors, w, h, pad, ch, cw, true);
      break;
    case 'radar':
      drawRadarChart(ctx, chart, allSeries, labels, colors, w, h, pad, ch, cw);
      break;
    case 'waterfall':
      drawWaterfallChart(ctx, chart, data, labels, pad, cw, ch, minVal, range, toY);
      break;
    case 'combo':
      drawComboChart(ctx, chart, allSeries, labels, colors, pad, cw, ch, minVal, range, toY, w);
      break;
    case 'stacked-bar':
      drawStackedBarChart(ctx, chart, allSeries, labels, pad, cw, ch, false);
      break;
    case 'stacked-bar-100':
      drawStackedBarChart(ctx, chart, allSeries, labels, pad, cw, ch, true);
      break;
    case 'histogram':
      drawHistogram(ctx, chart, data, colors, pad, cw, ch);
      break;
  }

  // Legend
  if (!isPieType) {
    const legendLabels = allSeries.length > 1 ? allSeries.map(s => s.label) : labels;
    const legendColors = allSeries.length > 1 ? allSeries.map(s => s.color) : colors;
    drawLegend(ctx, chart, legendLabels, legendColors, w, h, pad);
  }

  ctx.setLineDash([]);
}

function drawBarChart(ctx: CanvasRenderingContext2D, chart: ChartConfig, data: number[], labels: string[], colors: string[], pad: Padding, cw: number, ch: number, minVal: number, range: number, _toY: (v: number) => number) {
  const barW = Math.max(4, cw / data.length * 0.7);
  const gap = cw / data.length;
  for (let i = 0; i < data.length; i++) {
    const x = pad.left + gap * i + (gap - barW) / 2;
    const barH = ((data[i] - minVal) / range) * ch;
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(x, pad.top + ch - barH, barW, barH);
    if (chart.showDataLabels) drawDataLabel(ctx, data[i].toFixed(1), x + barW / 2, pad.top + ch - barH);
    ctx.fillStyle = '#555';
    ctx.font = '9px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(labels[i] || String(i + 1), x + barW / 2, pad.top + ch + 14);
  }
}

function drawLineChart(ctx: CanvasRenderingContext2D, chart: ChartConfig, series: ReturnType<typeof getSeries>, pad: Padding, _cw: number, ch: number, toX: (i: number, c: number) => number, toY: (v: number) => number, count: number) {
  for (const s of series) {
    ctx.beginPath();
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2;
    setLineDash(ctx, s.config?.lineStyle);

    if (chart.smoothLines && s.data.length > 2) {
      // Bezier smooth
      ctx.moveTo(toX(0, count), toY(s.data[0]));
      for (let i = 0; i < s.data.length - 1; i++) {
        const x0 = toX(i, count), y0 = toY(s.data[i]);
        const x1 = toX(i + 1, count), y1 = toY(s.data[i + 1]);
        const cpx = (x0 + x1) / 2;
        ctx.bezierCurveTo(cpx, y0, cpx, y1, x1, y1);
      }
    } else {
      for (let i = 0; i < s.data.length; i++) {
        const x = toX(i, count), y = toY(s.data[i]);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
    }

    if (chart.type === 'area') {
      ctx.lineTo(toX(s.data.length - 1, count), pad.top + ch);
      ctx.lineTo(toX(0, count), pad.top + ch);
      ctx.closePath();
      ctx.fillStyle = s.color + '40';
      ctx.fill();
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Points
    for (let i = 0; i < s.data.length; i++) {
      drawMarker(ctx, s.config?.markerStyle || 'circle', toX(i, count), toY(s.data[i]), s.color);
      if (chart.showDataLabels) drawDataLabel(ctx, s.data[i].toFixed(1), toX(i, count), toY(s.data[i]));
    }
  }
}

function drawScatterChart(ctx: CanvasRenderingContext2D, data: number[], colors: string[], _pad: Padding, _cw: number, _ch: number, toX: (i: number, c: number) => number, toY: (v: number) => number) {
  for (let i = 0; i < data.length; i++) {
    ctx.beginPath();
    ctx.arc(toX(i, data.length), toY(data[i]), 4, 0, Math.PI * 2);
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();
  }
}

function drawPieChart(ctx: CanvasRenderingContext2D, chart: ChartConfig, data: number[], labels: string[], colors: string[], w: number, h: number, pad: Padding, ch: number, cw: number, isDonut: boolean) {
  const total = data.reduce((a, b) => a + Math.abs(b), 0) || 1;
  const cx = w / 2;
  const cy = pad.top + ch / 2;
  const radius = Math.min(cw, ch) / 2 - 10;
  const innerRadius = isDonut ? radius * 0.55 : 0;
  let angle = -Math.PI / 2;

  for (let i = 0; i < data.length; i++) {
    const slice = (Math.abs(data[i]) / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, angle, angle + slice);
    if (isDonut) {
      ctx.arc(cx, cy, innerRadius, angle + slice, angle, true);
    } else {
      ctx.lineTo(cx, cy);
    }
    ctx.closePath();
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();

    const mid = angle + slice / 2;
    const lr = isDonut ? (radius + innerRadius) / 2 : radius * 0.65;
    const lx = cx + Math.cos(mid) * lr;
    const ly = cy + Math.sin(mid) * lr;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    if (slice > 0.15) ctx.fillText(labels[i] || '', lx, ly);
    angle += slice;
  }

  // Legend for pie
  drawLegend(ctx, chart, labels, colors, w, h, pad);
}

function drawRadarChart(ctx: CanvasRenderingContext2D, chart: ChartConfig, series: ReturnType<typeof getSeries>, labels: string[], _colors: string[], w: number, _h: number, pad: Padding, ch: number, cw: number) {
  const cx = w / 2;
  const cy = pad.top + ch / 2;
  const radius = Math.min(cw, ch) / 2 - 20;
  const count = labels.length || series[0]?.data.length || 0;
  if (count < 3) return;

  const allData = series.flatMap(s => s.data);
  const maxVal = chart.yAxis?.max ?? Math.max(...allData, 1);

  // Draw polygon axes
  for (let ring = 1; ring <= 4; ring++) {
    ctx.beginPath();
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    const r = (radius * ring) / 4;
    for (let i = 0; i <= count; i++) {
      const angle = (Math.PI * 2 * (i % count)) / count - Math.PI / 2;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Axis lines + labels
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
    ctx.beginPath();
    ctx.strokeStyle = '#ccc';
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    ctx.stroke();
    ctx.fillStyle = '#555';
    ctx.font = '9px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(labels[i] || '', cx + Math.cos(angle) * (radius + 14), cy + Math.sin(angle) * (radius + 14));
  }

  // Data polygons
  for (const s of series) {
    ctx.beginPath();
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2;
    ctx.fillStyle = s.color + '30';
    for (let i = 0; i <= count; i++) {
      const angle = (Math.PI * 2 * (i % count)) / count - Math.PI / 2;
      const val = s.data[i % count] || 0;
      const r = (val / maxVal) * radius;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.fill();
    ctx.stroke();
  }
}

function drawWaterfallChart(ctx: CanvasRenderingContext2D, chart: ChartConfig, data: number[], labels: string[], pad: Padding, cw: number, ch: number, _minVal: number, _range: number, _toY: (v: number) => number) {
  if (!data.length) return;
  // Compute running totals
  const totals: number[] = [];
  let running = 0;
  for (const d of data) { running += d; totals.push(running); }

  const allVals = [0, ...totals];
  const min = Math.min(...allVals);
  const max = Math.max(...allVals);
  const vRange = max - min || 1;

  const toYw = (v: number) => pad.top + ch - ((v - min) / vRange) * ch;
  const gap = cw / data.length;
  const barW = Math.max(4, gap * 0.6);

  let prevTotal = 0;
  for (let i = 0; i < data.length; i++) {
    const x = pad.left + gap * i + (gap - barW) / 2;
    const top = Math.min(prevTotal, totals[i]);
    const bottom = Math.max(prevTotal, totals[i]);
    const y1 = toYw(bottom);
    const y2 = toYw(top);
    ctx.fillStyle = data[i] >= 0 ? '#34A853' : '#EA4335';
    ctx.fillRect(x, y1, barW, y2 - y1);

    // Connector line
    if (i < data.length - 1) {
      ctx.beginPath();
      ctx.strokeStyle = '#999';
      ctx.setLineDash([2, 2]);
      ctx.moveTo(x + barW, toYw(totals[i]));
      ctx.lineTo(x + gap, toYw(totals[i]));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (chart.showDataLabels) drawDataLabel(ctx, data[i].toFixed(1), x + barW / 2, y1);
    ctx.fillStyle = '#555';
    ctx.font = '9px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(labels[i] || String(i + 1), x + barW / 2, pad.top + ch + 14);
    prevTotal = totals[i];
  }
}

function drawComboChart(ctx: CanvasRenderingContext2D, chart: ChartConfig, series: ReturnType<typeof getSeries>, labels: string[], _colors: string[], pad: Padding, cw: number, ch: number, minVal: number, range: number, toY: (v: number) => number, w: number) {
  const count = Math.max(...series.map(s => s.data.length), labels.length);
  const gap = cw / (count || 1);
  const barW = Math.max(4, gap * 0.5);
  let barSeriesIdx = 0;
  const barSeries = series.filter(s => (s.config?.comboType || 'bar') === 'bar');
  const lineSeries = series.filter(s => s.config?.comboType === 'line');

  // Draw bars
  for (const s of barSeries) {
    for (let i = 0; i < s.data.length; i++) {
      const x = pad.left + gap * i + (gap - barW * barSeries.length) / 2 + barSeriesIdx * barW;
      const barH = ((s.data[i] - minVal) / range) * ch;
      ctx.fillStyle = s.color;
      ctx.fillRect(x, pad.top + ch - barH, barW, barH);
    }
    barSeriesIdx++;
  }

  // Draw lines
  for (const s of lineSeries) {
    ctx.beginPath();
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2;
    setLineDash(ctx, s.config?.lineStyle);
    for (let i = 0; i < s.data.length; i++) {
      const x = pad.left + gap * i + gap / 2;
      const y = toY(s.data[i]);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    for (let i = 0; i < s.data.length; i++) {
      drawMarker(ctx, s.config?.markerStyle || 'circle', pad.left + gap * i + gap / 2, toY(s.data[i]), s.color);
    }
  }

  // X labels
  ctx.fillStyle = '#555';
  ctx.font = '9px Arial';
  ctx.textAlign = 'center';
  for (let i = 0; i < count; i++) {
    ctx.fillText(labels[i] || String(i + 1), pad.left + gap * i + gap / 2, pad.top + ch + 14);
  }

  // Secondary Y axis
  if (chart.yAxisSecondary?.title) {
    ctx.save();
    ctx.translate(w - 12, pad.top + ch / 2);
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = '#555';
    ctx.font = '11px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(chart.yAxisSecondary.title, 0, 0);
    ctx.restore();
  }
}

function drawStackedBarChart(ctx: CanvasRenderingContext2D, _chart: ChartConfig, series: ReturnType<typeof getSeries>, labels: string[], pad: Padding, cw: number, ch: number, is100: boolean) {
  if (!series.length) return;
  const count = Math.max(...series.map(s => s.data.length));
  const gap = cw / (count || 1);
  const barW = Math.max(4, gap * 0.7);

  // Compute totals for 100%
  const totals: number[] = [];
  for (let i = 0; i < count; i++) {
    totals.push(series.reduce((sum, s) => sum + Math.abs(s.data[i] || 0), 0) || 1);
  }

  const maxStack = is100 ? 1 : Math.max(...totals, 1);

  for (let i = 0; i < count; i++) {
    const x = pad.left + gap * i + (gap - barW) / 2;
    let yBottom = pad.top + ch;
    for (const s of series) {
      const val = Math.abs(s.data[i] || 0);
      const fraction = is100 ? val / totals[i] : val / maxStack;
      const barH = fraction * ch;
      ctx.fillStyle = s.color;
      ctx.fillRect(x, yBottom - barH, barW, barH);
      yBottom -= barH;
    }
    ctx.fillStyle = '#555';
    ctx.font = '9px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(labels[i] || String(i + 1), x + barW / 2, pad.top + ch + 14);
  }

  // Y axis labels
  ctx.fillStyle = '#888';
  ctx.font = '10px Arial';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const v = is100 ? i * 25 : (maxStack * i) / 4;
    const y = pad.top + ch - (ch * i) / 4;
    ctx.fillText(is100 ? `${v}%` : v.toFixed(1), pad.left - 6, y + 3);
  }
}

function drawHistogram(ctx: CanvasRenderingContext2D, chart: ChartConfig, data: number[], colors: string[], pad: Padding, cw: number, ch: number) {
  if (!data.length) return;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const bucketCount = Math.max(5, Math.min(20, Math.ceil(Math.sqrt(data.length))));
  const bucketSize = (max - min) / bucketCount || 1;
  const buckets: number[] = new Array(bucketCount).fill(0);

  for (const v of data) {
    const idx = Math.min(Math.floor((v - min) / bucketSize), bucketCount - 1);
    buckets[idx]++;
  }

  const maxCount = Math.max(...buckets, 1);
  const barW = cw / bucketCount;

  for (let i = 0; i < bucketCount; i++) {
    const x = pad.left + barW * i;
    const barH = (buckets[i] / maxCount) * ch;
    ctx.fillStyle = colors[0];
    ctx.fillRect(x, pad.top + ch - barH, barW - 1, barH);
    if (chart.showDataLabels && buckets[i] > 0) {
      drawDataLabel(ctx, String(buckets[i]), x + barW / 2, pad.top + ch - barH);
    }
  }

  // X labels (bucket ranges)
  ctx.fillStyle = '#555';
  ctx.font = '8px Arial';
  ctx.textAlign = 'center';
  for (let i = 0; i <= bucketCount; i += Math.max(1, Math.floor(bucketCount / 5))) {
    const v = min + bucketSize * i;
    ctx.fillText(v.toFixed(1), pad.left + barW * i, pad.top + ch + 14);
  }

  // Y labels
  ctx.textAlign = 'right';
  ctx.font = '10px Arial';
  ctx.fillStyle = '#888';
  for (let i = 0; i <= 4; i++) {
    const v = (maxCount * i) / 4;
    const y = pad.top + ch - (ch * i) / 4;
    ctx.fillText(Math.round(v).toString(), pad.left - 6, y + 3);
  }
}
