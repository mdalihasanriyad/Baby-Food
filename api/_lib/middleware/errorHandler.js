import { ZodError } from 'zod';
import mongoose from 'mongoose';
import { AppError } from '../utils/errors.js';
import { isProd } from '../config/env.js';

export const notFound = (_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } });

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Something went wrong';
  let details;

  if (err instanceof ZodError) {
    status = 400; code = 'VALIDATION_ERROR'; message = 'Invalid input';
    details = err.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
  } else if (err instanceof AppError) {
    ({ status, code, message, details } = err);
  } else if (err instanceof mongoose.Error.ValidationError) {
    status = 400; code = 'VALIDATION_ERROR'; message = 'Invalid input';
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400; code = 'INVALID_ID'; message = 'Invalid identifier';
  } else if (err?.code === 11000) {
    status = 409; code = 'DUPLICATE'; message = 'A record with this value already exists';
    details = Object.keys(err.keyPattern ?? {}).map((f) => ({ field: f, message: 'must be unique' }));
  } else if (err?.name === 'BadRangeError') {
    status = 400; code = 'BAD_RANGE'; message = err.message;
  } else if (err?.type === 'entity.parse.failed') {
    status = 400; code = 'BAD_JSON'; message = 'Malformed JSON body';
  } else if (err?.type === 'entity.too.large') {
    status = 413; code = 'PAYLOAD_TOO_LARGE'; message = 'Request body too large';
  }

  if (status >= 500) console.error(`${req.method} ${req.path} -> ${err?.name}: ${err?.message}`); // no bodies, no headers
  const body = { error: { code, message } };
  if (details) body.error.details = details;
  if (!isProd && status >= 500) body.error.debug = err?.message;
  res.status(status).json(body);
}
