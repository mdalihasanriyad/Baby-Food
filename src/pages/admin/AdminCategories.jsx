import { useCallback, useEffect, useState } from 'react';
import { useAdmin } from './AdminLayout.jsx';
import { errorText, uploadImage } from '../../services/api.js';
import { imgUrl } from '../../utils/img.js';

const blank = { id: null, nameBn: '', nameEn: '', slug: '', descBn: '', descEn: '', sortOrder: '0', group: 'other', isVisible: true, image: null };

export default function AdminCategories() {
  const { call } = useAdmin();
  const [items, setItems] = useState(null);
  const [form, setForm] = useState(blank);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [moving, setMoving] = useState(null); // { category, count, target }

  const load = useCallback(async () => {
    const r = await call('/categories');
    if (r.ok) setItems(r.data.items); else setError(errorText(r));
  }, [call]);
  useEffect(() => { load(); }, [load]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const edit = (c) => { setNotice(''); setError(''); setForm({ id: c._id, nameBn: c.name.bn, nameEn: c.name.en, slug: c.slug, descBn: c.description?.bn ?? '', descEn: c.description?.en ?? '', sortOrder: String(c.sortOrder ?? 0), group: c.group ?? 'other', isVisible: c.isVisible, image: c.image?.url ? c.image : null }); window.scrollTo({ top: 0 }); };

  const upload = async (e) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    setBusy(true);
    const r = await uploadImage(file);
    setBusy(false);
    if (r.ok) setForm((f) => ({ ...f, image: { url: r.url, alt: f.nameEn } })); else setError(r.error);
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setError(''); setNotice('');
    const body = {
      name: { bn: form.nameBn.trim(), en: form.nameEn.trim() },
      description: { bn: form.descBn.trim(), en: form.descEn.trim() },
      sortOrder: Number(form.sortOrder) || 0,
      group: form.group,
      isVisible: form.isVisible,
      image: form.image ? { url: form.image.url, alt: form.image.alt || form.nameEn } : null,
      ...(form.slug.trim() ? { slug: form.slug.trim() } : {}),
    };
    const r = await call(form.id ? `/categories/${form.id}` : '/categories', { method: form.id ? 'PATCH' : 'POST', body });
    setBusy(false);
    if (r.ok) { setNotice(form.id ? 'Category updated.' : 'Category created.'); setForm(blank); load(); } else setError(errorText(r));
  };

  const remove = async (c, reassignTo) => {
    setError(''); setNotice('');
    const r = await call(`/categories/${c._id}${reassignTo ? `?reassignTo=${reassignTo}` : ''}`, { method: 'DELETE' });
    if (r.ok) { setNotice('Category deleted.'); setMoving(null); load(); }
    else if (r.status === 409 && r.data?.error?.code === 'CATEGORY_IN_USE') setMoving({ category: c, count: r.data.error.details?.productCount ?? c.productCount, target: '' });
    else setError(errorText(r));
  };

  return (
    <div>
      <h1 className="text-2xl font-bold">Categories</h1>
      <form onSubmit={save} className="mt-4 grid gap-3 rounded-2xl border border-sky-100 p-4 sm:grid-cols-2" noValidate>
        <h2 className="font-semibold sm:col-span-2">{form.id ? 'Edit category' : 'New category'}</h2>
        <label className="text-sm font-semibold">Name (Bengali)<input className="input mt-1" value={form.nameBn} onChange={set('nameBn')} required /></label>
        <label className="text-sm font-semibold">Name (English)<input className="input mt-1" value={form.nameEn} onChange={set('nameEn')} required /></label>
        <label className="text-sm font-semibold">Slug <span className="font-normal text-ink-soft">(optional, auto from English name)</span><input className="input mt-1" value={form.slug} onChange={set('slug')} /></label>
        <label className="text-sm font-semibold">Sort order<input type="number" step="1" className="input mt-1" value={form.sortOrder} onChange={set('sortOrder')} /></label>
        <label className="text-sm font-semibold">Shop section
          <select className="input mt-1" value={form.group} onChange={set('group')}>
            <option value="baby">Baby Food page</option><option value="adult">Adult Food page</option><option value="other">Neither (only in Shop all)</option>
          </select>
        </label>
        <label className="text-sm font-semibold">Description (Bengali)<textarea rows="2" className="input mt-1" value={form.descBn} onChange={set('descBn')} /></label>
        <label className="text-sm font-semibold">Description (English)<textarea rows="2" className="input mt-1" value={form.descEn} onChange={set('descEn')} /></label>
        <div className="text-sm font-semibold">Image
          <div className="mt-1 flex items-center gap-3">
            {form.image && <img src={imgUrl(form.image.url, 96)} alt="" className="h-12 w-12 rounded-lg object-cover" />}
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} aria-label="Category image" />
            {form.image && <button type="button" className="btn-ghost !min-h-[36px]" onClick={() => setForm((f) => ({ ...f, image: null }))}>Remove</button>}
          </div>
        </div>
        <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-5 w-5 accent-sky-600" checked={form.isVisible} onChange={set('isVisible')} /> Visible in the shop</label>
        <div className="flex gap-2 sm:col-span-2">
          <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : form.id ? 'Save changes' : 'Create category'}</button>
          {form.id && <button type="button" className="btn-ghost" onClick={() => setForm(blank)}>Cancel</button>}
        </div>
      </form>

      {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
      {notice && <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800" role="status">{notice}</p>}

      {moving && (
        <div className="mt-3 rounded-xl bg-butter p-4 text-sm" role="alertdialog" aria-label="Move products">
          <p><b>{moving.category.name.en}</b> still has {moving.count} product(s). Move them to another category to delete it:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <select className="input !w-auto" value={moving.target} onChange={(e) => setMoving({ ...moving, target: e.target.value })} aria-label="Target category">
              <option value="">Choose category…</option>
              {items.filter((c) => c._id !== moving.category._id).map((c) => <option key={c._id} value={c._id}>{c.name.en}</option>)}
            </select>
            <button className="btn-primary" disabled={!moving.target} onClick={() => remove(moving.category, moving.target)}>Move products & delete</button>
            <button className="btn-ghost" onClick={() => setMoving(null)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded-2xl border border-sky-100">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-sky-50 text-xs uppercase text-ink-soft"><tr><th className="p-3">Category</th><th className="p-3">Slug</th><th className="p-3">Products</th><th className="p-3">Visible</th><th className="p-3">Actions</th></tr></thead>
          <tbody className="divide-y divide-sky-100">
            {!items && <tr><td className="p-6 text-center text-ink-soft" colSpan="5">Loading…</td></tr>}
            {items?.length === 0 && <tr><td className="p-6 text-center text-ink-soft" colSpan="5">No categories yet.</td></tr>}
            {items?.map((c) => (
              <tr key={c._id}>
                <td className="p-3 font-semibold">{c.name.en} <span className="font-normal text-ink-soft">/ {c.name.bn}</span></td>
                <td className="p-3 text-ink-soft">{c.slug}</td>
                <td className="p-3">{c.productCount}</td>
                <td className="p-3">{c.isVisible ? 'Yes' : 'No'}</td>
                <td className="p-3"><div className="flex gap-1">
                  <button className="btn-ghost !min-h-[36px] !px-3" onClick={() => edit(c)}>Edit</button>
                  <button className="btn-ghost !min-h-[36px] !px-3 !text-red-700" onClick={() => window.confirm(`Delete category "${c.name.en}"?`) && remove(c)}>Delete</button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
