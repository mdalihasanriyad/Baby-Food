import { Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext.jsx';
import { useWishlist } from '../context/WishlistContext.jsx';
import { useApi } from '../hooks/useApi.js';
import { useNoIndex } from '../hooks/useNoIndex.js';
import ProductGrid, { ErrorBox, Skeleton } from '../components/ProductGrid.jsx';

export default function Wishlist() {
  useNoIndex();
  const { t } = useLang();
  const wl = useWishlist();
  const { data, loading, error, reload } = useApi('/wishlist');
  const items = (data?.items ?? []).filter((p) => wl.has(p._id)); // un-hearting removes the card immediately
  return (
    <div className="container-x py-8">
      <h1 className="text-2xl font-bold sm:text-3xl">{t('wish.title')}</h1>
      <div className="mt-6">
        {error ? <ErrorBox error={error} onRetry={reload} />
          : loading ? <Skeleton n={4} />
          : items.length === 0 ? <div className="rounded-2xl border border-dashed border-sky-200 p-10 text-center text-ink-soft"><p>{t('wish.empty')}</p><Link to="/shop" className="btn-primary mt-4">{t('shop.title')}</Link></div>
          : <ProductGrid items={items} />}
      </div>
    </div>
  );
}
