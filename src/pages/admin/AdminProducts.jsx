import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdmin } from './AdminLayout.jsx';
import { errorText } from '../../services/api.js';
import { imgUrl } from '../../utils/img.js';

const taka = (n) => `৳${new Intl.NumberFormat('en-US').format(n)}`;

function StockCell({ product, onSave }) {
  const [val, setVal] = useState(String(product.stock));
  const changed = val !== String(product.stock) && val !== '' && Number.isInteger(Number(val)) && Number(val) >= 0;
  return (
    <div className="flex items-center gap-1">
      <input aria-label={`Stock for ${product.name.en}`} type="number" min="0" step="1" className="input !min-h-[36px] !w-20 !px-2" value={val} onChange={(e) => setVal(e.target.value)} />
      {changed && <button className="btn-primary !min-h-[36px] !px-3" onClick={() => onSave(product._id, Number(val))}>Save</button>}
    </div>
  );
}

export default function AdminProducts() {
  const { call } = useAdmin();
  const [filters, setFilters] = useState({ q: '', category: '', status: 'active', published: '', stock: '', sort: 'new', page: 1 });
  const [qInput, setQInput] = useState('');
  const [data, setData] = useState(null);
  const [cats, setCats] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    const params = new URLSearchParams({ limit: '20' });
    Object.entries(filters).forEach(([k, v]) => { if (v !== '') params.set(k, v); });
    const r = await call(`/products?${params}`);
    if (r.ok) { setData(r.data); setError(''); } else setError(errorText(r));
  }, [call, filters]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { call('/categories').then((r) => r.ok && setCats(r.data.items)); }, [call]);

  const set = (k, v) => setFilters((f) => ({ ...f, [k]: v, page: k === 'page' ? v : 1 }));
  const act = async (fn, okMsg) => {
    const r = await fn();
    if (r.ok) { setNotice(okMsg); setError(''); load(); } else { setNotice(''); setError(errorText(r)); }
  };

  const saveStock = (id, stock) => act(() => call(`/products/${id}/stock`, { method: 'PATCH', body: { stock } }), 'Stock updated.');
  const togglePublish = (p) => act(() => call(`/products/${p._id}`, { method: 'PATCH', body: { isPublished: !p.isPublished } }), p.isPublished ? 'Product hidden.' : 'Product published.');
  const archive = (p) => window.confirm(`Archive "${p.name.en}"? It will be hidden from the shop.`) && act(() => call(`/products/${p._id}/archive`, { method: 'POST' }), 'Product archived.');
  const restore = (p) => act(() => call(`/products/${p._id}/restore`, { method: 'POST' }), 'Product restored (still unpublished).');
  const remove = (p) => window.confirm(`Permanently delete "${p.name.en}"? This cannot be undone.`) && act(() => call(`/products/${p._id}`, { method: 'DELETE' }), 'Product deleted.');

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Products</h1>
        <Link to="/admin/products/new" className="btn-primary">+ New product</Link>
      </div>

      <form className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-6" onSubmit={(e) => { e.preventDefault(); set('q', qInput.trim()); }} role="search">
        <input className="input lg:col-span-2" placeholder="Search name, SKU, brand…" aria-label="Search" value={qInput} onChange={(e) => setQInput(e.target.value)} />
        <select className="input" aria-label="Category" value={filters.category} onChange={(e) => set('category', e.target.value)}>
          <option value="">All categories</option>{cats.map((c) => <option key={c._id} value={c._id}>{c.name.en}</option>)}
        </select>
        <select className="input" aria-label="Status" value={filters.status} onChange={(e) => set('status', e.target.value)}>
          <option value="active">Active</option><option value="archived">Archived</option><option value="all">All statuses</option>
        </select>
        <select className="input" aria-label="Stock" value={filters.stock} onChange={(e) => set('stock', e.target.value)}>
          <option value="">Any stock</option><option value="in">In stock</option><option value="low">Low stock</option><option value="out">Out of stock</option>
        </select>
        <select className="input" aria-label="Sort" value={filters.sort} onChange={(e) => set('sort', e.target.value)}>
          <option value="new">Newest</option><option value="updated">Recently updated</option><option value="name">Name A–Z</option>
          <option value="price_asc">Price ↑</option><option value="price_desc">Price ↓</option><option value="stock_asc">Stock ↑</option><option value="stock_desc">Stock ↓</option>
        </select>
      </form>

      {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
      {notice && <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800" role="status">{notice}</p>}

      <div className="mt-4 overflow-x-auto rounded-2xl border border-sky-100">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-sky-50 text-xs uppercase text-ink-soft">
            <tr><th className="p-3">Product</th><th className="p-3">Category</th><th className="p-3">Price</th><th className="p-3">Stock</th><th className="p-3">Status</th><th className="p-3">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-sky-100">
            {!data && <tr><td className="p-6 text-center text-ink-soft" colSpan="6">Loading…</td></tr>}
            {data?.items.length === 0 && <tr><td className="p-6 text-center text-ink-soft" colSpan="6">No products match these filters.</td></tr>}
            {data?.items.map((p) => (
              <tr key={p._id}>
                <td className="p-3"><div className="flex items-center gap-3">
                  {p.images?.[0] ? <img src={imgUrl(p.images[0].url, 96)} alt="" loading="lazy" className="h-12 w-12 rounded-lg object-cover" /> : <div className="h-12 w-12 rounded-lg bg-sky-100" aria-hidden="true" />}
                  <div><div className="font-semibold">{p.name.en}{p.isDemo && <span className="ml-2 rounded bg-butter px-1.5 text-[11px]">demo</span>}</div><div className="text-xs text-ink-soft">{p.sku}</div></div>
                </div></td>
                <td className="p-3">{p.category?.name?.en ?? '—'}</td>
                <td className="p-3">{p.salePrice ? <><b>{taka(p.salePrice)}</b> <s className="text-ink-soft">{taka(p.price)}</s></> : <b>{taka(p.price)}</b>}</td>
                <td className="p-3"><StockCell key={`${p._id}-${p.stock}`} product={p} onSave={saveStock} /></td>
                <td className="p-3">{p.status === 'archived' ? <span className="text-ink-soft">Archived</span> : p.isPublished ? <span className="text-emerald-700">Published</span> : <span className="text-amber-700">Draft</span>}</td>
                <td className="p-3"><div className="flex flex-wrap gap-1">
                  <Link className="btn-ghost !min-h-[36px] !px-3" to={`/admin/products/${p._id}`}>Edit</Link>
                  {p.status === 'active' && <button className="btn-ghost !min-h-[36px] !px-3" onClick={() => togglePublish(p)}>{p.isPublished ? 'Unpublish' : 'Publish'}</button>}
                  {p.status === 'active' ? <button className="btn-ghost !min-h-[36px] !px-3" onClick={() => archive(p)}>Archive</button> : <button className="btn-ghost !min-h-[36px] !px-3" onClick={() => restore(p)}>Restore</button>}
                  <button className="btn-ghost !min-h-[36px] !px-3 !text-red-700" onClick={() => remove(p)}>Delete</button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.totalPages > 1 && (
        <nav className="mt-4 flex items-center justify-center gap-3" aria-label="Pagination">
          <button className="btn-ghost" disabled={data.page <= 1} onClick={() => set('page', data.page - 1)}>Previous</button>
          <span className="text-sm text-ink-soft">Page {data.page} of {data.totalPages} · {data.total} products</span>
          <button className="btn-ghost" disabled={data.page >= data.totalPages} onClick={() => set('page', data.page + 1)}>Next</button>
        </nav>
      )}
    </div>
  );
}
