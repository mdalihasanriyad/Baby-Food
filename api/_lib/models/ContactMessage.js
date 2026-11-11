import mongoose from 'mongoose';
import { BD_PHONE_RE } from './constants.js';

const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    phone: { type: String, required: true, match: BD_PHONE_RE },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);
schema.index({ createdAt: -1 });

export default mongoose.models.ContactMessage || mongoose.model('ContactMessage', schema);
