import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';

interface DataPoint {
  timestamp: number;
  value: number;
}

interface TimeSeriesChartProps {
  title: string;
  data: DataPoint[];
  color?: string;
  unit?: string;
  timeRange?: string;
  onTimeRangeChange?: (range: string) => void;
  className?: string;
}

const TIME_RANGES = ['1h', '6h', '24h', '7d', '30d'] as const;

export function TimeSeriesChart({
  title,
  data,
  color = 'hsl(var(--primary))',
  unit = '',
  timeRange = '24h',
  onTimeRangeChange,
  className,
}: TimeSeriesChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const chartData = useMemo(() => {
    if (data.length === 0) return null;
    const values = data.map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const padding = 4;
    const width = 400;
    const height = 120;

    const points = data.map((d, i) => ({
      x: padding + (i / (data.length - 1)) * (width - padding * 2),
      y: padding + (1 - (d.value - min) / range) * (height - padding * 2),
    }));

    const pathD = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
      .join(' ');

    const areaD = `${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

    return { points, pathD, areaD, min, max, width, height };
  }, [data]);

  if (!chartData || data.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[120px] flex items-center justify-center text-sm text-muted-foreground">
            No data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const hoveredPoint = hoveredIndex !== null ? chartData.points[hoveredIndex] : null;
  const hoveredValue = hoveredIndex !== null ? data[hoveredIndex] : null;

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        {onTimeRangeChange && (
          <div className="flex gap-1">
            {TIME_RANGES.map((range) => (
              <Button
                key={range}
                variant={timeRange === range ? 'default' : 'ghost'}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => onTimeRangeChange(range)}
              >
                {range}
              </Button>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="relative">
          <svg
            viewBox={`0 0 ${chartData.width} ${chartData.height}`}
            className="w-full h-[120px]"
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
              <line
                key={pct}
                x1={4}
                y1={4 + pct * (chartData.height - 8)}
                x2={chartData.width - 4}
                y2={4 + pct * (chartData.height - 8)}
                stroke="currentColor"
                className="text-border"
                strokeWidth="0.5"
                strokeDasharray="4 4"
              />
            ))}

            {/* Area fill */}
            <path d={chartData.areaD} fill={color} opacity="0.1" />

            {/* Line */}
            <path
              d={chartData.pathD}
              fill="none"
              stroke={color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Hover line + dot */}
            {hoveredPoint && (
              <>
                <line
                  x1={hoveredPoint.x}
                  y1={4}
                  x2={hoveredPoint.x}
                  y2={chartData.height - 4}
                  stroke="currentColor"
                  className="text-muted-foreground"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <circle cx={hoveredPoint.x} cy={hoveredPoint.y} r="4" fill={color} />
              </>
            )}

            {/* Single overlay for hover detection */}
            <rect
              x={0}
              y={0}
              width={chartData.width}
              height={chartData.height}
              fill="transparent"
              onMouseMove={(e) => {
                const svg = e.currentTarget.closest('svg');
                if (!svg) return;
                const rect = svg.getBoundingClientRect();
                const mouseX = ((e.clientX - rect.left) / rect.width) * chartData.width;
                let closest = 0;
                let minDist = Infinity;
                chartData.points.forEach((p, i) => {
                  const dist = Math.abs(p.x - mouseX);
                  if (dist < minDist) { minDist = dist; closest = i; }
                });
                setHoveredIndex(closest);
              }}
            />
          </svg>

          {/* Tooltip */}
          {hoveredValue && (
            <div className="absolute top-0 right-0 bg-background border rounded px-2 py-1 text-xs shadow-sm">
              <span className="font-mono">
                {hoveredValue.value.toFixed(1)}{unit}
              </span>
              <span className="text-muted-foreground ml-2">
                {new Date(hoveredValue.timestamp).toLocaleTimeString()}
              </span>
            </div>
          )}
        </div>

        {/* Y-axis labels */}
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>{chartData.max.toFixed(1)}{unit}</span>
          <span>{chartData.min.toFixed(1)}{unit}</span>
        </div>
      </CardContent>
    </Card>
  );
}
