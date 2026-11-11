# Importing this project

## Put it on GitHub
```bash
git init
git add .
git status                       # confirm: no .env, no node_modules
git commit -m "Baby Food Gallery"
git branch -M main
git remote add origin https://github.com/YOUR-USER/baby-food-gallery.git
git push -u origin main
```
Run `npm install` once first and commit the `package-lock.json` it creates.

## Import the repository into Vercel
1. vercel.com → **Add New → Project** → choose the GitHub repository → **Import**.
2. Framework **Vite**, Root Directory `./`, Build Command `npm run build`, Output Directory `dist`.
3. Add the environment variables (Settings → Environment Variables; the **Import .env** button accepts pasted `.env` lines). The names and meanings are in `.env.example` and README.md.
4. Deploy. Full details: [DEPLOYMENT.md](DEPLOYMENT.md).

## Set it up on another computer
```bash
git clone https://github.com/YOUR-USER/baby-food-gallery.git
cd baby-food-gallery
npm install
cp .env.example .env             # fill in your own values; .env is never committed
npm run dev
```
Requires Node 22.9 or newer.

## Upgrading from the earlier two-folder layout
Earlier versions of this project kept the website and the API in separate folders, each with its own `package.json`. This version has **one** root project. Nothing about your data changes: the database, the environment variable names and the API addresses (`/api/...`) are identical, so no data migration is needed.

1. Keep a copy of your `.env` (and of any local changes you made).
2. In your existing clone, delete everything except `.git` and `.env`, then copy in the contents of this project, or simply clone the new repository and move `.env` into it. **Do not merge the old folders into the new layout**; the old frontend and backend folders must not exist any more.
3. `npm install` (this creates one new `package-lock.json`; commit it, and delete any old lock files).
4. In the existing Vercel project: **Settings → General** → Root Directory `./`, Framework Preset **Vite**, Build Command `npm run build`, Output Directory `dist`; clear any other overrides. Environment variables stay as they are, except add `SITE_URL` if it is not set yet.
5. Push to GitHub; Vercel rebuilds.
6. Check: `npm run check` ends with "All 10 checks passed" and shows no old-folder references.

## Importing data
- **Demo data:** `npm run seed` loads sample categories and products (flagged as demo; they are never indexed by search engines and carry no price data in structured data). Safe to run again; it never overwrites edits. It refuses to run against production unless you pass `--allow-production`.
- **Your own products:** add them in Admin → Products (images upload to Cloudinary). There is **no bulk import (CSV) tool yet**; for a large catalog tell me and I will add one.
- **An existing MongoDB database:** use `mongodump` / `mongorestore` into the Atlas database named in `MONGODB_URI`, then run `npm run ensure-indexes`. Imported orders must follow the order schema (see `api/_lib/models/Order.js`).
- **First admin:** `npm run create-admin`. There is no admin sign-up page, by design.
