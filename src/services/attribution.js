// Remembers Facebook-ad / campaign tags (UTM) for this browser session and attaches them to the order.
const KEY = 'bfg_utm';

export function captureAttribution() {
  try {
    const p = new URLSearchParams(window.location.search);
    const found = { utmSource: p.get('utm_source'), utmMedium: p.get('utm_medium'), utmCampaign: p.get('utm_campaign') };
    if (found.utmSource || found.utmMedium || found.utmCampaign) {
      const clean = Object.fromEntries(Object.entries(found).filter(([, v]) => v).map(([k, v]) => [k, v.slice(0, 100)]));
      sessionStorage.setItem(KEY, JSON.stringify(clean));
    }
  } catch { /* storage unavailable */ }
}

export function getAttribution() {
  try { return JSON.parse(sessionStorage.getItem(KEY) ?? 'null') ?? undefined; } catch { return undefined; }
}
