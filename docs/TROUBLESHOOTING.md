# Troubleshooting

Start here when something does not work. Most problems show up in the terminal where you ran `npm run dev`: that terminal has **two colour-coded streams, `[api]` (the backend) and `[web]` (Vite, the pages)**. Read the `[api]` lines first; if the API did not start, every page will show errors.

## The 60-second health check

```bash
npm run check-env      # is .env valid? (add -- --production to check it as production)
npm run check-db       # can we reach MongoDB, and is there data in it?
npm run check-cloudinary   # does Cloudinary accept your credentials?
```

When `npm run dev` starts correctly, the `[api]` stream prints these lines (this is how you know it is healthy):

```text
API listening on http://localhost:5000  (product images: cloudinary)
Database: connected to "babyfoodgallery": 8 categories, 10 products (10 published), 1 customers, 1 admins.
```

If a line starting with `!` follows, it tells you exactly what is missing (for example "no catalog yet: run `npm run seed`").

## Symptoms

### `TypeError: root path must be a string` (at `serveStatic` / `app.js`)
Fixed. The cause was a file-system location passed to `express.static()` as a `URL` object instead of a string; all locations now come from `api/_lib/utils/paths.js` as plain strings. A unit test and a project check (`npm run check`) now fail if anyone reintroduces it. If you still see this error, you are running an older copy of the project.

### `[vite] http proxy error: ECONNREFUSED` on `/api/...`
Vite (the `[web]` stream) forwards `/api/*` to the backend, and the backend is **not running**. It is a symptom, not the cause. Scroll up in the terminal to the first red `[api]` error (an environment error, a crash on startup, or `Port 5000 is already in use`). `npm run dev` stops both servers when the API fails to start, so the first error is the one to read.
If you changed `PORT` in `.env`, restart `npm run dev`: Vite reads the same value.

### `Port 5000 is already in use`
Another program (often an earlier `npm run dev` that was not closed) is using the port. Close it, or set another `PORT` in `.env` and restart.

### The shop is empty: no products, categories or homepage sections
A working database connection does **not** mean the database has data. Run `npm run check-db`: it prints the counts. Then:
- **No categories/products:** `npm run seed` loads the sample catalog. It is safe to run on a database that already has data: it only adds what is missing and never overwrites or deletes anything.
- **Products exist but "0 published":** the shop only shows products that are *Published* and *Active*. Publish them in Admin > Products.
- **Baby Food / Adult Food pages are empty but "Shop all" works:** the category has no "Shop section". Set it in Admin > Categories.
- Public data is never cached by the browser while developing, so a refresh always shows the latest data.

### `Database: NOT reachable`
- **Atlas > Network Access:** your current IP address must be allowed (add it, or `0.0.0.0/0` while testing).
- **Username/password in `MONGODB_URI`:** special characters in the password must be URL-encoded (`@` becomes `%40`), and the URI must not still contain `<placeholders>`.
- Include the database name in the URI (`...mongodb.net/babyfoodgallery?...`).
- API routes that need the database answer `503 Database is unavailable` until this is fixed; public pages still load.

### `/api/auth/me` shows 401 in the browser
Normal. It is how the site asks "is someone logged in?"; visitors who are not logged in get a 401 and the site carries on. It does not affect products or categories.

### Login or checkout answers 403 `BAD_ORIGIN`
The browser's address is not in `APP_URL`. In development `localhost` and `127.0.0.1` both work when `APP_URL=http://localhost:5173`. In production `APP_URL` must list every address visitors use (`https://babyfoodgallery.com,https://www.babyfoodgallery.com`).

### Login answers 503 `AUTH_NOT_CONFIGURED`
`JWT_SECRET` is missing from `.env`. Generate one with the command shown in `.env.example`.

### Cannot log in to `/admin/login`
Admin accounts are only created with `npm run create-admin`. Customer accounts cannot use the admin login (and vice versa).

### Image upload fails with 503 `STORAGE_NOT_CONFIGURED`
- Run `npm run check-cloudinary`: it says whether the cloud name, key and secret are accepted.
- Leave `IMAGE_STORAGE` **empty** in `.env`: Cloudinary is then chosen automatically whenever all three `CLOUDINARY_*` values are set. (`IMAGE_STORAGE=local` forces local disk, which saves to `public/uploads` and only works in development.)
- Images in the database are stored as full URLs, so existing local and Cloudinary images keep working side by side.
- The Cloudinary secret exists only on the server; it is never sent to the browser.

### The server refuses to start with `Invalid environment configuration`
The message names the variables (never their values). Run `npm run check-env -- --production` to see every problem and warning.

### `npm run build` or `npm run lint` fails
Send the exact error text. Nothing in this project requires a special build step beyond `npm install`; the build creates `dist/` and renames `dist/index.html` to `dist/shell.html` on purpose (the API fills in each page's search and share tags).

## When asking for help, include
1. The full output of `npm run dev` from the start (both `[api]` and `[web]` lines, with any secrets removed).
2. The output of `npm run check-env`, `npm run check-db` and `npm run check-cloudinary`.
3. Your Node version (`node -v`; 22.9 or newer is required) and operating system.
