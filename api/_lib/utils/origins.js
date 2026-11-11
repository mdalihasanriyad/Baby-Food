// Turns APP_URL ("https://a.com, https://www.a.com/") into a clean list of browser origins.
// Trailing slashes and paths are dropped (a browser's Origin header never has them), invalid entries are ignored.
// In development, localhost and 127.0.0.1 are treated as the same site: opening the app via the "other" name would
// otherwise make every login and order request fail the origin check with 403.
const LOOPBACK = ['localhost', '127.0.0.1'];

export function allowedOrigins(appUrl, { development = false } = {}) {
  const list = [];
  for (const raw of String(appUrl ?? '').split(',')) {
    const value = raw.trim();
    if (!value) continue;
    try {
      const u = new URL(value);
      if (u.protocol === 'http:' || u.protocol === 'https:') list.push(u.origin);
    } catch { /* ignore invalid entries (validateEnv reports them) */ }
  }
  if (development) {
    for (const origin of [...list]) {
      const u = new URL(origin);
      if (LOOPBACK.includes(u.hostname)) for (const host of LOOPBACK) list.push(`${u.protocol}//${host}${u.port ? `:${u.port}` : ''}`);
    }
  }
  return [...new Set(list)];
}
