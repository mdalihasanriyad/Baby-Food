// Meta Pixel wrapper. Nothing here runs unless (1) a Pixel ID is configured AND (2) the visitor has accepted tracking.
// Only product ids, quantities and amounts are ever sent: never names, phone numbers, addresses, emails or passwords.
let ready = false;

export function loadPixel(id) {
  if (ready || !/^\d{5,20}$/.test(String(id))) return;
  if (!window.fbq) { // the standard Meta bootstrap, expanded (the script itself is added via the DOM, not inline HTML)
    const q = function fbq(...args) { if (q.callMethod) q.callMethod(...args); else q.queue.push(args); };
    window.fbq = q;
    if (!window._fbq) window._fbq = q;
    q.push = q; q.loaded = true; q.version = '2.0'; q.queue = [];
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(s);
  }
  window.fbq('init', String(id));
  window.fbq('track', 'PageView');
  ready = true;
}

export const pixelReady = () => ready;
export function track(event, params, eventId) {
  if (!ready || !window.fbq) return; // tracking off or not consented: the site simply carries on
  if (eventId) window.fbq('track', event, params, { eventID: eventId });
  else window.fbq('track', event, params);
}
export function trackPageView() { if (ready && window.fbq) window.fbq('track', 'PageView'); }

const CURRENCY = 'BDT';

export const viewContent = (p) => track('ViewContent', {
  content_ids: [p._id], content_type: 'product', content_name: p.name.en, value: p.effectivePrice, currency: CURRENCY,
});

export const addToCart = (p, qty = 1) => track('AddToCart', {
  content_ids: [p._id], content_type: 'product', content_name: p.name.en, value: p.effectivePrice * qty, currency: CURRENCY,
  contents: [{ id: p._id, quantity: qty, item_price: p.effectivePrice }],
});

export const initiateCheckout = (quote) => {
  const lines = quote.lines.filter((l) => l.allowedQuantity > 0);
  track('InitiateCheckout', {
    content_ids: lines.map((l) => l.productId), content_type: 'product', num_items: lines.reduce((n, l) => n + l.allowedQuantity, 0),
    value: quote.total, currency: CURRENCY, contents: lines.map((l) => ({ id: l.productId, quantity: l.allowedQuantity, item_price: l.unitPrice })),
  });
};

// Purchase is sent at most once per order, even if the confirmation page is refreshed or revisited.
const KEY = 'bfg_px_purchases';
export function trackPurchaseOnce(order) {
  if (!ready || order.status === 'cancelled') return false;
  let seen = [];
  try { seen = JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { /* ignore */ }
  if (seen.includes(order.trackingId)) return false;
  track('Purchase', {
    content_ids: order.items.map((i) => i.productId), content_type: 'product', num_items: order.items.reduce((n, i) => n + i.quantity, 0),
    value: order.total, currency: CURRENCY, contents: order.items.map((i) => ({ id: i.productId, quantity: i.quantity, item_price: i.unitPrice })),
  }, order.trackingId); // trackingId doubles as the event id for de-duplication
  try { localStorage.setItem(KEY, JSON.stringify([...seen, order.trackingId].slice(-50))); } catch { /* ignore */ }
  return true;
}
