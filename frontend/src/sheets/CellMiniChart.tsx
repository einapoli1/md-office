import Sparkline, { SparklineData } from './Sparkline';

interface CellMiniChartProps {
  data: SparklineData;
  x: number;
  y: number;
}

export default function CellMiniChart({ data, x, y }: CellMiniChartProps) {
  return (
    <div
      style={{
        position: 'fixed',
        left: x,
        top: y,
        width: 220,
        background: '#fff',
        border: '1px solid #ccc',
        borderRadius: 6,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        padding: 10,
        zIndex: 10000,
        pointerEvents: 'none',
      }}
    >
      <Sparkline data={data} width={200} height={150} showLabels />
      <div style={{ fontSize: 10, color: '#666', marginTop: 4, textAlign: 'center' }}>
        {data.data.length} points · {data.chartType}
      </div>
    </div>
  );
}
