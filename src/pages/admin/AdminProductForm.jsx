import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAdmin } from './AdminLayout.jsx';
import { errorText, uploadImage } from '../../services/api.js';
import { imgUrl } from '../../utils/img.js';

const blank = {
  nameBn: '', nameEn: '', slug: '', sku: '', category: '', brand: '', price: '', salePrice: '', costPrice: '', stock: '0',
  descBn: '', descEn: '', ingBn: '', ingEn: '', ageBn: '', ageEn: '', otherBn: '', otherEn: '',
  isPublished: false, isFeatured: false, isBestseller: false, seoTitle: '', seoDesc: '', images: [],
};
const num = (v) => (v === '' || v == null ? null : Number(v));

function toForm(p) {
  return {
    nameBn: p.name?.bn ?? '', nameEn: p.name?.en ?? '', slug: p.slug ?? '', sku: p.sku ?? '', category: String(p.category ?? ''), brand: p.brand ?? '',
    price: String(p.price ?? ''), salePrice: p.salePrice != null ? String(p.salePrice) : '', costPrice: p.costPrice != null ? String(p.costPrice) : '', stock: String(p.stock ?? 0),
    descBn: p.description?.bn ?? '', descEn: p.description?.en ?? '',
    ingBn: p.details?.ingredients?.bn ?? '', ingEn: p.details?.ingredients?.en ?? '', ageBn: p.details?.ageInfo?.bn ?? '', ageEn: p.details?.ageInfo?.en ?? '',
    otherBn: p.details?.other?.bn ?? '', otherEn: p.details?.other?.en ?? '',
    isPublished: !!p.isPublished, isFeatured: !!p.isFeatured, isBestseller: !!p.isBestseller,
    seoTitle: p.seo?.title ?? '', seoDesc: p.seo?.metaDescription ?? '',
    images: (p.images ?? []).map((i) => ({ url: i.url, alt: i.alt ?? '' })),
  };
}

function toPayload(f) {
  return {
    name: { bn: f.nameBn.trim(), en: f.nameEn.trim() },
    ...(f.slug.trim() ? { slug: f.slug.trim() } : {}),
    sku: f.sku.trim(), category: f.category, brand: f.brand.trim(),
    price: num(f.price), salePrice: num(f.salePrice), costPrice: num(f.costPrice), stock: num(f.stock),
    description: { bn: f.descBn.trim(), en: f.descEn.trim() },
    // Only text the admin typed is saved: nothing is auto-generated or invented.
    details: { ingredients: { bn: f.ingBn.trim(), en: f.ingEn.trim() }, ageInfo: { bn: f.ageBn.trim(), en: f.ageEn.trim() }, other: { bn: f.otherBn.trim(), en: f.otherEn.trim() } },
    images: f.images.map((i) => ({ url: i.url, alt: i.alt.trim() || f.nameEn.trim() })),
    isPublished: f.isPublished, isFeatured: f.isFeatured, isBestseller: f.isBestseller,
    seo: { title: f.seoTitle.trim(), metaDescription: f.seoDesc.trim() },
  };
}

