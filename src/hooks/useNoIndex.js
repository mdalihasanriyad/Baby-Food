import { useEffect } from 'react';

// Private pages must not be indexed (full SEO handling arrives in Phase 9).
export function useNoIndex() {
  useEffect(() => {
    const m = document.createElement('meta');
    m.name = 'robots';
    m.content = 'noindex, nofollow';
    document.head.appendChild(m);
    return () => m.remove();
  }, []);
}
