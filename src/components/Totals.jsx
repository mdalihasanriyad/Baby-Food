import { useLang } from '../context/LanguageContext.jsx';

export default function Totals({ quote }) {
  const { t, money } = useLang();
  const row = (label, value, cls = '') => <div className={`flex justify-between gap-4 ${cls}`}><dt>{label}</dt><dd>{value}</dd></div>;
  return (
    <dl className="space-y-2 text-sm">
      {row(t('cart.subtotal'), money(quote.subtotal))}
      {quote.discountTotal > 0 && row(t('cart.discount'), `− ${money(quote.discountTotal)}`, 'text-emerald-700')}
      {row(t('cart.delivery'), quote.deliveryFee != null ? money(quote.deliveryFee) : '—')}
      {row(t('cart.total'), money(quote.total), 'border-t border-sky-100 pt-2 text-lg font-bold text-sky-700')}
    </dl>
  );
}
