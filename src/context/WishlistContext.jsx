import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api.js';
import { useAuth } from './AuthContext.jsx';

const WishlistContext = createContext(null);

export function WishlistProvider({ children }) {
  const { user } = useAuth();
  const [ids, setIds] = useState(() => new Set());

  useEffect(() => {
    let alive = true;
    if (!user) { setIds(new Set()); return undefined; }
    api('/wishlist/ids').then((r) => { if (alive && r.ok) setIds(new Set(r.data.ids)); });
    return () => { alive = false; };
  }, [user]);

  // Optimistic toggle; reverts if the server refuses. Returns { ok, full }.
  const toggle = useCallback(async (productId) => {
    const had = ids.has(productId);
    const apply = (on) => setIds((s) => { const n = new Set(s); if (on) n.add(productId); else n.delete(productId); return n; });
    apply(!had);
    const r = await api(`/wishlist/${productId}`, { method: had ? 'DELETE' : 'PUT' });
    if (!r.ok) { apply(had); return { ok: false, full: r.data?.error?.code === 'WISHLIST_FULL' }; }
    return { ok: true };
  }, [ids]);

  const value = useMemo(() => ({ ids, has: (id) => ids.has(id), toggle }), [ids, toggle]);
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export const useWishlist = () => useContext(WishlistContext);
