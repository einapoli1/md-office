import { useRef, useEffect } from 'react';
import { ChartConfig, SheetData } from './sheetModel';
import { drawChart } from './chartRenderer';

interface ChartSheetProps {
  chart: ChartConfig;
  sheet: SheetData;
}

/**
 * A dedicated full-tab chart view (like Excel's chart sheets).
 * The chart occupies the entire sheet area with no cells visible.
 */
export default function ChartSheet({ chart, sheet }: ChartSheetProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const w = Math.floor(rect.width);
      const h = Math.floor(rect.height);
      canvas.width = w;
      canvas.height = h;
      const fullChart = { ...chart, width: w, height: h };
      drawChart(canvas, fullChart, sheet);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [chart, sheet]);

  return (
    <div
      ref={containerRef}
      className="chart-sheet-container"
      style={{ width: '100%', height: '100%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
