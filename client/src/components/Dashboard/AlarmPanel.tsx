import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { alarmsApi } from '../../services/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';
import type { AlarmSeverity } from '../../types';

const SEVERITY_CLASS: Record<AlarmSeverity, string> = {
  critical: 'badge-crit',
  warning:  'badge-warn',
  info:     'badge-info',
};

interface AlarmPanelProps {
  compact?: boolean;
}

export default function AlarmPanel({ compact = false }: AlarmPanelProps) {
  const qc = useQueryClient();
  const { hasPermission } = useAuthStore();
  const canAck = hasPermission('alarms');

  // compact prop reserved for future layout variation
  void compact;

  const { data, isLoading } = useQuery({
    queryKey: ['active-alarms'],
    queryFn: () => alarmsApi.list({ status: 'active', limit: 10 }).then((r) => r.data),
    refetchInterval: 15_000,
  });

  const ackMut = useMutation({
    mutationFn: (id: number) => alarmsApi.acknowledge(id),
    onSuccess: () => {
      toast.success('Alarm acknowledged');
      qc.invalidateQueries({ queryKey: ['active-alarms'] });
      qc.invalidateQueries({ queryKey: ['alarm-stats'] });
    },
    onError: () => toast.error('Failed to acknowledge'),
  });

  const alarms = data?.data ?? [];

  if (isLoading) return <div className="card animate-pulse h-32" />;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-white">Active Alarms</p>
        {alarms.length > 0 && (
          <span className="badge-crit">{alarms.length}</span>
        )}
      </div>

      {alarms.length === 0 ? (
        <div className="flex items-center gap-2 text-emerald-400 text-sm py-4">
          <span>✓</span>
          <span>All systems normal — no active alarms</span>
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {alarms.map((a) => (
            <div key={a.id} className="flex items-start justify-between gap-3 p-3 rounded-lg bg-hydro-dark border border-hydro-border">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={SEVERITY_CLASS[a.severity] ?? 'badge-info'}>{a.severity}</span>
                  <span className="text-xs text-slate-400 font-mono">{a.tag_name}</span>
                </div>
                <p className="text-xs text-slate-300 truncate">{a.message}</p>
                <p className="text-xs text-slate-500 mt-1">{format(new Date(a.triggered_at), 'dd MMM HH:mm:ss')}</p>
              </div>
              {canAck && (
                <button
                  onClick={() => ackMut.mutate(a.id)}
                  disabled={ackMut.isPending}
                  className="text-xs px-2 py-1 rounded bg-brand-700 hover:bg-brand-600 text-white transition-colors flex-shrink-0"
                >
                  ACK
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
