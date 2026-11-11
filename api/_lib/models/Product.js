import mongoose from 'mongoose';
import { SLUG_RE, wholeTaka } from './constants.js';

const bilingual = (max) => ({ bn: { type: String, trim: true, maxlength: max }, en: { type: String, trim: true, maxlength: max } });

const productSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, lowercase: true, trim: true, match: SLUG_RE, maxlength: 120 },
    sku: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
    name: {
      bn: { type: String, required: true, trim: true, maxlength: 160 },
      en: { type: String, required: true, trim: true, maxlength: 160 },
    },
    description: bilingual(4000),
    // Only verified, admin-supplied data. Nothing is invented by the system.
    details: { ingredients: bilingual(2000), ageInfo: bilingual(500), other: bilingual(2000) },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    brand: { type: String, trim: true, maxlength: 80 },
    price: { type: Number, required: true, min: 1, validate: wholeTaka }, // regular price, whole BDT
    salePrice: { type: Number, min: 1, validate: wholeTaka, default: null },
    effectivePrice: { type: Number, min: 1 }, // salePrice ?? price, maintained by the pre-validate hook
    costPrice: { type: Number, min: 0, validate: wholeTaka, select: false }, // admin-only, for profit estimates
    stock: { type: Number, required: true, min: 0, default: 0, validate: wholeTaka },
    images: [{ url: { type: String, trim: true, required: true }, alt: { type: String, trim: true, maxlength: 160 } }],
    isPublished: { type: Boolean, default: false },
    status: { type: String, enum: ['active', 'archived'], default: 'active' },
    isFeatured: { type: Boolean, default: false },
    isBestseller: { type: Boolean, default: false },
    isDemo: { type: Boolean, default: false }, // seed data is always flagged
    soldCount: { type: Number, default: 0, min: 0 },
    ratingAverage: { type: Number, default: 0, min: 0, max: 5 }, // recalculated from approved reviews
    ratingCount: { type: Number, default: 0, min: 0 },
    seo: { title: { type: String, trim: true, maxlength: 70 }, metaDescription: { type: String, trim: true, maxlength: 160 } },
    previousSlugs: { type: [String], default: [], select: false },
  },
  { timestamps: true }
);

// NOTE: this hook runs on save()/create() only. Updates must use findById + save(),
// or set effectivePrice explicitly, so effectivePrice never drifts.
productSchema.pre('validate', function setEffectivePrice(next) {
  if (this.salePrice != null && this.salePrice >= this.price) {
    this.invalidate('salePrice', 'salePrice must be lower than the regular price');
  }
  this.effectivePrice = this.salePrice != null ? this.salePrice : this.price;
  next();
});

productSchema.virtual('discountPercent').get(function discountPercent() {
  return this.salePrice != null && this.price > 0 ? Math.round(((this.price - this.salePrice) / this.price) * 100) : 0;
});
productSchema.set('toJSON', { virtuals: true, transform: (_d, r) => { delete r.id; delete r.__v; return r; } });

productSchema.index({ slug: 1 }, { unique: true });
productSchema.index({ sku: 1 }, { unique: true });
productSchema.index({ isPublished: 1, status: 1, createdAt: -1 });
productSchema.index({ category: 1, isPublished: 1, effectivePrice: 1 });
productSchema.index({ isPublished: 1, soldCount: -1 });
productSchema.index({ isFeatured: 1, isPublished: 1 });
productSchema.index({ stock: 1 }); // low-stock reports

export default mongoose.models.Product || mongoose.model('Product', productSchema);
