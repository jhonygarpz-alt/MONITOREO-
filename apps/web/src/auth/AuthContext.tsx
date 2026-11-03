import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import { setTimezone } from '../lib/format';

export interface Me { id: string; email: string; fullName: string; roles: string[]; permissions: string[]; mustChangePwd: boolean; settings: { timezone: string; trainingTimezoneConfirmed: boolean } }
interface Ctx { me: Me | null; loading: boolean; can: (...p: string[]) => boolean; login: (e: string, p: string) => Promise<void>; logout: () => Promise<void>; refresh: () => Promise<void> }
const AuthCtx = createContext<Ctx>(null as unknown as Ctx);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try {
      const m = await api.get<Me>('/auth/me');
      setTimezone(m.settings.timezone);
      setMe(m);
    } catch { setMe(null); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const h = () => setMe(null);
    window.addEventListener('cim:unauthorized', h);
    return () => window.removeEventListener('cim:unauthorized', h);
  }, []);
  const can = useCallback((...p: string[]) => !!me && p.some((x) => me.permissions.includes(x)), [me]);
  const login = async (email: string, password: string) => { await api.post('/auth/login', { email, password }); await refresh(); };
  const logout = async () => { await api.post('/auth/logout').catch(() => {}); setMe(null); };
  return <AuthCtx.Provider value={{ me, loading, can, login, logout, refresh }}>{children}</AuthCtx.Provider>;
}
