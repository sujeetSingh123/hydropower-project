import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';

interface AuthState {
  token:           string | null;
  user:            User | null;
  isAuthenticated: boolean;
  setAuth:         (token: string, user: User) => void;
  logout:          () => void;
  hasPermission:   (perm: string) => boolean;
}

const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token:           null,
      user:            null,
      isAuthenticated: false,

      setAuth: (token, user) => set({ token, user, isAuthenticated: true }),
      logout:  ()           => set({ token: null, user: null, isAuthenticated: false }),
      hasPermission: (perm) => {
        const { user } = get();
        if (!user) return false;
        if (user.role === 'admin') return true;
        return !!user.permissions?.[perm];
      },
    }),
    {
      name: 'hydro-auth',
      partialize: (s) => ({ token: s.token, user: s.user, isAuthenticated: s.isAuthenticated }),
    }
  )
);

export default useAuthStore;
