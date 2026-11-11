import mongoose from 'mongoose';

// Rate-limit counters kept in MongoDB, shared by every server instance.
// Why: on Vercel each request may run on a different serverless instance, so in-memory counters would never add up.
// MongoDB removes expired windows by itself (TTL index). If the database errors, the limiter FAILS OPEN (the request is
// allowed and the error is logged): a database hiccup must not lock every customer out of logging in.
const schema = new mongoose.Schema(
  { _id: String, count: { type: Number, default: 0 }, resetAt: { type: Date, required: true } },
  { versionKey: false }
);
schema.index({ resetAt: 1 }, { expireAfterSeconds: 0 });
export const RateLimit = mongoose.models.RateLimit || mongoose.model('RateLimit', schema);

export class MongoRateLimitStore {
  localKeys = false; // shared between instances

  constructor({ prefix, model = RateLimit, now = () => new Date() } = {}) {
    this.prefix = prefix ?? '';
    this.model = model;
    this.now = now;
    this.windowMs = 60 * 1000;
  }

  init(options) { this.windowMs = options.windowMs; }
  id(key) { return `${this.prefix}${key}`; }

  async increment(key) {
    const _id = this.id(key);
    const now = this.now();
    try {
      // 1) inside a live window: one atomic increment
      let doc = await this.model.findOneAndUpdate({ _id, resetAt: { $gt: now } }, { $inc: { count: 1 } }, { new: true }).lean();
      if (!doc) {
        // 2) no live window (first hit, or the old one expired): start a new one
        try {
          doc = await this.model.findOneAndUpdate({ _id }, { $set: { count: 1, resetAt: new Date(now.getTime() + this.windowMs) } }, { upsert: true, new: true }).lean();
        } catch (err) {
          if (err?.code !== 11000) throw err; // two first requests raced to create the same counter: just count this one
          doc = await this.model.findOneAndUpdate({ _id, resetAt: { $gt: now } }, { $inc: { count: 1 } }, { new: true }).lean();
        }
      }
      return { totalHits: doc.count, resetTime: doc.resetAt };
    } catch (err) {
      console.error(`rate limit store unavailable (${err?.name}); allowing the request`);
      return { totalHits: 1, resetTime: new Date(now.getTime() + this.windowMs) };
    }
  }

  async decrement(key) { // used by skipSuccessfulRequests
    try { await this.model.updateOne({ _id: this.id(key), count: { $gt: 0 } }, { $inc: { count: -1 } }); } catch { /* best effort */ }
  }

  async resetKey(key) {
    try { await this.model.deleteOne({ _id: this.id(key) }); } catch { /* best effort */ }
  }
}
