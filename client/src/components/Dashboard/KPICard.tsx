import React from 'react';

type KPIStatus = 'ok' | 'warning' | 'critical' | 'default';

const statusColors: Record<KPIStatus, string> = {
  ok:       'border-emerald-700/40 bg-emerald-900/10',
  warning:  'border-amber-700/40 bg-amber-900/10',
  critical: 'border-red-700/40 bg-red-900/10',
  default:  'border-hydro-border',
};

interface KPICardProps {
  label:     string;
  value:     string | number | null | undefined;
  unit?:     string;
  icon?:     string;
  trend?:    number;
  status?:   KPIStatus;
  subtitle?: string;
}

export default function KPICard({ label, value, unit, icon, trend, status = 'default', subtitle }: KPICardProps) {
  const borderClass = statusColors[status] ?? statusColors.default;

  return (
    <div className={`card border ${borderClass} flex flex-col gap-1`}>
      <div className="flex items-start justify-between">
        <p className="kpi-label">{label}</p>
        {icon && <span className="text-lg">{icon}</span>}
      </div>
      <div className="flex items-end gap-2 mt-1">
        <span className={`kpi-value ${
          status === 'critical' ? 'text-red-400' :
          status === 'warning'  ? 'text-amber-400' :
          status === 'ok'       ? 'text-emerald-400' : 'text-white'
        }`}>
          {value ?? '—'}
        </span>
        {unit && <span className="text-sm text-slate-400 mb-1">{unit}</span>}
      </div>
      {(subtitle !== undefined || trend !== undefined) && (
        <div className="flex items-center gap-2 mt-1">
          {subtitle && <span className="text-xs text-slate-500">{subtitle}</span>}
          {trend !== undefined && (
            <span className={`text-xs font-medium ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
            </span>
          )}
        </div>
      )}
    </div>
  );
}
