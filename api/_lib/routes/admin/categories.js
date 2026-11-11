import { Router } from 'express';
import Category from '../../models/Category.js';
import Product from '../../models/Product.js';
import { AppError, asyncHandler } from '../../utils/errors.js';
import { validate } from '../../middleware/validate.js';
import { slugify, uniqueSlug } from '../../utils/text.js';
import { categoryCreate, categoryDelete, categoryUpdate, idParam } from '../../schemas/catalog.js';

const router = Router();
const notFound = () => new AppError(404, 'Category not found', 'NOT_FOUND');

router.get('/', asyncHandler(async (_req, res) => {
  const [items, counts] = await Promise.all([
    Category.find().sort({ sortOrder: 1, 'name.en': 1 }).select('-__v').lean(),
    Product.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
  ]);
  const byId = new Map(counts.map((c) => [String(c._id), c.count]));
  res.json({ items: items.map((c) => ({ ...c, productCount: byId.get(String(c._id)) ?? 0 })) });
}));

router.post('/', validate(categoryCreate), asyncHandler(async (req, res) => {
  const data = req.valid;
  let slug = data.slug;
  if (slug) {
    if (await Category.exists({ slug })) throw new AppError(409, 'Slug is already in use', 'DUPLICATE', [{ field: 'slug', message: 'Slug is already in use' }]);
  } else slug = await uniqueSlug(Category, slugify(data.name.en));
  const { image, ...rest } = data;
  const item = await Category.create({ ...rest, slug, ...(image ? { image } : {}) });
  res.status(201).json({ item });
}));

router.patch('/:id', validate(idParam, 'params'), validate(categoryUpdate), asyncHandler(async (req, res) => {
  const cat = await Category.findById(req.validParams.id).select('+previousSlugs');
  if (!cat) throw notFound();
  const { image, ...data } = req.valid;
  if (data.slug && data.slug !== cat.slug) {
    if (await Category.exists({ slug: data.slug, _id: { $ne: cat._id } })) {
      throw new AppError(409, 'Slug is already in use', 'DUPLICATE', [{ field: 'slug', message: 'Slug is already in use' }]);
    }
    cat.previousSlugs = [...new Set([...cat.previousSlugs, cat.slug])];
  }
  cat.set(data);
  if (image === null) { cat.set('image.url', undefined); cat.set('image.alt', undefined); } else if (image) cat.set('image', image);
  await cat.save();
  res.json({ item: cat });
}));

// A category that still has products can only be deleted by moving those products to another category first.
router.delete('/:id', validate(idParam, 'params'), validate(categoryDelete, 'query'), asyncHandler(async (req, res) => {
  const { id } = req.validParams;
  const { reassignTo } = req.valid;
  if (!(await Category.exists({ _id: id }))) throw notFound();
  const count = await Product.countDocuments({ category: id });
  if (count > 0) {
    if (!reassignTo) throw new AppError(409, `This category still has ${count} product(s). Choose a category to move them to.`, 'CATEGORY_IN_USE', { productCount: count });
    if (reassignTo === id) throw new AppError(400, 'Cannot move products into the category being deleted', 'INVALID_CATEGORY');
    if (!(await Category.exists({ _id: reassignTo }))) throw new AppError(400, 'Target category not found', 'INVALID_CATEGORY');
    await Product.updateMany({ category: id }, { $set: { category: reassignTo } });
  }
  await Category.deleteOne({ _id: id });
  res.json({ ok: true, moved: count });
}));

export default router;
