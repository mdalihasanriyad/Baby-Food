import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useLang } from '../context/LanguageContext.jsx';
import { useWishlist } from '../context/WishlistContext.jsx';
import { HeartIcon } from './Icons.jsx';

export default function WishlistButton({ productId, className = '', withLabel = false }) {
  const { user } = useAuth();
  const { t } = useLang();
  const wl = useWishlist();
  const navigate = useNavigate();
  const on = wl.has(productId);
  const click = async (e) => {
    e.preventDefault(); e.stopPropagation();
    if (!user) { navigate('/login', { state: { from: window.location.pathname } }); return; }
    const r = await wl.toggle(productId);
    if (!r.ok && r.full) window.alert(t('wish.full'));
  };
  return (
    <button type="button" onClick={click} aria-pressed={on} aria-label={on ? t('wish.remove') : t('wish.add')}
      className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-xl ${on ? 'text-rose-600' : 'text-ink-soft hover:text-rose-600'} ${className}`}>
      <span className={on ? '[&_path]:fill-current' : ''}><HeartIcon /></span>
      {withLabel && <span className="text-sm font-semibold">{on ? t('wish.remove') : t('wish.add')}</span>}
    </button>
  );
}
