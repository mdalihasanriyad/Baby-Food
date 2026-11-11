import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useLang } from '../context/LanguageContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { CartIcon, CloseIcon, HeartIcon, Logo, MenuIcon, SearchIcon, UserIcon } from './Icons.jsx';

const links = [['/', 'nav.home'], ['/shop', 'nav.shop'], ['/baby-food', 'group.baby'], ['/adult-food', 'group.adult'], ['/about', 'nav.about'], ['/contact', 'nav.contact']];
const linkCls = ({ isActive }) =>
  `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-sky-100 text-sky-700' : 'text-ink-soft hover:text-sky-700'}`;
const iconBtn = 'relative inline-flex h-11 w-11 items-center justify-center rounded-xl text-ink-soft hover:bg-sky-50 hover:text-sky-700';

export default function Header() {
  const { count: cartCount } = useCart();
  const { t, toggle, lang } = useLang();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const navigate = useNavigate();

  const submit = (e) => {
    e.preventDefault();
    navigate(`/shop${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
    setOpen(false);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-sky-100 bg-white/95 backdrop-blur">
      <div className="container-x flex h-16 items-center gap-2">
        <Link to="/" className="flex items-center gap-2 font-bold text-sky-700" aria-label={t('brand')}>
          <Logo />
          <span className="hidden text-lg sm:inline">{t('brand')}</span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 xl:flex" aria-label="Main">
          {links.map(([to, k]) => <NavLink key={to} to={to} end={to === '/'} className={linkCls}>{t(k)}</NavLink>)}
        </nav>

        <form onSubmit={submit} role="search" className="ml-auto hidden max-w-xs flex-1 md:block">
          <label htmlFor="q" className="sr-only">{t('nav.search')}</label>
          <input id="q" className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('nav.search')} />
        </form>

        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <button onClick={toggle} className="btn-ghost !px-3" lang={lang === 'bn' ? 'en' : 'bn'}>{t('lang.switch')}</button>
          <Link to={user ? '/account' : '/login'} className={iconBtn} title={user ? user.name : t('auth.login')} aria-label={user ? t('nav.account') : t('auth.login')}><UserIcon /></Link>
          <Link to="/wishlist" className={`${iconBtn} hidden sm:inline-flex`} title={t('nav.wishlist')} aria-label={t('nav.wishlist')}><HeartIcon /></Link>
          <Link to="/cart" className={iconBtn} title={t('nav.cart')} aria-label={`${t('nav.cart')} (${cartCount})`}>
            <CartIcon />
            {cartCount > 0 && <span className="absolute right-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-sky-600 px-1 text-[11px] font-bold text-white">{cartCount}</span>}
          </Link>
          <button className={`${iconBtn} xl:hidden`} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={t('nav.menu')}>
            {open ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-sky-100 bg-white xl:hidden">
          <div className="container-x space-y-3 py-3">
            <form onSubmit={submit} role="search">
              <label htmlFor="mq" className="sr-only">{t('nav.search')}</label>
              <div className="flex gap-2">
                <input id="mq" className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('nav.search')} />
                <button className="btn-primary !px-3" aria-label={t('nav.search')}><SearchIcon /></button>
              </div>
            </form>
            <nav className="flex flex-col" aria-label="Mobile">
              {links.map(([to, k]) => <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)} className={linkCls}>{t(k)}</NavLink>)}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
