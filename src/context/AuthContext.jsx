import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api('/auth/me').then((r) => {
      if (!alive) return;
      setUser(r.ok ? r.data.user : null);
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  const login = useCallback(async (identifier, password) => {
    const r = await api('/auth/login', { method: 'POST', body: { identifier, password } });
    if (r.ok) setUser(r.data.user);
    return r;
  }, []);
  const register = useCallback(async (payload) => {
    const r = await api('/auth/register', { method: 'POST', body: payload });
    if (r.ok) setUser(r.data.user);
    return r;
  }, []);
  const refresh = useCallback(async () => {
    const r = await api('/auth/me');
    setUser(r.ok ? r.data.user : null);
  }, []);
  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' });
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, login, register, logout, refresh }), [user, loading, login, register, logout, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
