import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../services/api.js';
import { loadPixel, pixelReady, trackPageView } from '../services/pixel.js';

const PixelContext = createContext(null);
const KEY = 'bfg_consent';
const readConsent = () => { try { const v = localStorage.getItem(KEY); return v === 'granted' || v === 'denied' ? v : null; } catch { return null; } };

export function PixelProvider({ children }) {
  const { pathname } = useLocation();
  const admin = pathname.startsWith('/admin'); // the admin area is never tracked
  const [pixelId, setPixelId] = useState(null);
  const [consent, setConsent] = useState(readConsent);
  const [asking, setAsking] = useState(false);
  const lastPath = useRef(null);

  useEffect(() => {
    if (admin) return undefined;
    let alive = true;
    api('/settings/public').then((r) => { if (alive && r.ok && r.data.metaPixelId) setPixelId(r.data.metaPixelId); });
    return () => { alive = false; };
  }, [admin]);

  useEffect(() => { if (pixelId && consent === 'granted' && !admin) loadPixel(pixelId); }, [pixelId, consent, admin]);

  useEffect(() => { // single-page navigation: count each new page once (the first PageView is sent when the pixel loads)
    if (admin || !pixelReady()) { lastPath.current = pathname; return; }
    if (lastPath.current !== null && lastPath.current !== pathname) trackPageView();
    lastPath.current = pathname;
  }, [pathname, admin, consent, pixelId]);

  const choose = useCallback((value) => {
    setConsent(value); setAsking(false);
    try { localStorage.setItem(KEY, value); } catch { /* ignore */ }
  }, []);

  const value = useMemo(() => ({
    enabled: Boolean(pixelId) && !admin, consent, asking,
    showBanner: Boolean(pixelId) && !admin && (consent === null || asking),
    accept: () => choose('granted'), decline: () => choose('denied'), openPreferences: () => setAsking(true),
  }), [pixelId, admin, consent, asking, choose]);
  return <PixelContext.Provider value={value}>{children}</PixelContext.Provider>;
}

export const usePixel = () => useContext(PixelContext);
