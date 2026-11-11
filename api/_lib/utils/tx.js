import mongoose from 'mongoose';

const unsupported = (err) =>
  err?.code === 20 || /Transaction numbers are only allowed|does not support sessions|replica set/i.test(err?.message ?? '');

// Runs fn(session) inside a MongoDB transaction (Atlas: supported). On a standalone MongoDB server
// (no transactions) it runs fn(null) instead, and fn must then undo partial work itself.
export async function withOptionalTransaction(fn) {
  let session;
  try {
    session = await mongoose.startSession();
    let result;
    await session.withTransaction(async () => { result = await fn(session); });
    return result;
  } catch (err) {
    if (unsupported(err)) return fn(null);
    throw err;
  } finally {
    await session?.endSession();
  }
}
