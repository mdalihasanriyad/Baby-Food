import mongoose from 'mongoose';
import { REVIEW_STATUSES } from './constants.js';

const reviewSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true }, // the verified purchase
    rating: { type: Number, required: true, min: 1, max: 5, validate: { validator: Number.isInteger, message: 'rating must be a whole number' } },
    comment: { type: String, trim: true, maxlength: 1000 },
    status: { type: String, enum: REVIEW_STATUSES, default: 'pending' }, // moderated by admins
  },
  { timestamps: true }
);

reviewSchema.index({ user: 1, product: 1, order: 1 }, { unique: true }); // one review per purchase
reviewSchema.index({ product: 1, status: 1, createdAt: -1 });
reviewSchema.index({ status: 1, createdAt: -1 });

export default mongoose.models.Review || mongoose.model('Review', reviewSchema);
