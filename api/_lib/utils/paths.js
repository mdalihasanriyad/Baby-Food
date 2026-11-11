import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The single source of truth for where things live on disk. Everything here is a plain absolute STRING:
// libraries such as express.static() reject URL objects ("root path must be a string").
// This file sits at <project>/api/_lib/utils/paths.js, so the project root is three folders up.
// On Vercel the same relative layout exists inside the function bundle, so these paths work there too.
const here = path.dirname(fileURLToPath(import.meta.url));

export const ROOT_DIR = path.resolve(here, '..', '..', '..');
export const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
export const UPLOAD_DIR = path.join(PUBLIC_DIR, 'uploads'); // images uploaded while developing (git-ignored)
export const DIST_DIR = path.join(ROOT_DIR, 'dist'); // the production build of the frontend
