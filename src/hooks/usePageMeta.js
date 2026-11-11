import { useEffect } from 'react';

// Sets the tab title and meta description for the current page (full SEO handling: Phase 9).
export function usePageMeta(title, description) {
  useEffect(() => {
    const prevTitle = document.title;
    const meta = document.querySelector('meta[name="description"]');
    const prevDesc = meta?.getAttribute('content');
    if (title) document.title = title;
    if (description && meta) meta.setAttribute('content', description.slice(0, 160));
    return () => {
      document.title = prevTitle;
      if (meta && prevDesc != null) meta.setAttribute('content', prevDesc);
    };
  }, [title, description]);
}
