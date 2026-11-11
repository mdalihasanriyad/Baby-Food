import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { env, imageStorage, isProd } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { UPLOAD_DIR } from '../utils/paths.js';

// Trust the file's bytes, never the client-declared type. SVG is intentionally unsupported (script risk).
export function sniff(buf) {
  if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (buf.length > 12 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: 'png', mime: 'image/png' };
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return { ext: 'webp', mime: 'image/webp' };
  return null;
}

async function toCloudinary(buf, kind) {
  const { CLOUDINARY_CLOUD_NAME: cloud, CLOUDINARY_API_KEY: key, CLOUDINARY_API_SECRET: secret } = env;
  if (!cloud || !key || !secret) throw new AppError(503, 'Image storage is not configured', 'STORAGE_NOT_CONFIGURED');
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = 'babyfoodgallery/products';
  // Signed upload: sha1 of the sorted params + secret. The secret never leaves the server.
  const signature = crypto.createHash('sha1').update(`folder=${folder}&timestamp=${timestamp}${secret}`).digest('hex');
  const form = new FormData();
  form.set('file', new Blob([buf], { type: kind.mime }), `upload.${kind.ext}`);
  form.set('api_key', key);
  form.set('timestamp', String(timestamp));
  form.set('folder', folder);
  form.set('signature', signature);
  let res;
  try {
    res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, { method: 'POST', body: form });
  } catch {
    throw new AppError(502, 'Image storage is unreachable', 'STORAGE_UNREACHABLE');
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.secure_url) throw new AppError(502, 'Image storage rejected the upload', 'STORAGE_FAILED');
  return { url: json.secure_url };
}

async function toLocalDisk(buf, kind) {
  if (isProd) throw new AppError(503, 'Local image storage is not available in production', 'STORAGE_NOT_CONFIGURED');
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const name = `${crypto.randomBytes(12).toString('hex')}.${kind.ext}`;
  await fs.writeFile(path.join(UPLOAD_DIR, name), buf);
  return { url: `/uploads/${name}` };
}

export const storeImage = (buf, kind) => (imageStorage === 'cloudinary' ? toCloudinary(buf, kind) : toLocalDisk(buf, kind));
