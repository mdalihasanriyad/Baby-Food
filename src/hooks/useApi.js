import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api.js';

// GET helper with loading / error states. Pass null to skip. error: 'network' | 'notfound' | 'server'.
export function useApi(path) {
  const [state, setState] = useState({ data: null, loading: Boolean(path), error: null, url: null });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!path) { setState({ data: null, loading: false, error: null, url: null }); return undefined; }
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    api(path).then((r) => {
      if (!alive) return;
      if (r.ok) setState({ data: r.data, loading: false, error: null, url: r.url });
      else setState({ data: null, loading: false, error: r.network ? 'network' : r.status === 404 ? 'notfound' : 'server', url: r.url });
    });
    return () => { alive = false; };
  }, [path, tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { ...state, reload };
}
