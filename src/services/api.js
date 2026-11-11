// Thin fetch wrapper. Never throws: returns { ok, status, data, network }.
export async function api(path, { method = 'GET', body } = {}) {
  try {
    const res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data, network: false, url: res.url };
  } catch {
    return { ok: false, status: 0, data: null, network: true };
  }
}

// Maps an API error response to { field: messageCode } for forms.
export function fieldErrors(res) {
  const out = {};
  for (const d of res.data?.error?.details ?? []) {
    out[d.field] = d.message === 'must be unique' ? 'duplicate' : d.message;
  }
  return out;
}

// Uploads one image (JPEG/PNG/WebP, max 4 MB) to the admin upload endpoint; returns { ok, url, error }.
export async function uploadImage(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return { ok: false, error: 'Use a JPEG, PNG or WebP image.' };
  if (file.size > 4 * 1024 * 1024) return { ok: false, error: 'Image must be 4 MB or smaller.' };
  try {
    const res = await fetch('/api/admin/uploads', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': file.type }, body: file });
    const data = await res.json().catch(() => null);
    if (res.ok) return { ok: true, url: data.url };
    return { ok: false, status: res.status, error: data?.error?.message || 'Upload failed.' };
  } catch {
    return { ok: false, error: 'Network problem during upload.' };
  }
}

// Human-readable list of API validation problems for admin forms.
export const errorText = (res) =>
  (res.data?.error?.details?.length && Array.isArray(res.data.error.details)
    ? res.data.error.details.map((d) => `${d.field}: ${d.message}`).join(' · ')
    : res.data?.error?.message) || (res.network ? 'Network problem. Check your connection.' : 'Something went wrong.');
