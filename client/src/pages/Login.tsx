import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { authApi } from '../services/api';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';

export default function Login() {
  const { isAuthenticated, setAuth } = useAuthStore();
  const [email, setEmail]     = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  if (isAuthenticated) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await authApi.login(email, password);
      setAuth(data.token, data.user);
      toast.success(`Welcome, ${data.user.name}`);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e.response?.data?.error ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-hydro-dark flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-brand-600 flex items-center justify-center text-3xl mx-auto mb-4">💧</div>
          <h1 className="text-2xl font-bold text-white">Hydro Monitor</h1>
          <p className="text-slate-400 text-sm mt-1">Plant Control &amp; Monitoring System</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5 uppercase tracking-wider">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
              className="input"
              placeholder="operator@plant.local"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5 uppercase tracking-wider">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
              required
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 p-4 bg-hydro-card border border-hydro-border rounded-xl text-xs text-slate-500 space-y-1">
          <p className="text-slate-400 font-semibold mb-2">Demo Credentials</p>
          <p>Admin:    admin@hydropower.local / Admin@123</p>
          <p>Operator: operator@hydropower.local / Operator@123</p>
          <p>Viewer:   viewer@hydropower.local / Viewer@123</p>
        </div>
      </div>
    </div>
  );
}
