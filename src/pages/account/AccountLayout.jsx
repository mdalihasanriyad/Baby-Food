import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLang } from '../../context/LanguageContext.jsx';
import { useNoIndex } from '../../hooks/useNoIndex.js';

const tabs = [['/account/orders', 'acct.orders'], ['/account/profile', 'acct.profile'], ['/account/reviews', 'acct.reviews'], ['/wishlist', 'acct.wishlist']];
const cls = ({ isActive }) => `inline-flex min-h-[44px] items-center whitespace-nowrap rounded-xl px-4 text-sm font-semibold ${isActive ? 'bg-sky-600 text-white' : 'text-sky-700 hover:bg-sky-50'}`;

export default function AccountLayout() {
  useNoIndex();
  const { t } = useLang();
  const { user, logout } = useAuth();
  return (
    <div className="container-x py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold sm:text-3xl">{t('auth.account')}</h1><p className="text-sm text-ink-soft">{user.name}</p></div>
        <button className="btn-ghost" onClick={logout}>{t('auth.logout')}</button>
      </div>
      <nav className="mt-5 flex gap-1 overflow-x-auto border-b border-sky-100 pb-2" aria-label={t('auth.account')}>
        {tabs.map(([to, k]) => <NavLink key={to} to={to} className={cls}>{t(k)}</NavLink>)}
      </nav>
      <div className="mt-6"><Outlet /></div>
    </div>
  );
}
