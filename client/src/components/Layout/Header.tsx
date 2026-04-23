import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { alarmsApi } from '../../services/api';
import { useSocket } from '../../hooks/useSocket';
import useAuthStore from '../../store/authStore';
import type { AlarmStats } from '../../types';

export default function Header() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const { connected } = useSocket();

  const { data: stats } = useQuery<AlarmStats>({
    queryKey: ['alarm-stats'],
    queryFn: () => alarmsApi.stats().then((r) => r.data),
    refetchInterval: 30_000,
  });

  return (
    <header className="h-14 bg-hydro-card border-b border-hydro-border flex items-center justify-between px-6 flex-shrink-0">
      <div className="flex items-center gap-4">
        {/* SCADA connection indicator */}
        <div className="flex items-center gap-2">
          <span className={`status-dot ${connected ? 'bg-emerald-400 animate-pulse2' : 'bg-red-500'}`} />
          <span className="text-xs text-slate-400">{connected ? 'SCADA Live' : 'Connecting...'}</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Active alarm count */}
        {stats != null && stats.active_count > 0 && (
          <button
            onClick={() => navigate('/alarms')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-900/40 border border-red-700/50 text-red-300 text-xs font-semibold hover:bg-red-900/60 transition-colors"
          >
            🔔 {stats.active_count} Active{stats.critical_count > 0 ? ` (${stats.critical_count} critical)` : ''}
          </button>
        )}

        <span className="text-xs text-slate-500">
          {new Date().toLocaleDateString('en-IN', { dateStyle: 'medium' })}
        </span>

        <button
          onClick={logout}
          className="text-xs text-slate-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-white/10"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
