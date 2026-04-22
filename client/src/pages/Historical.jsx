import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { readingsApi } from '../services/api';
import { format, subHours } from 'date-fns';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

const TAGS = [
  'Generator.Power', 'Generator.Frequency', 'Generator.Voltage_RY', 'Generator.Voltage_YB',
  'Generator.Voltage_BR', 'Generator.Current_R', 'Generator.Current_Y', 'Generator.Current_B',
  'Generator.PowerFactor', 'Generator.kVAR', 'Generator.Temperature',
  'Plant.TotalEnergy', 'Plant.WaterLevel', 'Turbine.Speed',
];

const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316'];

export default function Historical() {
  const [selectedTags, setSelectedTags] = useState(['Generator.Power', 'Generator.Frequency']);
  const [from, setFrom] = useState(format(subHours(new Date(), 6), "yyyy-MM-dd'T'HH:mm"));
  const [to,   setTo]   = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [bucket, setBucket] = useState('10');

  const enabled = selectedTags.length > 0;

  const queries = selectedTags.map((tag) =>
    useQuery({
      queryKey: ['history-agg', tag, from, to, bucket],
      queryFn: () =>
        readingsApi.aggregated({ tagName: tag, from: new Date(from).toISOString(), to: new Date(to).toISOString(), bucket }).then((r) => r.data.data),
      enabled,
    })
  );

  // Merge by bucket timestamp
  const mergedMap = {};
  queries.forEach((q, i) => {
    (q.data || []).forEach((point) => {
      const key = point.bucket;
      if (!mergedMap[key]) mergedMap[key] = { time: format(new Date(key), 'dd/MM HH:mm') };
      mergedMap[key][selectedTags[i]] = parseFloat(point.avg_value).toFixed(4);
    });
  });
  const chartData = Object.values(mergedMap).sort((a, b) => a.time > b.time ? 1 : -1);

  const loading = queries.some((q) => q.isLoading);

  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-white">Historical Data</h1>

      {/* Controls */}
      <div className="card space-y-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">From</label>
            <input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} className="input w-48" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">To</label>
            <input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} className="input w-48" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Bucket (min)</label>
            <select value={bucket} onChange={(e) => setBucket(e.target.value)} className="input w-28">
              <option value="1">1 min</option>
              <option value="5">5 min</option>
              <option value="10">10 min</option>
              <option value="30">30 min</option>
              <option value="60">1 hour</option>
            </select>
          </div>
        </div>

        {/* Tag selector */}
        <div>
          <p className="text-xs text-slate-400 mb-2">Select Tags</p>
          <div className="flex flex-wrap gap-2">
            {TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  selectedTags.includes(tag)
                    ? 'bg-brand-600/30 border-brand-500 text-brand-300'
                    : 'border-hydro-border text-slate-400 hover:border-slate-500'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="card">
        {loading ? (
          <div className="h-64 flex items-center justify-center text-slate-400">Loading...</div>
        ) : chartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-slate-400">No data for selected range</div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2a40" />
              <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #1f2a40', borderRadius: 8 }}
                labelStyle={{ color: '#94a3b8', fontSize: 11 }}
                itemStyle={{ fontSize: 11 }}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
              {selectedTags.map((tag, i) => (
                <Line
                  key={tag}
                  type="monotone"
                  dataKey={tag}
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Raw table */}
      {chartData.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto max-h-80">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-hydro-card">
                <tr className="border-b border-hydro-border text-slate-400 uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">Time</th>
                  {selectedTags.map((t) => <th key={t} className="px-4 py-3 text-left">{t.split('.')[1]}</th>)}
                </tr>
              </thead>
              <tbody>
                {chartData.map((row, i) => (
                  <tr key={i} className="table-row font-mono">
                    <td className="px-4 py-2 text-slate-400">{row.time}</td>
                    {selectedTags.map((t) => (
                      <td key={t} className="px-4 py-2 text-slate-200">{row[t] ?? '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
