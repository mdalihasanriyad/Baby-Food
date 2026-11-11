import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import ProductImage from './ProductImage.jsx';
import WishlistButton from './WishlistButton.jsx';
import Stars from './Stars.jsx';
import { addToCart } from '../services/pixel.js';

export default function ProductCard({ product }) {
  const { lang, t, money } = useLang();
  const cart = useCart();
  const [note, setNote] = useState('');
  const timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);

  const name = product.name[lang] || product.name.en;
  const off = product.salePrice ? Math.round(((product.price - product.salePrice) / product.price) * 100) : 0;
  const out = product.stock <= 0;
  const stockKey = out ? 'product.out' : product.stock <= 10 ? 'product.low' : 'product.in';

  const add = () => {
    const r = cart.add(product, 1);
    if (r.ok) addToCart(product, 1);
    setNote(r.capped ? t('product.maxReached') : t('product.addedToCart'));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setNote(''), 2200);
  };

  return (
    <article className="mat flex flex-col">
      <div className="relative">
        <Link to={`/product/${product.slug}`} aria-label={name}>
          <ProductImage product={product} name={name} width={400} className="aspect-square w-full rounded-xl" />
        </Link>
        {product.isDemo && <span className="absolute left-2 top-2 rounded-md bg-white/90 px-1.5 py-0.5 text-[11px] font-semibold text-ink-soft">{t('demo.badge')}</span>}
        {off > 0 && !out && <span className="absolute bottom-2 left-2 rounded-md bg-sky-600 px-1.5 py-0.5 text-xs font-bold text-white">{off}% {t('product.off')}</span>}
        <WishlistButton productId={product._id} className="absolute right-1 top-1 bg-white/80" />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-2 pt-3">
        {product.brand && <p className="text-xs text-ink-soft">{product.brand}</p>}
        <h3 className="font-semibold leading-snug"><Link to={`/product/${product.slug}`} className="hover:text-sky-700">{name}</Link></h3>
        {product.ratingCount > 0 && <div className="flex items-center gap-1 text-xs text-ink-soft"><Stars value={product.ratingAverage} size={14} />({product.ratingCount})</div>}
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-lg font-bold text-sky-700">{money(product.effectivePrice)}</span>
          {product.salePrice && <s className="text-sm text-ink-soft">{money(product.price)}</s>}
        </div>
        <p className={`text-xs font-medium ${out ? 'text-red-700' : product.stock <= 10 ? 'text-amber-700' : 'text-emerald-700'}`}>{t(stockKey)}</p>
        <button className="btn-primary mt-2 w-full" disabled={out} onClick={add}>{t('product.add')}</button>
        <p className="min-h-4 text-xs text-sky-700" role="status">{note}</p>
      </div>
    </article>
  );
}
