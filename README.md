# Baby Food Gallery

Bangladesh e-commerce site for baby food, formula and family nutrition. Bengali by default with an English switch, cash on delivery, customer accounts, a full admin back office, SEO and optional Meta Pixel tracking.

**One repository, one Vercel project, one domain.** React + Vite + Tailwind on the front; an Express API running as a Vercel serverless function; MongoDB Atlas for data.

> **Verification status:** the project checks, 49 unit tests and a full module-graph bundle of the frontend and the API were run and pass. The production build (`npm run build`), the database integration tests, the running site and real deployment have **not** been run, because the build environment had no internet access. See [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md) for exactly what to run first.

## Project structure

```text
baby-food-gallery/
├── api/                    Backend API / Vercel serverless function
│   ├── index.js            the ONE function Vercel deploys (exports the Express app)
│   └── _lib/               everything it uses (the underscore stops Vercel exposing these files as routes)
│       ├── app.js          Express app: security middleware, routes, error handling
│       ├── routes/         API endpoints (public, customer, and admin/ for the back office)
│       ├── middleware/     auth guards, rate limiting, validation, CSRF origin check, sanitising
│       ├── models/         Mongoose models (User, Product, Category, Order, Review, ...)
│       ├── schemas/        Zod validation schemas
│       ├── services/       business logic (orders, stock, pricing, reviews, image storage)
│       ├── seo/            server-side page metadata, structured data, sitemap, robots.txt
│       ├── payments/       payment provider interface (cash on delivery today)
│       ├── config/ db/ utils/ constants/
├── docs/                   TROUBLESHOOTING.md
├── public/                 static assets (favicon, share image, logo)
├── scripts/                project scripts: seed, create-admin, checks, test runner, local server
├── src/                    React frontend
│   ├── components/ pages/ hooks/ context/ services/ utils/ i18n/ assets/
│   ├── App.jsx  main.jsx
├── tests/                  unit tests (tests/unit) and database integration tests
├── .env.example  .gitignore  index.html  package.json  vite.config.js
├── tailwind.config.js  postcss.config.js  eslint.config.js
├── tsconfig.json  tsconfig.app.json  tsconfig.node.json
├── vercel.json
└── README.md  DEPLOYMENT.md  IMPORTING.md  PRODUCTION_CHECKLIST.md
```

The project is plain JavaScript. The `tsconfig*.json` files give editors IntelliSense and let you opt in to type-checking; nothing is compiled with them.

### How a request is served on Vercel
| Request | Served by |
|---|---|
| `/assets/*`, `/favicon.svg`, images in `public/` | Vercel's CDN straight from `dist` (hashed assets cached for a year) |
| `/api/*` | `api/index.js` (Express): same domain as the site, so no CORS is involved |
| Every page URL (`/`, `/product/x`, `/account/orders`, a refresh or a shared link) | `api/index.js` returns the built app shell with page-specific title, description, canonical link, Open Graph tags and structured data already in the HTML, then React takes over. Unknown pages get a real 404 and renamed product links a 301 |

Why one function and not one file per endpoint: the API has 62 routes sharing the same middleware, validation, database connection and rate limits. One function keeps them identical to what runs locally, keeps the database connection warm across requests, and avoids Vercel's cap on functions per deployment (12 on the free Hobby plan at the time of writing; check yours). Routes are still organised one file per area under `api/_lib/routes/`.

## Quick start

Requires **Node 22.9 or newer**.

```bash
npm install
cp .env.example .env        # then fill in MONGODB_URI and JWT_SECRET (see below)
npm run seed                # optional demo categories and products (clearly flagged as demo)
npm run create-admin        # first admin account (asks for the password, hidden)
npm run dev                 # site on http://localhost:5173, API on http://localhost:5000
```

Production preview of the whole site on one port: `npm run build && npm start`, then open http://localhost:5000.

After the first successful `npm install`, **commit the generated `package-lock.json`** so installs are exactly reproducible (it could not be generated while this project was being restructured, because that environment had no internet access).

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Vite (pages, port 5173) and the API (port 5000) together; Vite proxies `/api` to the same `PORT` the API uses. If the API fails to start, both stop so the real error is the last thing you see. On start the API prints whether MongoDB is reachable and what it contains |
| `npm run build` | Builds the frontend into `dist/` and renames `dist/index.html` to `dist/shell.html` |
| `npm start` | Serves `dist/` and the API on one port (production preview) |
| `npm run check` | 10 project consistency checks, no database needed (see Testing). `npm run check -- --routes` prints the route inventory |
| `npm run lint` | Syntax check of api, scripts and tests + ESLint for `src` |
| `npm test` / `test:unit` / `test:ci` | Tests (see Testing) |
| `npm run seed` | Demo data (refuses to run in production unless `--allow-production`) |
| `npm run create-admin` | Creates an admin account interactively |
| `npm run check-env` | Validates your `.env` (`-- --production` validates it as production) |
| `npm run check-db` | Verifies the MongoDB connection (no credentials printed) **and shows how many categories, products, customers and admins the database holds**, with hints such as "run `npm run seed`" |
| `npm run check-cloudinary` | Asks Cloudinary whether your credentials are accepted (nothing is uploaded) |
| `npm run ensure-indexes` | Creates every database index (run once after the first deployment) |

