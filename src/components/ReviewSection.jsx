import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useLang } from '../context/LanguageContext.jsx';
import { api } from '../services/api.js';
import { useApi } from '../hooks/useApi.js';
import Stars from './Stars.jsx';
import Pagination from './Pagination.jsx';
import { ErrorBox } from './ProductGrid.jsx';

function ReviewForm({ slug, onDone }) {
  const { t } = useLang();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!rating) { setMsg('rev.pickRating'); return; }
    setBusy(true); setMsg('');
    const r = await api(`/products/${slug}/reviews`, { method: 'POST', body: { rating, comment: comment.trim() || undefined } });
    setBusy(false);
    if (r.ok) onDone(); else setMsg(r.network ? 'common.offline' : 'rev.error');
  };

  return (
    <form onSubmit={submit} className="mt-4 space-y-3 rounded-2xl border border-sky-100 p-4" noValidate>
      <h3 className="font-semibold">{t('rev.write')}</h3>
      <fieldset>
        <legend className="text-sm font-semibold">{t('rev.rating')}</legend>
        <div className="mt-1 flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => setRating(n)} aria-pressed={rating === n} aria-label={`${n} / 5`}
              className={`h-11 w-11 rounded-xl text-xl ${n <= rating ? 'bg-amber-100 text-amber-500' : 'bg-sky-50 text-sky-300'}`}>★</button>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="rc" className="text-sm font-semibold">{t('rev.comment')}</label>
        <textarea id="rc" rows="3" maxLength={1000} className="input mt-1" value={comment} onChange={(e) => setComment(e.target.value)} />
      </div>
      {msg && <p className="text-sm text-red-700" role="alert">{t(msg)}</p>}
      <button className="btn-primary" disabled={busy}>{busy ? t('auth.submitting') : t('rev.submit')}</button>
    </form>
  );
}

export default function ReviewSection({ slug, average, count }) {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const list = useApi(`/products/${slug}/reviews?page=${page}&limit=5`);
  const elig = useApi(user ? `/products/${slug}/review-eligibility` : null);

  let action = null;
  if (submitted) action = <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800" role="status">{t('rev.thanks')}</p>;
  else if (!user) action = <p className="mt-4 text-sm"><Link to="/login" state={{ from: `/product/${slug}` }} className="font-semibold text-sky-700 hover:underline">{t('rev.loginToReview')}</Link></p>;
  else if (elig.data?.eligible) action = <ReviewForm slug={slug} onDone={() => setSubmitted(true)} />;
  else if (elig.data) action = <p className="mt-4 text-sm text-ink-soft">{elig.data.reason === 'already_reviewed' ? t('rev.already') : t('rev.notEligible')}</p>;

  return (
    <section className="mt-12" aria-labelledby="reviews-h">
      <h2 id="reviews-h" className="text-xl font-bold">{t('rev.title')}</h2>
      {count > 0 ? (
        <p className="mt-2 flex items-center gap-2 text-sm"><Stars value={average} size={20} /><b>{average}</b> {t('rev.outOf')} · {count} {t('rev.count')}</p>
      ) : <p className="mt-2 text-sm text-ink-soft">{t('rev.none')}</p>}
      {action}
      {list.error && <div className="mt-4"><ErrorBox error={list.error} onRetry={list.reload} /></div>}
      <ul className="mt-4 divide-y divide-sky-100">
        {list.data?.items.map((r) => (
          <li key={r.id} className="py-3">
            <div className="flex flex-wrap items-center gap-2 text-sm"><Stars value={r.rating} /><b>{r.authorName}</b><span className="rounded bg-mint px-1.5 text-xs">{t('rev.verified')}</span>
              <span className="text-ink-soft">{new Date(r.createdAt).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-GB')}</span></div>
            {r.comment && <p className="mt-1 whitespace-pre-line text-sm">{r.comment}</p>}
          </li>
        ))}
      </ul>
      {list.data && <Pagination page={list.data.page} totalPages={list.data.totalPages} onChange={setPage} />}
    </section>
  );
}
