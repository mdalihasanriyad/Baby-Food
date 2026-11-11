import mongoose from 'mongoose';
import { wholeTaka } from './constants.js';

const bi = { bn: { type: String, trim: true, maxlength: 4000 }, en: { type: String, trim: true, maxlength: 4000 } };

const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'main' }, // singleton document
    delivery: {
      insideDhaka: { type: Number, default: 70, min: 0, validate: wholeTaka },
      outsideDhaka: { type: Number, default: 120, min: 0, validate: wholeTaka },
    },
    contact: {
      phone: { type: String, trim: true, maxlength: 30 },
      email: { type: String, trim: true, maxlength: 254 },
      address: { type: String, trim: true, maxlength: 300 },
      facebook: { type: String, trim: true, maxlength: 200 },
      instagram: { type: String, trim: true, maxlength: 200 },
      whatsapp: { type: String, trim: true, maxlength: 30 },
    },
    about: bi,
    metaPixelId: { type: String, trim: true, match: /^\d{5,20}$/ }, // public by design; empty = tracking off
    lowStockThreshold: { type: Number, default: 10, min: 0, validate: wholeTaka },
  },
  { timestamps: true }
);

settingsSchema.index({ key: 1 }, { unique: true });

settingsSchema.statics.getSingleton = async function getSingleton() {
  const opts = { upsert: true, new: true, setDefaultsOnInsert: true };
  try {
    return await this.findOneAndUpdate({ key: 'main' }, { $setOnInsert: { key: 'main' } }, opts);
  } catch (err) {
    if (err.code === 11000) return this.findOne({ key: 'main' }); // lost an insert race
    throw err;
  }
};

export default mongoose.models.StoreSettings || mongoose.model('StoreSettings', settingsSchema);
