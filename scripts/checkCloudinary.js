// Checks your Cloudinary credentials without uploading anything:   npm run check-cloudinary
import { env, imageStorage } from '../api/_lib/config/env.js';

const { CLOUDINARY_CLOUD_NAME: cloud, CLOUDINARY_API_KEY: key, CLOUDINARY_API_SECRET: secret } = env;
const missing = [['CLOUDINARY_CLOUD_NAME', cloud], ['CLOUDINARY_API_KEY', key], ['CLOUDINARY_API_SECRET', secret]].filter(([, v]) => !v).map(([n]) => n);
console.log(`Image storage in use: ${imageStorage}`);
if (missing.length) {
  console.log(`Cloudinary is not fully configured. Missing: ${missing.join(', ')}.`);
  process.exit(imageStorage === 'cloudinary' ? 1 : 0);
}
try {
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/ping`, { headers: { Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}` } });
  if (res.ok) console.log('Cloudinary accepted the credentials. Image uploads will work.');
  else if (res.status === 401 || res.status === 403) { console.log('Cloudinary REJECTED the credentials: check CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.'); process.exit(1); }
  else if (res.status === 404) { console.log('Cloudinary does not know this cloud name: check CLOUDINARY_CLOUD_NAME.'); process.exit(1); }
  else { console.log(`Unexpected answer from Cloudinary (HTTP ${res.status}).`); process.exit(1); }
} catch (err) {
  console.log(`Could not reach Cloudinary (${err.name}). Check your internet connection.`);
  process.exit(1);
}
