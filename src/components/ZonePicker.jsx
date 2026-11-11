import { useLang } from '../context/LanguageContext.jsx';

export default function ZonePicker({ zone, onChange, fees, name = 'zone' }) {
  const { t, money } = useLang();
  const opts = [['inside_dhaka', 'cart.inside', fees?.insideDhaka], ['outside_dhaka', 'cart.outside', fees?.outsideDhaka]];
  return (
    <fieldset>
      <legend className="text-sm font-semibold">{t('cart.zone')}</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {opts.map(([v, k, fee]) => (
          <label key={v} className={`flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm ${zone === v ? 'border-sky-600 bg-sky-50' : 'border-sky-200'}`}>
            <input type="radio" name={name} value={v} checked={zone === v} onChange={() => onChange(v)} className="accent-sky-600" />
            <span className="flex-1">{t(k)}</span>{fee != null && <b>{money(fee)}</b>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
