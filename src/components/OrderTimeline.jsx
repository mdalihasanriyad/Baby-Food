import { useLang } from '../context/LanguageContext.jsx';

const STEPS = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];

// Shows the real status history with timestamps; steps not reached yet are greyed out.
export default function OrderTimeline({ order }) {
  const { t, lang } = useLang();
  const when = (d) => new Date(d).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  const at = new Map(order.statusHistory.map((h) => [h.status, h.at]));
  const steps = order.status === 'cancelled'
    ? order.statusHistory.map((h) => h.status) // pending ... cancelled, exactly what happened
    : STEPS;
  return (
    <ol className="space-y-3" aria-label={t('orders.track')}>
      {steps.map((s) => {
        const done = at.has(s);
        const current = s === order.status;
        const bad = s === 'cancelled';
        return (
          <li key={s} className="flex items-start gap-3">
            <span aria-hidden="true" className={`mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2 ${bad ? 'border-red-600 bg-red-600' : done ? 'border-sky-600 bg-sky-600' : 'border-sky-200 bg-white'}`} />
            <div className={done ? '' : 'text-ink-soft'}>
              <p className={`text-sm ${current ? 'font-bold' : 'font-medium'} ${bad ? 'text-red-700' : ''}`}>{t(`order.s.${s}`)}{current && <span className="sr-only"> (current)</span>}</p>
              {done && <p className="text-xs text-ink-soft">{when(at.get(s))}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
