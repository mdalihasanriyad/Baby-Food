import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { api } from '../../services/api.js';
import { useNoIndex } from '../../hooks/useNoIndex.js';

const AdminContext = createContext(null);
export const useAdmin = () => useContext(AdminContext);

const nav = [['/admin/dashboard', 'Dashboard'], ['/admin/orders', 'Orders'], ['/admin/products', 'Products'], ['/admin/categories', 'Categories'], ['/admin/customers', 'Customers'], ['/admin/reviews', 'Reviews'], ['/admin/reports', 'Reports'], ['/admin/settings', 'Settings']];
const cls = ({ isActive }) => `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-sky-100 text-sky-700' : 'text-ink-soft hover:text-sky-700'}`;

export default function AdminLayout() {
  useNoIndex();
  const navigate = useNavigate();
  const [admin, setAdmin] = useState(null);

  // Every admin API call goes through here: an expired/invalid session sends you back to the login page.
  const call = useCallback(async (path, opts) => {
    const r = await api(`/admin${path}`, opts);
    if (r.status === 401) navigate('/admin/login', { replace: true });
    return r;
  }, [navigate]);

  useEffect(() => {
    let alive = true;
    api('/admin/auth/me').then((r) => {
      if (!alive) return;
      if (r.ok) setAdmin(r.data.user); else navigate('/admin/login', { replace: true });
    });
    return () => { alive = false; };
  }, [navigate]);

  const logout = async () => { await api('/admin/auth/logout', { method: 'POST' }); navigate('/admin/login', { replace: true }); };

  if (!admin) return <div className="p-10 text-center text-ink-soft" role="status">Loading…</div>;
  return (
    <AdminContext.Provider value={{ admin, call }}>
      <header className="border-b border-sky-100 bg-white print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-2">
          <strong className="mr-3 text-sky-700">BFG Admin</strong>
          <nav className="flex flex-wrap gap-1" aria-label="Admin">{nav.map(([to, l]) => <NavLink key={to} to={to} className={cls}>{l}</NavLink>)}</nav>
          <span className="ml-auto hidden text-sm text-ink-soft sm:inline">{admin.name}</span>
          <button className="btn-ghost !min-h-[40px]" onClick={logout}>Log out</button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 print:max-w-none print:p-0"><Outlet /></main>
    </AdminContext.Provider>
  );
}
