import React, { useRef, useEffect } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';
import { format } from 'date-fns';

const COLORS = {
  blue:   { stroke: '#3b82f6', fill: '#3b82f6' },
  green:  { stroke: '#10b981', fill: '#10b981' },
  amber:  { stroke: '#f59e0b', fill: '#f59e0b' },
  red:    { stroke: '#ef4444', fill: '#ef4444' },
  purple: { stroke: '#8b5cf6', fill: '#8b5cf6' },
  cyan:   { stroke: '#06b6d4', fill: '#06b6d4' },
};

const MAX_POINTS = 60;

export default function LiveChart({ data, tagName, label, unit, color = 'blue', warnHigh, warnLow }) {
  const c = COLORS[color] || COLORS.blue;

  const formatted = data.map((d) => ({
    ...d,
    time: format(new Date(d.timestamp || d.ts || Date.now()), 'HH:mm:ss'),
  })).slice(-MAX_POINTS);

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.[0]) return null;
    return (
      <div className="bg-hydro-card border border-hydro-border rounded-lg px-3 py-2 text-xs">
        <p className="text-slate-400">{payload[0].payload.time}</p>
        <p className="font-mono font-semibold text-white">{payload[0].value?.toFixed(3)} {unit}</p>
      </div>
    );
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-white">{label}</p>
        <span className="text-xs font-mono text-slate-400">{unit}</span>
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <AreaChart data={formatted} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad-${tagName}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={c.fill} stopOpacity={0.25} />
              <stop offset="95%" stopColor={c.fill} stopOpacity={0.0}  />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2a40" />
          <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip content={<CustomTooltip />} />
          {warnHigh && <ReferenceLine y={warnHigh} stroke="#f59e0b" strokeDasharray="4 2" strokeWidth={1} />}
          {warnLow  && <ReferenceLine y={warnLow}  stroke="#f59e0b" strokeDasharray="4 2" strokeWidth={1} />}
          <Area
            type="monotone"
            dataKey="value"
            stroke={c.stroke}
            strokeWidth={2}
            fill={`url(#grad-${tagName})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
