import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

// Cache the connection on globalThis so warm serverless invocations (Vercel) reuse it.
const cache = (globalThis.__bfgMongo ??= { conn: null, promise: null });

export async function connectDB() {
  if (!env.MONGODB_URI) {
    throw new AppError(503, 'Database is not configured', 'DB_NOT_CONFIGURED');
  }
  if (cache.conn) return cache.conn;
  if (!cache.promise) {
    mongoose.set('strictQuery', true);
    cache.promise = mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 8000,
      maxPoolSize: 10,
      bufferCommands: false,
    });
  }
  try {
    cache.conn = await cache.promise;
  } catch (err) {
    cache.promise = null;
    console.error('MongoDB connection failed:', err.name); // never log the URI
    throw new AppError(503, 'Database is unavailable', 'DB_UNAVAILABLE');
  }
  return cache.conn;
}

export async function disconnectDB() {
  if (cache.conn) await mongoose.disconnect();
  cache.conn = null;
  cache.promise = null;
}
