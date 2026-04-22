import React from 'react';
import { NavLink } from 'react-router-dom';
import useAuthStore from '../../store/authStore';

const NAV = [
  { to: '/',          label: 'Dashboard',   icon: '⚡', permission: null },
  { to: '/alarms',    label: 'Alarms',      icon: '🔔', permission: 'alarms' },
  { to: '/reports',   label: 'Reports',     icon: '📊', permission: 'reports' },
  { to: '/historical',label: 'Historical',  icon: '📈', permission: 'historical' },
  { to: '/admin',     label: 'Admin',       icon: '⚙️',  permission: 'admin' },
];

export default function Sidebar() {
  const { user, hasPermission } = useAuthStore();

  return (
    <aside className="w-60 flex-shrink-0 bg-hydro-card border-r border-hydro-border flex flex-col">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-hydro-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center text-lg">💧</div>
          <div>
            <p className="text-sm font-bold text-white leading-tight">Hydro Monitor</p>
            <p className="text-xs text-slate-400">Plant Control System</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(({ to, label, icon, permission }) => {
          if (permission && !hasPermission(permission)) return null;
          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-brand-600/20 text-brand-400 border border-brand-600/30'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <span className="text-base">{icon}</span>
              {label}
            </NavLink>
          );
        })}
      </nav>

      {/* User info */}
      <div className="px-4 py-4 border-t border-hydro-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-brand-700 flex items-center justify-center text-sm font-bold">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
            <p className="text-xs text-slate-500 capitalize">{user?.role}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
