import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api.js';

// Asks the server to price the cart (current prices, stock, delivery fee). The browser never computes money.
export function useQuote(items, zone) {
  const [state, setState] = useState({ data: null, loading: items.length > 0, error: null });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (items.length === 0) { setState({ data: null, loading: false, error: null }); return undefined; }
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    const timer = setTimeout(async () => {
      const r = await api('/cart/quote', { method: 'POST', body: { items: items.map(({ productId, quantity }) => ({ productId, quantity })), deliveryZone: zone } });
      if (!alive) return;
      setState(r.ok ? { data: r.data, loading: false, error: null } : { data: null, loading: false, error: r.network ? 'network' : 'server' });
    }, 250);
    return () => { alive = false; clearTimeout(timer); };
  }, [items, zone, tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { ...state, reload };
}
