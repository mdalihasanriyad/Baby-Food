import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

// After a page change inside the app, move keyboard/screen-reader focus to the main content and start at the top
// (a normal page load does this by itself; single-page navigation does not).
export default function RouteFocus() {
  const { pathname } = useLocation();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    window.scrollTo(0, 0);
    document.getElementById('main')?.focus({ preventScroll: true });
  }, [pathname]);
  return null;
}