## Environment variables
All are **server-only**. The browser app reads no environment variables (the API is on the same domain), so nothing here is public. Never commit `.env`.

| Variable | Needed | Purpose |
|---|---|---|
| `MONGODB_URI` | yes | MongoDB Atlas connection string |
| `JWT_SECRET` | yes | Signs login sessions (at least 32 random characters) |
| `SITE_URL` | production | Public address, e.g. `https://babyfoodgallery.com` (canonical links, share previews, sitemap) |
| `APP_URL` | yes | Allowed browser origin(s), comma separated; must include `SITE_URL` in production |
| `NODE_ENV`, `PORT` | no | Defaults: `development`, `5000` |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | production | Product image uploads. When all three are set, Cloudinary is used automatically (also in development) |
| `IMAGE_STORAGE` | no | **Leave empty** (automatic). `local` forces local disk (`public/uploads`, development only); `cloudinary` forces Cloudinary |
| `META_PIXEL_ID` | no | Optional Meta Pixel (the ID saved in Admin > Settings takes priority) |
| `SEO_TEMPLATE_PATH` | no | Advanced/testing only |

In production the server **refuses to start** with a missing or placeholder secret or database address, a non-https `SITE_URL`, or an `APP_URL` that does not include the site's own address. `npm run check-env -- --production` tells you what is wrong before you deploy.

## What is built

- **Storefront (Bengali/English):** home, shop with search/filters/sorting/pagination, Baby Food and Adult Food sections, any admin-created category, product pages with gallery, stock, discounts, verified-purchase reviews and related products, wishlist, server-priced cart, checkout with delivery fee shown before ordering, cash on delivery.
- **Customer account:** register/login, order history with status timeline, cancellation, reorder, profile, password change, reviews.
- **Admin (`/admin`, English):** dashboard and reports (by day/month/year in Bangladesh time), order processing (status workflow, internal notes, COD collection, printable invoice), products, categories, image upload, customers, review moderation, delivery fees and store settings.
- **SEO and analytics:** server-rendered metadata and structured data, sitemap, robots.txt, hreflang, noindex rules; consent-first Meta Pixel.

### Business rules worth knowing
- **Prices are never trusted from the browser.** The server recomputes prices, discounts, delivery fee and totals from the database.
- **Stock** is deducted atomically when an order is placed (two customers cannot buy the last unit) and restored on cancellation. Orders use a MongoDB transaction where available (Atlas) and a safe fallback elsewhere.
- **Delivery:** ৳70 inside Dhaka, ৳120 outside (changeable in Admin > Settings; applies to new orders only). "Inside Dhaka" means the Dhaka district.
- **Cancellation:** customers can cancel while an order is pending or confirmed; admins until it is delivered.
- **Reports** group by order date. Delivered sales are the only revenue; open orders are never counted as revenue. Gross = delivered + open + cancelled. Estimated profit uses only items with a cost price.
- **Demo data** is flagged, never indexed by search engines, and carries no price or rating data in structured data.

## Testing

```bash
npm run check        # 10 consistency checks (no database)
npm run test:unit    # 49 unit tests (no database)
npm test             # + 8 integration test files if MONGODB_URI_TEST is set (says clearly when it skips them)
npm run test:ci      # same, but fails if the integration tests cannot run (used by GitHub Actions)
```

The 10 checks: every imported package is declared; **every API call in the frontend matches a real route (path and method)**; admin routes are behind the admin guard and customer routes behind the customer guard (no admin sign-up route); every environment variable is documented; no secrets in the repo, browser code or logs; Vercel/build configuration; Bengali/English translations; the single-root structure; no references to the old two-folder layout.

Integration tests (auth and roles, catalog, shop, orders and stock races, account, admin workflow and report money rules, SEO pages, rate limiting) run real HTTP requests against the real app and a real database. Create a **separate, empty, disposable** database whose name contains `test` and set `MONGODB_URI_TEST` in `.env`; the suite refuses to run otherwise and removes what it creates. `.github/workflows/ci.yml` runs everything, with a MongoDB container, on every push once the repository is on GitHub.

Not covered: browser end-to-end tests, automated accessibility tests, load tests, Lighthouse scores.

## Security in short
Passwords hashed with bcrypt; sessions in `httpOnly` cookies with separate customer and admin realms; roles re-checked in the database on every request; all input validated with Zod; NoSQL-injection and CSRF protections; rate limits shared across serverless instances through MongoDB; strict Content-Security-Policy on pages; upload type checked by file bytes; no personal data to Meta. Details, accepted risks and the launch checklist: [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md).

## Documentation
- [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md): what to check when the API does not start, the shop is empty, uploads or login fail.
- [DEPLOYMENT.md](DEPLOYMENT.md): GitHub, Atlas, Cloudinary, Vercel, custom domain, HTTPS, post-launch steps.
- [IMPORTING.md](IMPORTING.md): putting this project on GitHub and Vercel, moving it to another computer, upgrading from the earlier two-folder layout.
- [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md): what was and was not verified, pre-launch checklists, security review, known limitations.
# Baby-Food
