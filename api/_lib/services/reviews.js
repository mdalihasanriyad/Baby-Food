import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Review from '../models/Review.js';
import Product from '../models/Product.js';

// Eligibility rule: the customer has a DELIVERED order containing the product, and has not
// already reviewed that purchase. Returns that order (or null).
export async function findEligibleOrder(userId, productId) {
  const reviewed = await Review.find({ user: userId, product: productId }).distinct('order');
  return Order.findOne({ user: userId, status: 'delivered', 'items.product': productId, _id: { $nin: reviewed } })
    .sort({ deliveredAt: 1 }).select('_id').lean();
}

// Average and count come only from APPROVED reviews. Called by admin moderation (Phase 8).
export async function recalcProductRating(productId) {
  const [r] = await Review.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(String(productId)), status: 'approved' } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  await Product.updateOne({ _id: productId }, { $set: { ratingAverage: r ? Math.round(r.avg * 10) / 10 : 0, ratingCount: r?.count ?? 0 } });
}
