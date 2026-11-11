import mongoose from 'mongoose';
import { BD_PHONE_RE, ROLES } from './constants.js';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    phone: { type: String, required: true, trim: true, match: BD_PHONE_RE },
    email: { type: String, trim: true, lowercase: true, maxlength: 254 },
    // Hash only (Phase 3 uses a maintained hashing library). Never returned by default.
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'customer', required: true },
    isActive: { type: Boolean, default: true },
    wishlist: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }], default: [], select: false }, // max 100, enforced in the route
    failedLoginCount: { type: Number, default: 0, select: false },
    lockUntil: { type: Date, select: false },
    passwordChangedAt: { type: Date, select: false },
  },
  { timestamps: true }
);

userSchema.index({ phone: 1 }, { unique: true });
userSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: 'string' } } });
userSchema.index({ role: 1 });

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.failedLoginCount;
    delete ret.lockUntil;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.models.User || mongoose.model('User', userSchema);
