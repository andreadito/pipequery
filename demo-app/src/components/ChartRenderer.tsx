import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const COLORS = ['#5b9cf6', '#ff9800', '#4caf50', '#ef5350', '#ab47bc', '#26c6da', '#ffa726', '#8d6e63', '#78909c', '#d4e157'];

const tooltipStyle = {
  backgroundColor: '#1a2332',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  fontSize: '0.78rem',
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
          <Pie data={chartData} cx="50%" cy="50%" innerRadius="40%" outerRadius="72%" paddingAngle={2} dataKey="value" stroke="none">
            {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={(v: number) => fmtNum(v)} contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: '0.72rem' }} formatter={(v: string) => <span style={{ color: '#e0e6ed' }}>{v}</span>} />
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
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
        <XAxis type="number" tickFormatter={fmtNum} tick={{ fill: '#8899aa', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="label" tick={{ fill: '#e0e6ed', fontSize: 11, fontWeight: 500 }} axisLine={false} tickLine={false} width={55} />
        <Tooltip formatter={(v: number) => fmtNum(v)} contentStyle={tooltipStyle} labelStyle={{ color: '#e0e6ed' }} />
        <Bar dataKey="value" fill="#ff9800" radius={[0, 4, 4, 0]} barSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}
