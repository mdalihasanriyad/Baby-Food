export const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const slugify = (s) =>
  String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 100) || 'item';

// Finds a free slug: base, base-2, base-3 ...
export async function uniqueSlug(Model, base, excludeId) {
  for (let i = 1; i <= 50; i += 1) {
    const candidate = i === 1 ? base : `${base}-${i}`;
    const clash = await Model.exists({ slug: candidate, ...(excludeId ? { _id: { $ne: excludeId } } : {}) });
    if (!clash) return candidate;
  }
  return `${base}-${Date.now()}`;
}
