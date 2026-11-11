import Product from '../models/Product.js';
import Category from '../models/Category.js';
import { slim } from '../utils/productShape.js';

export const PUBLIC_FILTER = { isPublished: true, status: 'active' };

// Small payload for cards and grids: no long text, never costPrice. Images are fetched whole (at most 8 small entries) and
// trimmed to the first one by slim() below: this avoids a MongoDB-version-specific $slice projection.
export const LIST_FIELDS = {
  slug: 1, name: 1, brand: 1, price: 1, salePrice: 1, effectivePrice: 1, stock: 1, images: 1,
  category: 1, isFeatured: 1, isBestseller: 1, isDemo: 1, ratingAverage: 1, ratingCount: 1, createdAt: 1,
};

export const categoryIdsForGroup = (group) => Category.find({ group, isVisible: true }).distinct('_id');

export { slim };

export const listPublic = async (filter, sort, limit) =>
  slim(await Product.find({ ...PUBLIC_FILTER, ...filter }).sort(sort).limit(limit).select(LIST_FIELDS).populate('category', 'slug name group').lean());

// Price range and whether "popular" sorting is meaningful (only when real sales exist).
export async function facets() {
  const [r] = await Product.aggregate([
    { $match: PUBLIC_FILTER },
    { $group: { _id: null, maxPrice: { $max: '$effectivePrice' }, maxSold: { $max: '$soldCount' } } },
  ]);
  return { maxPrice: r?.maxPrice ?? 0, hasPopularity: (r?.maxSold ?? 0) > 0 };
}
