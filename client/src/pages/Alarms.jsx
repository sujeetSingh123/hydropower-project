import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { alarmsApi } from '../services/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';

const SEVERITY_CLASS = { critical: 'badge-crit', warning: 'badge-warn', info: 'badge-info' };
const STATUS_CLASS   = { active: 'badge-crit', acknowledged: 'badge-warn', resolved: 'badge-ok' };

export default function Alarms() {
  const qc = useQueryClient();
  const { hasPermission } = useAuthStore();
  const canAck = hasPermission('alarms');

  const [filters, setFilters] = useState({ status: '', severity: '' });
  const [page, setPage] = useState(0);
  const LIMIT = 25;

  const { data, isLoading } = useQuery({
    queryKey: ['alarms', filters, page],
    queryFn: () => alarmsApi.list({ ...filters, limit: LIMIT, offset: page * LIMIT }).then((r) => r.data),
    keepPreviousData: true,
  });

  const { data: stats } = useQuery({
    queryKey: ['alarm-stats'],
    queryFn: () => alarmsApi.stats().then((r) => r.data),
    refetchInterval: 30_000,
  });

  const ackMut = useMutation({
    mutationFn: (id) => alarmsApi.acknowledge(id),
    onSuccess: () => { toast.success('Acknowledged'); qc.invalidateQueries(['alarms']); qc.invalidateQueries(['alarm-stats']); },
    onError: () => toast.error('Failed'),
  });

  const alarms = data?.data || [];
  const total  = data?.total || 0;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-white">Alarm Management</h1>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Active',          value: stats.active_count,   cls: 'text-red-400' },
            { label: 'Critical Active', value: stats.critical_count, cls: 'text-red-500' },
            { label: 'Last 24h',        value: stats.last_24h,       cls: 'text-amber-400' },
            { label: 'Last 7 Days',     value: stats.last_7d,        cls: 'text-blue-400' },
          ].map((s) => (
            <div key={s.label} className="card text-center">
              <p className={`text-3xl font-bold font-mono ${s.cls}`}>{s.value ?? '—'}</p>
              <p className="text-xs text-slate-400 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="card flex flex-wrap gap-4 items-center">
        <select
          value={filters.status}
          onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); setPage(0); }}
          className="input w-40"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="resolved">Resolved</option>
        </select>
        <select
          value={filters.severity}
          onChange={(e) => { setFilters((f) => ({ ...f, severity: e.target.value })); setPage(0); }}
          className="input w-40"
        >
          <option value="">All Severity</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>
        <button onClick={() => { setFilters({ status: '', severity: '' }); setPage(0); }} className="btn-ghost text-sm">
          Clear
        </button>
        <span className="ml-auto text-sm text-slate-400">{total} records</span>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hydro-border text-xs text-slate-400 uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Time</th>
                <th className="px-4 py-3 text-left">Tag</th>
                <th className="px-4 py-3 text-left">Severity</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Message</th>
                <th className="px-4 py-3 text-left">Value</th>
                {canAck && <th className="px-4 py-3 text-left">Action</th>}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="table-row">
                    <td colSpan={7} className="px-4 py-3">
                      <div className="h-4 bg-hydro-border rounded animate-pulse w-3/4" />
                    </td>
                  </tr>
                ))
              ) : alarms.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No alarms found</td></tr>
              ) : (
                alarms.map((a) => (
                  <tr key={a.id} className="table-row">
                    <td className="px-4 py-3 text-xs font-mono text-slate-400 whitespace-nowrap">
                      {format(new Date(a.triggered_at), 'dd MMM HH:mm:ss')}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-300">{a.tag_name}</td>
                    <td className="px-4 py-3"><span className={SEVERITY_CLASS[a.severity] || 'badge-info'}>{a.severity}</span></td>
                    <td className="px-4 py-3"><span className={STATUS_CLASS[a.status] || 'badge-info'}>{a.status}</span></td>
                    <td className="px-4 py-3 text-xs text-slate-300 max-w-xs truncate">{a.message}</td>
                    <td className="px-4 py-3 font-mono text-xs">{a.value ?? '—'}</td>
                    {canAck && (
                      <td className="px-4 py-3">
                        {a.status === 'active' && (
                          <button
                            onClick={() => ackMut.mutate(a.id)}
                            disabled={ackMut.isPending}
                            className="text-xs px-2 py-1 rounded bg-brand-700 hover:bg-brand-600 text-white"
                          >
                            ACK
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-hydro-border text-xs text-slate-400">
          <span>{Math.min(page * LIMIT + 1, total)}–{Math.min((page + 1) * LIMIT, total)} of {total}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="btn-ghost py-1 px-2 text-xs disabled:opacity-40">← Prev</button>
            <button onClick={() => setPage((p) => p + 1)} disabled={(page + 1) * LIMIT >= total} className="btn-ghost py-1 px-2 text-xs disabled:opacity-40">Next →</button>
          </div>
        </div>
      </div>
    </div>
  );
}