export default function AdminProductForm() {
  const { id } = useParams();
  const { call } = useAdmin();
  const navigate = useNavigate();
  const [f, setF] = useState(blank);
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { call('/categories').then((r) => r.ok && setCats(r.data.items)); }, [call]);
  useEffect(() => {
    if (!id) return undefined;
    let alive = true;
    call(`/products/${id}`).then((r) => {
      if (!alive) return;
      if (r.ok) setF(toForm(r.data.item)); else setError(errorText(r));
      setLoading(false);
    });
    return () => { alive = false; };
  }, [id, call]);

  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const onFiles = async (e) => {
    const files = [...(e.target.files ?? [])]; e.target.value = '';
    if (!files.length) return;
    setUploading(true); setError('');
    for (const file of files) {
      if (f.images.length >= 8) { setError('Maximum 8 images per product.'); break; }
      const r = await uploadImage(file);
      if (!r.ok) { setError(`${file.name}: ${r.error}`); continue; }
      setF((s) => (s.images.length >= 8 ? s : { ...s, images: [...s.images, { url: r.url, alt: '' }] }));
    }
    setUploading(false);
  };
  const imgSet = (i, patch) => setF((s) => ({ ...s, images: s.images.map((im, n) => (n === i ? { ...im, ...patch } : im)) }));
  const imgRemove = (i) => setF((s) => ({ ...s, images: s.images.filter((_, n) => n !== i) }));
  const imgPrimary = (i) => setF((s) => ({ ...s, images: [s.images[i], ...s.images.filter((_, n) => n !== i)] }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    const r = await call(id ? `/products/${id}` : '/products', { method: id ? 'PATCH' : 'POST', body: toPayload(f) });
    setBusy(false);
    if (r.ok) navigate('/admin/products'); else { setError(errorText(r)); window.scrollTo({ top: 0 }); }
  };

  const T = (label, key, props = {}) => <label className="text-sm font-semibold">{label}<input className="input mt-1" value={f[key]} onChange={set(key)} {...props} /></label>;
  const A = (label, key, rows = 3) => <label className="text-sm font-semibold">{label}<textarea rows={rows} className="input mt-1" value={f[key]} onChange={set(key)} /></label>;
  const Box = (label, key) => <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-5 w-5 accent-sky-600" checked={f[key]} onChange={set(key)} />{label}</label>;
  const H = (t) => <h2 className="border-b border-sky-100 pb-1 text-lg font-bold sm:col-span-2">{t}</h2>;

  if (loading) return <p className="p-6 text-center text-ink-soft" role="status">Loading…</p>;
  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
      <div className="flex items-center justify-between sm:col-span-2">
        <h1 className="text-2xl font-bold">{id ? 'Edit product' : 'New product'}</h1>
        <Link to="/admin/products" className="text-sm font-semibold text-sky-700 hover:underline">← Back to products</Link>
      </div>
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 sm:col-span-2" role="alert">{error}</p>}

      {H('Basics')}
      {T('Name (Bengali) *', 'nameBn')}{T('Name (English) *', 'nameEn')}
      {T('SKU *', 'sku', { maxLength: 40 })}{T('Slug (optional, auto from English name)', 'slug')}
      {T('Brand', 'brand')}
      <label className="text-sm font-semibold">Category *
        <select className="input mt-1" value={f.category} onChange={set('category')}>
          <option value="">Choose…</option>{cats.map((c) => <option key={c._id} value={c._id}>{c.name.en}</option>)}
        </select>
      </label>

      {H('Price and stock (whole taka)')}
      {T('Regular price (৳) *', 'price', { type: 'number', min: 1, step: 1 })}
      {T('Sale price (৳), blank = no sale', 'salePrice', { type: 'number', min: 1, step: 1 })}
      {T('Cost price (৳), admin only, for profit estimates', 'costPrice', { type: 'number', min: 0, step: 1 })}
      {T('Stock *', 'stock', { type: 'number', min: 0, step: 1 })}

      {H('Images (JPEG, PNG or WebP, max 4 MB each, up to 8; first is the main image)')}
      <div className="sm:col-span-2">
        <input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={onFiles} disabled={uploading} aria-label="Upload images" />
        {uploading && <span className="ml-2 text-sm text-ink-soft" role="status">Uploading…</span>}
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {f.images.map((im, i) => (
            <li key={im.url} className="flex gap-3 rounded-xl border border-sky-100 p-2">
              <img src={imgUrl(im.url, 160)} alt="" className="h-20 w-20 rounded-lg object-cover" loading="lazy" />
              <div className="flex-1 space-y-1">
                <input className="input !min-h-[36px]" placeholder="Alt text (describe the image)" aria-label={`Alt text for image ${i + 1}`} value={im.alt} onChange={(e) => imgSet(i, { alt: e.target.value })} />
                <div className="flex gap-1 text-xs">
                  {i > 0 ? <button type="button" className="btn-ghost !min-h-[32px] !px-2" onClick={() => imgPrimary(i)}>Make main</button> : <span className="px-2 py-1 font-semibold text-sky-700">Main image</span>}
                  <button type="button" className="btn-ghost !min-h-[32px] !px-2 !text-red-700" onClick={() => imgRemove(i)}>Remove</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {H('Descriptions')}
      {A('Description (Bengali)', 'descBn', 4)}{A('Description (English)', 'descEn', 4)}

      {H('Verified product details (leave blank unless you have verified information)')}
      {A('Ingredients (Bengali)', 'ingBn')}{A('Ingredients (English)', 'ingEn')}
      {A('Age information (Bengali)', 'ageBn', 2)}{A('Age information (English)', 'ageEn', 2)}
      {A('Other details (Bengali)', 'otherBn', 2)}{A('Other details (English)', 'otherEn', 2)}

      {H('SEO')}
      {T('SEO title (max 70)', 'seoTitle', { maxLength: 70 })}{A('Meta description (max 160)', 'seoDesc', 2)}

      {H('Visibility')}
      <div className="flex flex-wrap gap-x-6 sm:col-span-2">{Box('Published (visible in shop)', 'isPublished')}{Box('Featured', 'isFeatured')}{Box('Bestseller', 'isBestseller')}</div>

      <div className="flex gap-2 sm:col-span-2">
        <button className="btn-primary" disabled={busy || uploading}>{busy ? 'Saving…' : id ? 'Save changes' : 'Create product'}</button>
        <Link to="/admin/products" className="btn-ghost">Cancel</Link>
      </div>
    </form>
  );
}
