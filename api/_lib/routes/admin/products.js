import { Router } from 'express';
import Product from '../../models/Product.js';
import Category from '../../models/Category.js';
import Order from '../../models/Order.js';
import Review from '../../models/Review.js';
import StoreSettings from '../../models/StoreSettings.js';
import { AppError, asyncHandler } from '../../utils/errors.js';
import { validate } from '../../middleware/validate.js';
import { escapeRegex, slugify, uniqueSlug } from '../../utils/text.js';
import { idParam, productCreate, productList, productUpdate, stockChange } from '../../schemas/catalog.js';

const router = Router();

const SORTS = {
  new: { createdAt: -1, _id: -1 },
  updated: { updatedAt: -1, _id: -1 },
  name: { 'name.en': 1, _id: 1 },
  price_asc: { effectivePrice: 1, _id: 1 },
  price_desc: { effectivePrice: -1, _id: -1 },
  stock_asc: { stock: 1, _id: 1 },
  stock_desc: { stock: -1, _id: -1 },
};

const notFound = () => new AppError(404, 'Product not found', 'NOT_FOUND');
async function assertCategory(id) {
  if (id && !(await Category.exists({ _id: id }))) {
    throw new AppError(400, 'Category not found', 'INVALID_CATEGORY', [{ field: 'category', message: 'Category not found' }]);
  }
}
// A slug is taken if it is a live slug OR a retired one (so old public links never point at a different product).
async function assertSlugFree(slug, excludeId) {
  const clash = await Product.exists({
    $or: [{ slug }, { previousSlugs: slug }],
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  });
  if (clash) throw new AppError(409, 'Slug is already in use', 'DUPLICATE', [{ field: 'slug', message: 'Slug is already in use' }]);
}

router.get('/', validate(productList, 'query'), asyncHandler(async (req, res) => {
  const { page, limit, q, category, status, published, stock, sort } = req.valid;
  const filter = {};
  if (status !== 'all') filter.status = status;
  if (published) filter.isPublished = published === 'true';
  if (category) filter.category = category;
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ 'name.bn': rx }, { 'name.en': rx }, { sku: rx }, { brand: rx }];
  }
  if (stock) {
    const { lowStockThreshold } = await StoreSettings.getSingleton();
    filter.stock = stock === 'out' ? 0 : stock === 'low' ? { $gt: 0, $lte: lowStockThreshold } : { $gt: 0 };
  }
  const [items, total] = await Promise.all([
    Product.find(filter).sort(SORTS[sort]).skip((page - 1) * limit).limit(limit)
      .populate('category', 'slug name').select('+costPrice -__v').lean(),
    Product.countDocuments(filter),
  ]);
  res.json({ items, page, limit, total, totalPages: Math.ceil(total / limit) });
}));

router.get('/:id', validate(idParam, 'params'), asyncHandler(async (req, res) => {
  const item = await Product.findById(req.validParams.id).select('+costPrice -__v').lean();
  if (!item) throw notFound();
  res.json({ item });
}));

router.post('/', validate(productCreate), asyncHandler(async (req, res) => {
  const data = req.valid;
  await assertCategory(data.category);
  let slug = data.slug;
  if (slug) await assertSlugFree(slug);
  else slug = await uniqueSlug(Product, slugify(data.name.en));
  const product = await Product.create({ ...data, slug, isDemo: false });
  res.status(201).json({ item: product });
}));

router.patch('/:id', validate(idParam, 'params'), validate(productUpdate), asyncHandler(async (req, res) => {
  // Load + save (not updateOne) so the effectivePrice hook and all model validators run.
  const product = await Product.findById(req.validParams.id).select('+previousSlugs +costPrice');
  if (!product) throw notFound();
  const data = req.valid;
  await assertCategory(data.category);
  if (data.slug && data.slug !== product.slug) {
    await assertSlugFree(data.slug, product._id);
    product.previousSlugs = [...new Set([...product.previousSlugs, product.slug])].filter((s) => s !== data.slug);
  }
  product.set(data);
  await product.save();
  res.json({ item: product });
}));

// Absolute set ({stock: 40}) or atomic adjustment ({delta: -3}); never goes below zero.
router.patch('/:id/stock', validate(idParam, 'params'), validate(stockChange), asyncHandler(async (req, res) => {
  const { id } = req.validParams;
  const { stock, delta } = req.valid;
  let updated;
  if (stock !== undefined) {
    updated = await Product.findByIdAndUpdate(id, { $set: { stock } }, { new: true }).select('stock');
  } else {
    updated = await Product.findOneAndUpdate({ _id: id, stock: { $gte: -delta } }, { $inc: { stock: delta } }, { new: true }).select('stock');
    if (!updated && (await Product.exists({ _id: id }))) throw new AppError(409, 'Not enough stock for that adjustment', 'INSUFFICIENT_STOCK');
  }
  if (!updated) throw notFound();
  res.json({ id, stock: updated.stock });
}));

router.post('/:id/archive', validate(idParam, 'params'), asyncHandler(async (req, res) => {
  const item = await Product.findByIdAndUpdate(req.validParams.id, { status: 'archived', isPublished: false }, { new: true });
  if (!item) throw notFound();
  res.json({ item });
}));

router.post('/:id/restore', validate(idParam, 'params'), asyncHandler(async (req, res) => {
  const item = await Product.findByIdAndUpdate(req.validParams.id, { status: 'active' }, { new: true }); // stays unpublished until the admin publishes
  if (!item) throw notFound();
  res.json({ item });
}));

// Products that appear in any order can never be deleted (order history must stay intact): archive them instead.
router.delete('/:id', validate(idParam, 'params'), asyncHandler(async (req, res) => {
  const { id } = req.validParams;
  if (!(await Product.exists({ _id: id }))) throw notFound();
  if (await Order.exists({ 'items.product': id })) {
    throw new AppError(409, 'This product appears in orders. Archive it instead of deleting.', 'PRODUCT_HAS_ORDERS');
  }
  await Product.deleteOne({ _id: id });
  await Review.deleteMany({ product: id });
  res.json({ ok: true });
}));

export default router;
