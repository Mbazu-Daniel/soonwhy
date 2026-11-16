import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatRate, timeLabel, type HostPoint } from '~/lib/host-metrics-view';

interface HostChartsProps {
  points: HostPoint[];
}

const GRID = 'rgba(255,255,255,0.08)';
const AXIS = { fontSize: 11, fill: 'rgba(255,255,255,0.55)' };
const TOOLTIP = {
  contentStyle: { background: '#0b1210', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: 'rgba(255,255,255,0.7)' },
};

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs text-muted-foreground">{title}</p>
      <div className="h-44">{children}</div>
    </div>
  );
}

function percentChart(points: HostPoint[], key: 'cpu' | 'memory' | 'disk', color: string, name: string, span: number) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={points} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="time" type="number" scale="time" domain={['dataMin', 'dataMax']} tick={AXIS} tickLine={false} axisLine={false} minTickGap={48} tickFormatter={(t: number) => timeLabel(t, span)} />
        <YAxis domain={[0, 100]} tick={AXIS} tickLine={false} axisLine={false} width={40} tickFormatter={(v: number) => `${v}%`} />
        <Tooltip {...TOOLTIP} labelFormatter={(t) => timeLabel(Number(t), span)} formatter={(v) => [`${Number(v).toFixed(1)}%`, name]} />
        <Area type="monotone" dataKey={key} stroke={color} fill={color} fillOpacity={0.18} strokeWidth={2} dot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function HostCharts({ points }: HostChartsProps) {
  const span = points.length > 1 ? points[points.length - 1]!.time - points[0]!.time : 0;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title="CPU usage">{percentChart(points, 'cpu', '#3b82f6', 'CPU', span)}</Panel>
      <Panel title="Memory used">{percentChart(points, 'memory', '#22c55e', 'Memory', span)}</Panel>
      <Panel title="Disk used">{percentChart(points, 'disk', '#eab308', 'Disk', span)}</Panel>
      <Panel title="Network traffic">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="time" type="number" scale="time" domain={['dataMin', 'dataMax']} tick={AXIS} tickLine={false} axisLine={false} minTickGap={48} tickFormatter={(t: number) => timeLabel(t, span)} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} width={64} tickFormatter={(v: number) => formatRate(v)} />
            <Tooltip {...TOOLTIP} labelFormatter={(t) => timeLabel(Number(t), span)} formatter={(v, name) => [formatRate(Number(v)), name]} />
            <Area type="monotone" dataKey="receive" name="Received" stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.15} strokeWidth={2} dot={false} isAnimationActive={false} />
            <Area type="monotone" dataKey="transmit" name="Sent" stroke="#f472b6" fill="#f472b6" fillOpacity={0.15} strokeWidth={2} dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </Panel>
    </div>
  );
}
