import { useLang } from '../context/LanguageContext.jsx';

const tone = { pending: 'bg-amber-100 text-amber-800', confirmed: 'bg-sky-100 text-sky-800', processing: 'bg-sky-100 text-sky-800', shipped: 'bg-indigo-100 text-indigo-800', delivered: 'bg-emerald-100 text-emerald-800', cancelled: 'bg-red-100 text-red-800' };

export default function StatusBadge({ status }) {
  const { t } = useLang();
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone[status] ?? 'bg-sky-100'}`}>{t(`order.s.${status}`)}</span>;
}
