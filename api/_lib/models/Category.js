import mongoose from 'mongoose';
import { SLUG_RE } from './constants.js';

const categorySchema = new mongoose.Schema(
  {
    name: {
      bn: { type: String, required: true, trim: true, maxlength: 80 },
      en: { type: String, required: true, trim: true, maxlength: 80 },
    },
    slug: { type: String, required: true, lowercase: true, trim: true, match: SLUG_RE, maxlength: 100 },
    description: { bn: { type: String, trim: true, maxlength: 500 }, en: { type: String, trim: true, maxlength: 500 } },
    image: { url: { type: String, trim: true }, alt: { type: String, trim: true, maxlength: 160 } },
    group: { type: String, enum: ['baby', 'adult', 'other'], default: 'other' }, // drives the Baby Food / Adult Food pages
    isVisible: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    previousSlugs: { type: [String], default: [], select: false }, // for redirects after slug changes
  },
  { timestamps: true }
);

categorySchema.index({ slug: 1 }, { unique: true });
categorySchema.index({ isVisible: 1, sortOrder: 1 });
categorySchema.index({ group: 1, isVisible: 1 });

export default mongoose.models.Category || mongoose.model('Category', categorySchema);
