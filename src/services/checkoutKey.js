// One idempotency key per checkout attempt. It survives refreshes and retries, so a repeated submit can never
// create a second order. It is cleared only after an order succeeds.
const KEY = 'bfg_checkout_key';
const newId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`);

export function getCheckoutKey() {
  try {
    let k = localStorage.getItem(KEY);
    if (!k || !/^[A-Za-z0-9_-]{16,80}$/.test(k)) { k = newId(); localStorage.setItem(KEY, k); }
    return k;
  } catch { return newId(); }
}
export function clearCheckoutKey() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
