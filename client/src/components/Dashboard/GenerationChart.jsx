import React from 'react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { format } from 'date-fns';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-hydro-card border border-hydro-border rounded-lg px-3 py-2 text-xs space-y-1">
      <p className="text-slate-300 font-medium">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {Number(p.value).toFixed(1)} {p.name === 'Generation' ? 'kWh' : 'kW'}
        </p>
      ))}
    </div>
  );
};

export default function GenerationChart({ data = [], title = 'Generation Trend' }) {
  const formatted = data.map((d) => ({
    ...d,
    date: format(new Date(d.date), 'dd MMM'),
    Generation: parseFloat(d.total_generation_kwh || 0),
    'Peak Load': parseFloat(d.peak_load_kw || 0),
  }));

  return (
    <div className="card">
      <p className="text-sm font-semibold text-white mb-4">{title}</p>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={formatted} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2a40" />
          <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} />
          <YAxis yAxisId="left"  tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis yAxisId="right" orientation="right" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
          <Bar   yAxisId="left"  dataKey="Generation" fill="#3b82f6" fillOpacity={0.8} radius={[3,3,0,0]} />
          <Line  yAxisId="right" dataKey="Peak Load"  stroke="#f59e0b" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
