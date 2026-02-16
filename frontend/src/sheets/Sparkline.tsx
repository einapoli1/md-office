// Sparkline component - inline SVG charts for cells

export interface SparklineData {
  type: 'sparkline';
  data: number[];
  chartType: string;
  color: string;
}

export const SPARKLINE_PREFIX = '__SPARKLINE__:';

export function isSparklineValue(val: string): boolean {
  return typeof val === 'string' && val.startsWith(SPARKLINE_PREFIX);
}

export function parseSparklineValue(val: string): SparklineData | null {
  if (!isSparklineValue(val)) return null;
  try {
    return JSON.parse(val.slice(SPARKLINE_PREFIX.length));
  } catch {
    return null;
  }
}

export function serializeSparkline(data: SparklineData): string {
  return SPARKLINE_PREFIX + JSON.stringify(data);
}

interface SparklineProps {
  data: SparklineData;
  width?: number;
  height?: number;
  showLabels?: boolean;
}

export default function Sparkline({ data, width = 80, height = 24, showLabels = false }: SparklineProps) {
  const { data: values, chartType, color } = data;
  if (!values.length) return null;

  const pad = showLabels ? 20 : 2;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = maxV - minV || 1;

  const norm = (v: number) => innerH - ((v - minV) / range) * innerH;

  switch (chartType) {
    case 'line': {
      const points = values.map((v, i) => {
        const x = pad + (values.length > 1 ? (i / (values.length - 1)) * innerW : innerW / 2);
        const y = pad + norm(v);
        return `${x},${y}`;
      }).join(' ');
      return (
        <svg width={width} height={height} style={{ display: 'block' }}>
          <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} />
          {showLabels && <>
            <text x={pad} y={height - 2} fontSize={8} fill="#666">{minV}</text>
            <text x={width - pad} y={pad + 4} fontSize={8} fill="#666" textAnchor="end">{maxV}</text>
          </>}
        </svg>
      );
    }
    case 'bar': {
      const barW = Math.max(1, innerW / values.length - 1);
      return (
        <svg width={width} height={height} style={{ display: 'block' }}>
          {values.map((v, i) => {
            const barH = ((v - minV) / range) * innerH || 1;
            const x = pad + (i / values.length) * innerW;
            return <rect key={i} x={x} y={pad + innerH - barH} width={barW} height={barH} fill={color} />;
          })}
          {showLabels && values.map((v, i) => {
            const x = pad + (i / values.length) * innerW + barW / 2;
            return <text key={i} x={x} y={height - 2} fontSize={7} fill="#666" textAnchor="middle">{v}</text>;
          })}
        </svg>
      );
    }
    case 'column': {
      const colW = Math.max(1, innerW / values.length - 1);
      const zero = maxV > 0 && minV < 0 ? pad + (maxV / range) * innerH : (minV >= 0 ? pad + innerH : pad);
      return (
        <svg width={width} height={height} style={{ display: 'block' }}>
          {values.map((v, i) => {
            const x = pad + (i / values.length) * innerW;
            if (v >= 0) {
              const h = (v / range) * innerH || 1;
              return <rect key={i} x={x} y={zero - h} width={colW} height={h} fill={color} />;
            } else {
              const h = (-v / range) * innerH || 1;
              return <rect key={i} x={x} y={zero} width={colW} height={h} fill={color} opacity={0.6} />;
            }
          })}
        </svg>
      );
    }
    case 'pie': {
      const total = values.reduce((a, b) => a + Math.abs(b), 0) || 1;
      const cx = width / 2, cy = height / 2, r = Math.min(innerW, innerH) / 2;
      const colors = ['#4285f4', '#ea4335', '#fbbc04', '#34a853', '#ff6d01', '#46bdc6', '#7b1fa2', '#c2185b'];
      let startAngle = -Math.PI / 2;
      return (
        <svg width={width} height={height} style={{ display: 'block' }}>
          {values.map((v, i) => {
            const angle = (Math.abs(v) / total) * Math.PI * 2;
            const endAngle = startAngle + angle;
            const x1 = cx + r * Math.cos(startAngle);
            const y1 = cy + r * Math.sin(startAngle);
            const x2 = cx + r * Math.cos(endAngle);
            const y2 = cy + r * Math.sin(endAngle);
            const largeArc = angle > Math.PI ? 1 : 0;
            const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
            startAngle = endAngle;
            return <path key={i} d={d} fill={i === 0 ? color : colors[i % colors.length]} />;
          })}
        </svg>
      );
    }
    case 'winloss': {
      const barW = Math.max(1, innerW / values.length - 1);
      const midY = pad + innerH / 2;
      const halfH = innerH / 2;
      return (
        <svg width={width} height={height} style={{ display: 'block' }}>
          <line x1={pad} y1={midY} x2={pad + innerW} y2={midY} stroke="#ccc" strokeWidth={0.5} />
          {values.map((v, i) => {
            const x = pad + (i / values.length) * innerW;
            if (v > 0) return <rect key={i} x={x} y={midY - halfH * 0.8} width={barW} height={halfH * 0.8} fill="#34a853" />;
            if (v < 0) return <rect key={i} x={x} y={midY} width={barW} height={halfH * 0.8} fill="#ea4335" />;
            return <rect key={i} x={x} y={midY - 1} width={barW} height={2} fill="#999" />;
          })}
        </svg>
      );
    }
    default:
      return <span style={{ fontSize: 10, color: '#999' }}>?chart</span>;
  }
}
