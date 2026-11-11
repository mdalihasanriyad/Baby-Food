import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// Phase 5 foundation: a persisted list of { productId, quantity }. Prices are NEVER stored here;
// Phase 6 re-validates price and stock on the server before anything is ordered.
const CartContext = createContext(null);
const KEY = 'bfg_cart';
const ZONE_KEY = 'bfg_zone';
const MAX_QTY = 50;

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(raw)
      ? raw.filter((i) => typeof i?.productId === 'string' && Number.isInteger(i.quantity) && i.quantity > 0).map((i) => ({ productId: i.productId, quantity: Math.min(i.quantity, MAX_QTY) }))
      : [];
  } catch {
    return [];
  }
}

const loadZone = () => {
  try { return localStorage.getItem(ZONE_KEY) === 'outside_dhaka' ? 'outside_dhaka' : 'inside_dhaka'; } catch { return 'inside_dhaka'; }
};

export function CartProvider({ children }) {
  const [items, setItems] = useState(load);
  const [zone, setZoneState] = useState(loadZone);
  const setZone = useCallback((z) => {
    setZoneState(z);
    try { localStorage.setItem(ZONE_KEY, z); } catch { /* storage unavailable */ }
  }, []);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* storage unavailable */ }
  }, [items]);

  // Adds quantity but never beyond the known stock (or 50). Returns { ok, quantity, capped }.
  const add = useCallback((product, qty = 1) => {
    if (!product || product.stock <= 0) return { ok: false, quantity: 0, capped: false };
    const limit = Math.min(product.stock, MAX_QTY);
    const current = items.find((i) => i.productId === product._id)?.quantity ?? 0;
    const quantity = Math.min(current + qty, limit);
    setItems((list) => (list.some((i) => i.productId === product._id)
      ? list.map((i) => (i.productId === product._id ? { ...i, quantity } : i))
      : [...list, { productId: product._id, quantity }]));
    return { ok: true, quantity, capped: current + qty > limit };
  }, [items]);

  const setQuantity = useCallback((productId, qty) => {
    const quantity = Math.max(1, Math.min(MAX_QTY, Math.floor(qty) || 1));
    setItems((l) => l.map((i) => (i.productId === productId && i.quantity !== quantity ? { ...i, quantity } : i)));
  }, []);
  const remove = useCallback((productId) => setItems((l) => l.filter((i) => i.productId !== productId)), []);
  const clear = useCallback(() => setItems([]), []);
  const count = useMemo(() => items.reduce((n, i) => n + i.quantity, 0), [items]);
  const value = useMemo(() => ({ items, count, zone, setZone, add, setQuantity, remove, clear }), [items, count, zone, setZone, add, setQuantity, remove, clear]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
