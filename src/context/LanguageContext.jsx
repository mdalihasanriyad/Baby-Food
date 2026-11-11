import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { translations } from '../i18n/translations.js';

const LanguageContext = createContext(null);
const KEY = 'bfg_lang';

function initialLang() {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('lang'); // ?lang=en links (used by hreflang and shared English links)
    if (fromUrl === 'en' || fromUrl === 'bn') return fromUrl;
    const saved = localStorage.getItem(KEY);
    return saved === 'en' || saved === 'bn' ? saved : 'bn'; // Bengali by default
  } catch {
    return 'bn';
  }
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
    try { localStorage.setItem(KEY, lang); } catch { /* storage unavailable */ }
  }, [lang]);

  const t = useCallback((key) => translations[lang][key] ?? translations.en[key] ?? key, [lang]);
  const toggle = useCallback(() => setLang((l) => (l === 'bn' ? 'en' : 'bn')), []);
  const money = useCallback(
    (n) => '৳' + new Intl.NumberFormat(lang === 'bn' ? 'bn-BD' : 'en-US').format(n),
    [lang]
  );
  const value = useMemo(() => ({ lang, t, toggle, money }), [lang, t, toggle, money]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export const useLang = () => useContext(LanguageContext);
