import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { DELIVERY_ZONES, ORDER_STATUSES, PAYMENT_METHODS, PAYMENT_STATUSES, BD_PHONE_RE, wholeTaka } from './constants.js';

const money = { type: Number, required: true, min: 0, validate: wholeTaka };

// Everything below is a SNAPSHOT: later product edits never change an existing order.
const itemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    sku: { type: String, required: true },
    name: { bn: { type: String, required: true }, en: { type: String, required: true } },
    image: { type: String },
    listPrice: money, // regular price at order time
    unitPrice: money, // price actually charged per unit (sale price if any)
    quantity: { type: Number, required: true, min: 1, max: 50, validate: wholeTaka },
    lineTotal: money,
    costPrice: { type: Number, min: 0, validate: wholeTaka }, // snapshot, only if configured
  },
  { _id: false }
);

const historySchema = new mongoose.Schema(
  {
    status: { type: String, enum: ORDER_STATUSES, required: true },
    at: { type: Date, default: Date.now },
    note: { type: String, maxlength: 300 },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    // Public, non-guessable identifier (64 random bits). Not a sequential number.
    trackingId: { type: String, default: () => `BFG-${crypto.randomBytes(8).toString('hex').toUpperCase()}`, immutable: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Client-generated key; a repeated checkout request with the same key returns the same order.
    idempotencyKey: { type: String, required: true, maxlength: 80 },
    items: { type: [itemSchema], validate: (v) => v.length > 0 },
    customer: {
      name: { type: String, required: true, trim: true, maxlength: 80 },
      phone: { type: String, required: true, match: BD_PHONE_RE },
      address: { type: String, required: true, trim: true, maxlength: 300 },
      district: { type: String, required: true, trim: true, maxlength: 60 },
      area: { type: String, trim: true, maxlength: 80 },
    },
    deliveryZone: { type: String, enum: DELIVERY_ZONES, required: true },
    subtotal: money, // sum of lineTotal
    discountTotal: money, // sum((listPrice - unitPrice) * quantity); informational, already reflected in unitPrice
    deliveryFee: money, // snapshot of the fee at order time
    total: money, // subtotal + deliveryFee
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: 'cod', required: true },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'unpaid', required: true },
    status: { type: String, enum: ORDER_STATUSES, default: 'pending', required: true },
    statusHistory: { type: [historySchema], default: [] },
    internalNotes: [{ text: { type: String, maxlength: 500 }, by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, at: { type: Date, default: Date.now } }],
    // Stock policy: deducted when the order is created, restored if it is cancelled.
    stockDeducted: { type: Boolean, default: true },
    paymentCollectedAt: Date,
    deliveredAt: Date,
    cancelledAt: Date,
    attribution: { utmSource: String, utmMedium: String, utmCampaign: String }, // optional, for ads reporting
  },
  { timestamps: true }
);

orderSchema.pre('validate', function checkTotals(next) {
  if (this.isNew && this.statusHistory.length === 0) this.statusHistory.push({ status: this.status });
  const sub = this.items.reduce((s, i) => s + i.lineTotal, 0);
  const lineOk = this.items.every((i) => i.lineTotal === i.unitPrice * i.quantity);
  if (!lineOk) this.invalidate('items', 'lineTotal must equal unitPrice x quantity');
  if (this.subtotal !== sub) this.invalidate('subtotal', 'subtotal must equal the sum of line totals');
  if (this.total !== this.subtotal + this.deliveryFee) this.invalidate('total', 'total must equal subtotal + deliveryFee');
  next();
});

orderSchema.index({ trackingId: 1 }, { unique: true });
orderSchema.index({ user: 1, idempotencyKey: 1 }, { unique: true }); // duplicate-submission guard
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ 'items.product': 1 });

export default mongoose.models.Order || mongoose.model('Order', orderSchema);
