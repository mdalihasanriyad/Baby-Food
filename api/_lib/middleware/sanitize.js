// Strips Mongo operator keys ("$gt", "a.b") from request input to block NoSQL injection.
const isBad = (k) => k.startsWith('$') || k.includes('.');
function clean(v) {
  if (Buffer.isBuffer(v)) return v;
  if (Array.isArray(v)) return v.map(clean);
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, val] of Object.entries(v)) if (!isBad(k)) out[k] = clean(val);
    return out;
  }
  return v;
}
export function sanitize(req, _res, next) {
  if (req.body) req.body = clean(req.body);
  if (req.query) req.query = clean(req.query);
  next();
}
