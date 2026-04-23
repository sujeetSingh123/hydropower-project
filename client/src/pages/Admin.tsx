import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient, QueryClient } from '@tanstack/react-query';
import { adminApi, authApi } from '../services/api';
import toast from 'react-hot-toast';
import type {
  ScadaSettings,
  ScadaSettingsForm,
  ScadaTag,
  User,
  NotificationSetting,
  PollerStatus,
  CreateUserForm,
} from '../types';

const TABS = ['SCADA', 'Tags', 'Users', 'Notifications', 'System'] as const;
type TabName = typeof TABS[number];

interface WithQC {
  qc: QueryClient;
}

export default function Admin() {
  const [tab, setTab] = useState<TabName>('SCADA');
  const qc = useQueryClient();

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-white">Admin Settings</h1>
      <div className="flex gap-2 border-b border-hydro-border pb-3">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === 'SCADA'         && <ScadaSettings qc={qc} />}
      {tab === 'Tags'          && <TagSettings qc={qc} />}
      {tab === 'Users'         && <UserSettings qc={qc} />}
      {tab === 'Notifications' && <NotificationSettings qc={qc} />}
      {tab === 'System'        && <SystemStatus />}
    </div>
  );
}

// ─── SCADA Settings ───────────────────────────────────────────────────────────
function ScadaSettings({ qc }: WithQC) {
  const { data } = useQuery<ScadaSettings>({
    queryKey: ['scada-settings'],
    queryFn: () => adminApi.scadaSettings().then((r) => r.data.settings),
  });
  const [form, setForm] = useState<ScadaSettingsForm>({});

  const mut = useMutation({
    mutationFn: (d: ScadaSettingsForm) => adminApi.updateScada(d),
    onSuccess: () => {
      toast.success('Settings saved');
      qc.invalidateQueries({ queryKey: ['scada-settings'] });
    },
    onError: () => toast.error('Failed to save'),
  });

  const cfg: Partial<ScadaSettings> = { ...data, ...form };

  type ScadaField = {
    label: string;
    key: keyof ScadaSettingsForm;
    type: 'text' | 'number';
  };

  const fields: ScadaField[] = [
    { label: 'Connection Type',        key: 'connection_type',    type: 'text' },
    { label: 'Endpoint URL',           key: 'endpoint_url',       type: 'text' },
    { label: 'Poll Interval (ms)',     key: 'poll_interval_ms',   type: 'number' },
    { label: 'Reconnect Delay (ms)',   key: 'reconnect_delay_ms', type: 'number' },
  ];

  return (
    <div className="card max-w-lg space-y-4">
      <h2 className="text-sm font-semibold text-white">OPC UA / SCADA Connection</h2>
      {fields.map(({ label, key, type }) => (
        <div key={key}>
          <label className="block text-xs text-slate-400 mb-1.5">{label}</label>
          <input
            type={type}
            value={cfg[key] ?? ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setForm((f) => ({ ...f, [key]: e.target.value }))
            }
            className="input"
          />
        </div>
      ))}
      <button onClick={() => mut.mutate(form)} disabled={mut.isPending} className="btn-primary">
        {mut.isPending ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );
}

// ─── Tag Settings ─────────────────────────────────────────────────────────────
function TagSettings({ qc }: WithQC) {
  const { data, isLoading } = useQuery<ScadaTag[]>({
    queryKey: ['tags'],
    queryFn: () => adminApi.tags().then((r) => r.data.tags),
  });
  const [editing, setEditing] = useState<ScadaTag | null>(null);

  const mut = useMutation({
    mutationFn: ({ id, ...d }: Partial<ScadaTag> & { id: number }) => adminApi.updateTag(id, d),
    onSuccess: () => {
      toast.success('Tag updated');
      qc.invalidateQueries({ queryKey: ['tags'] });
      setEditing(null);
    },
    onError: () => toast.error('Failed'),
  });

  const tags = data ?? [];

  type EditableKey = 'display_name' | 'unit' | 'alarm_low' | 'alarm_high' | 'warn_low' | 'warn_high';
  const numericKeys: EditableKey[] = ['alarm_low', 'alarm_high', 'warn_low', 'warn_high'];
  const editableKeys: EditableKey[] = ['display_name', 'unit', 'alarm_low', 'alarm_high', 'warn_low', 'warn_high'];

  return (
    <div className="space-y-3">
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-hydro-border text-slate-400 uppercase tracking-wider">
                {['Tag Name','Display','Unit','Alarm Low','Alarm High','Warn Low','Warn High','Active','Action'].map((h) => (
                  <th key={h} className="px-3 py-3 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500">Loading...</td>
                </tr>
              ) : tags.map((tag) =>
                editing?.id === tag.id ? (
                  <tr key={tag.id} className="border-b border-hydro-border bg-brand-900/10">
                    <td className="px-3 py-2 font-mono text-slate-300">{tag.tag_name}</td>
                    {editableKeys.map((k) => (
                      <td key={k} className="px-2 py-1">
                        <input
                          type={numericKeys.includes(k) ? 'number' : 'text'}
                          value={editing[k] ?? ''}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setEditing((s) => s ? { ...s, [k]: e.target.value } : s)
                          }
                          className="input py-1 text-xs w-20"
                        />
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={!!editing.is_active}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setEditing((s) => s ? { ...s, is_active: e.target.checked } : s)
                        }
                      />
                    </td>
                    <td className="px-3 py-2 flex gap-1">
                      <button
                        onClick={() => mut.mutate(editing)}
                        className="text-xs px-2 py-1 rounded bg-emerald-700 text-white"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditing(null)}
                        className="text-xs px-2 py-1 rounded bg-hydro-border text-white"
                      >
                        Cancel
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={tag.id} className="table-row">
                    <td className="px-3 py-2 font-mono text-slate-300 whitespace-nowrap">{tag.tag_name}</td>
                    <td className="px-3 py-2">{tag.display_name}</td>
                    <td className="px-3 py-2">{tag.unit}</td>
                    <td className="px-3 py-2 font-mono">{tag.alarm_low ?? '—'}</td>
                    <td className="px-3 py-2 font-mono">{tag.alarm_high ?? '—'}</td>
                    <td className="px-3 py-2 font-mono">{tag.warn_low ?? '—'}</td>
                    <td className="px-3 py-2 font-mono">{tag.warn_high ?? '—'}</td>
                    <td className="px-3 py-2">{tag.is_active ? '✓' : '✗'}</td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => setEditing({ ...tag })}
                        className="text-xs px-2 py-1 rounded bg-brand-700 text-white"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── User Settings ────────────────────────────────────────────────────────────
function UserSettings({ qc }: WithQC) {
  const { data } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => authApi.listUsers().then((r) => r.data.users),
  });
  const [showCreate, setShowCreate] = useState<boolean>(false);
  const [form, setForm] = useState<CreateUserForm>({ name: '', email: '', password: '', role_id: 2 });

  const createMut = useMutation({
    mutationFn: (d: CreateUserForm) => authApi.createUser(d),
    onSuccess: () => {
      toast.success('User created');
      qc.invalidateQueries({ queryKey: ['users'] });
      setShowCreate(false);
      setForm({ name: '', email: '', password: '', role_id: 2 });
    },
    onError: () => toast.error('Failed to create user'),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      authApi.updateUser(id, { is_active }),
    onSuccess: () => {
      toast.success('Updated');
      qc.invalidateQueries({ queryKey: ['users'] });
    },
  });

  type FormTextField = 'name' | 'email' | 'password';
  const textFields: [string, FormTextField, string][] = [
    ['Name', 'name', 'text'],
    ['Email', 'email', 'email'],
    ['Password', 'password', 'password'],
  ];

  return (
    <div className="space-y-4">
      <button onClick={() => setShowCreate((s) => !s)} className="btn-primary text-sm">
        {showCreate ? 'Cancel' : '+ New User'}
      </button>

      {showCreate && (
        <div className="card max-w-sm space-y-3">
          {textFields.map(([l, k, t]) => (
            <div key={k}>
              <label className="block text-xs text-slate-400 mb-1">{l}</label>
              <input
                type={t}
                value={form[k]}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setForm((f) => ({ ...f, [k]: e.target.value }))
                }
                className="input"
              />
            </div>
          ))}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Role</label>
            <select
              value={form.role_id}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setForm((f) => ({ ...f, role_id: +e.target.value }))
              }
              className="input"
            >
              <option value={1}>Admin</option>
              <option value={2}>Operator</option>
              <option value={3}>Viewer</option>
            </select>
          </div>
          <button
            onClick={() => createMut.mutate(form)}
            disabled={createMut.isPending}
            className="btn-primary w-full"
          >
            {createMut.isPending ? 'Creating...' : 'Create User'}
          </button>
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hydro-border text-xs text-slate-400 uppercase tracking-wider">
              {['Name','Email','Role','Status','Last Login','Action'].map((h) => (
                <th key={h} className="px-4 py-3 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((u) => (
              <tr key={u.id} className="table-row text-xs">
                <td className="px-4 py-3 font-medium text-white">{u.name}</td>
                <td className="px-4 py-3 text-slate-400">{u.email}</td>
                <td className="px-4 py-3 capitalize">{u.role}</td>
                <td className="px-4 py-3">
                  <span className={u.is_active ? 'badge-ok' : 'badge-crit'}>
                    {u.is_active ? 'Active' : 'Disabled'}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : 'Never'}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleMut.mutate({ id: u.id, is_active: !u.is_active })}
                    className="text-xs px-2 py-1 rounded bg-hydro-border hover:bg-slate-700 text-white"
                  >
                    {u.is_active ? 'Disable' : 'Enable'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Notification Settings ────────────────────────────────────────────────────
function NotificationSettings({ qc }: WithQC) {
  const { data } = useQuery<NotificationSetting[]>({
    queryKey: ['notifications'],
    queryFn: () => adminApi.notifications().then((r) => r.data.settings),
  });

  const mut = useMutation({
    mutationFn: ({ id, ...d }: Partial<NotificationSetting> & { id: number }) =>
      adminApi.updateNotification(id, d),
    onSuccess: () => {
      toast.success('Saved');
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  return (
    <div className="space-y-4 max-w-lg">
      {(data ?? []).map((setting) => (
        <div key={setting.id} className="card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white capitalize">{setting.type} Notifications</h3>
            <button
              onClick={() => mut.mutate({ id: setting.id, is_active: !setting.is_active })}
              className={`text-xs px-3 py-1 rounded-full transition-colors ${
                setting.is_active ? 'bg-emerald-700 text-white' : 'bg-hydro-border text-slate-400'
              }`}
            >
              {setting.is_active ? 'Enabled' : 'Disabled'}
            </button>
          </div>
          <p className="text-xs text-slate-500 font-mono bg-hydro-dark rounded p-3 overflow-x-auto">
            {JSON.stringify(setting.config, null, 2)}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── System Status ────────────────────────────────────────────────────────────
function SystemStatus() {
  const { data, refetch } = useQuery<PollerStatus>({
    queryKey: ['poller-status'],
    queryFn: () => adminApi.pollerStatus().then((r) => r.data),
    refetchInterval: 10_000,
  });

  const triggerSummary = useMutation({
    mutationFn: () => adminApi.triggerDailySummary(),
    onSuccess: () => toast.success('Daily summary generated'),
    onError: () => toast.error('Failed'),
  });

  return (
    <div className="space-y-4 max-w-lg">
      <div className="card space-y-3">
        <h2 className="text-sm font-semibold text-white">SCADA Poller Status</h2>
        {data != null && Object.entries(data).map(([k, v]) => (
          <div key={k} className="flex justify-between text-xs">
            <span className="text-slate-400 capitalize">{k.replace(/([A-Z])/g, ' $1')}</span>
            <span className={`font-mono ${v === true ? 'text-emerald-400' : v === false ? 'text-red-400' : 'text-slate-200'}`}>
              {String(v)}
            </span>
          </div>
        ))}
        <button onClick={() => refetch()} className="btn-ghost text-xs">Refresh</button>
      </div>

      <div className="card space-y-3">
        <h2 className="text-sm font-semibold text-white">Manual Operations</h2>
        <div className="flex gap-3">
          <button
            onClick={() => triggerSummary.mutate()}
            disabled={triggerSummary.isPending}
            className="btn-primary text-sm"
          >
            {triggerSummary.isPending ? 'Running...' : 'Generate Yesterday Summary'}
          </button>
        </div>
      </div>
    </div>
  );
}
