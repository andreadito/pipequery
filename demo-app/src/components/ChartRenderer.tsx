import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { useColorMode } from '../colorMode';
import { PALETTES } from '../theme';
import { C, FONT_MONO } from '../tokens';

// Concrete colours per mode: Recharts writes them into SVG attributes, where
// CSS variables are not resolved.
const SERIES = {
  dark: ['#3b82f6', '#e8a33d', '#22ab94', '#f23645', '#a78bfa', '#38bdf8', '#f472b6', '#94a3b8', '#facc15', '#4ade80'],
  light: ['#1f6feb', '#b06a00', '#089981', '#d9273a', '#7c3aed', '#0891b2', '#db2777', '#64748b', '#a16207', '#16a34a'],
} as const;

const tooltipStyle = {
  backgroundColor: C.surface,
  border: `1px solid ${C.borderHover}`,
  borderRadius: 0,
  color: C.text,
  fontFamily: FONT_MONO,
  fontSize: '0.72rem',
};

function fmtNum(v: number): string {
  if (Math.abs(v) >= 1e12) return `${(v / 1e12).toFixed(1)}T`;
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(v % 1 === 0 ? 0 : 2);
}

interface ChartRendererProps {
  data: Record<string, unknown>[];
  type: 'bar' | 'pie';
}

export default function ChartRenderer({ data, type }: ChartRendererProps) {
  const { mode } = useColorMode();
  const p = PALETTES[mode];
  const colors = SERIES[mode];

  if (!data.length) return null;

  const keys = Object.keys(data[0]);
  const labelKey = keys[0];
  const valueKey = keys[1];

  if (type === 'pie') {
    const chartData = data.map((d) => ({
      name: String(d[labelKey]),
      value: Number(d[valueKey]),
    }));
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={chartData} cx="50%" cy="50%" innerRadius="48%" outerRadius="72%" paddingAngle={1} dataKey="value" stroke={p.paper} strokeWidth={1}>
            {chartData.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
          </Pie>
          <Tooltip formatter={(v: number) => fmtNum(v)} contentStyle={tooltipStyle} itemStyle={{ color: C.text }} />
          <Legend
            iconType="square"
            iconSize={8}
            wrapperStyle={{ fontSize: '0.7rem', fontFamily: FONT_MONO }}
            formatter={(v: string) => <span style={{ color: C.textMuted }}>{v}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  // Bar chart
  const chartData = data.map((d) => ({
    label: String(d[labelKey]),
    value: Number(d[valueKey]),
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
        <CartesianGrid stroke={p.border} horizontal={false} />
        <XAxis type="number" tickFormatter={fmtNum} tick={{ fill: p.textMuted, fontSize: 10, fontFamily: FONT_MONO }} axisLine={{ stroke: p.border }} tickLine={false} />
        <YAxis type="category" dataKey="label" tick={{ fill: p.text, fontSize: 11, fontWeight: 500, fontFamily: FONT_MONO }} axisLine={{ stroke: p.border }} tickLine={false} width={55} />
        <Tooltip
          formatter={(v: number) => fmtNum(v)}
          contentStyle={tooltipStyle}
          labelStyle={{ color: C.text }}
          itemStyle={{ color: C.text }}
          cursor={{ fill: p.border, fillOpacity: 0.5 }}
        />
        <Bar dataKey="value" fill={p.primary} barSize={16} />
      </BarChart>
    </ResponsiveContainer>
  );
}
