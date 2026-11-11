# Production checklist

Everything to do and to know before real customers use the site: what was and was not verified, the commands to run first, a launch checklist, the security review and the known limitations. Deployment steps are in [DEPLOYMENT.md](DEPLOYMENT.md).

## 1. Verification status (honest)

The environment this project was restructured in had **no internet access**, so packages could not be installed there.

| Run here and passing | NOT run (do these first) |
|---|---|
| 10 project consistency checks (`npm run check`) | `npm install` (so there is no `package-lock.json` yet: create and commit it) |
| 49 unit tests (`npm run test:unit`) | `npm run build` (the Vite production build) |
| A full module-graph bundle of the frontend (72 modules) and of the API (72 modules, including the single function entry): no unresolved import, no missing export; identical module sets before and after the restructure | The 8 database integration test files (`npm test` with `MONGODB_URI_TEST`) |
| TypeScript type-check of all JavaScript: no undefined names, unused code or broken imports | ESLint (`npm run lint`), the running site in a browser, real crawlers, the Meta Pixel |
| Syntax parse of every file; validation of `vercel.json` and the tsconfig files | Atlas transactions, Cloudinary uploads, an actual Vercel deployment |

Expect a few small failures on the first real run (typos, a package detail). That is normal for code that has never executed. Send the failing output and fix it before launch.

## 2. Run these first (on your computer)

```bash
npm install                 # creates package-lock.json: commit it
npm run check               # 10 consistency checks
npm run test:unit           # 49 unit tests
npm run build               # must finish without errors
npm run check               # again: now also verifies dist/shell.html
npm start                   # open http://localhost:5000 and click around (needs .env with MONGODB_URI and JWT_SECRET)
npm test                    # with MONGODB_URI_TEST set: runs the 8 integration test files too
```

### Test database
Create a **separate, empty, disposable** database (for example another database name on a free Atlas cluster) and set in `.env`:

```
MONGODB_URI_TEST=mongodb+srv://<db-user>:<db-password>@<cluster-host>/babyfoodgallery_test?retryWrites=true&w=majority
```

The database name **must contain `test`**; otherwise the suite refuses to run, so tests cannot touch real data. Tests create their own records and remove them. GitHub Actions (`.github/workflows/ci.yml`) runs everything with a MongoDB container on every push. That container has no transactions, so CI exercises the automatic fallback for order placement; the transaction path only runs on Atlas.

### What the tests cover
| Layer | Where | Needs a database? | Count |
|---|---|---|---|
| Project consistency checks | `scripts/check-project.mjs` (`npm run check`) | No | 10 checks |
| Unit tests | `tests/unit/` | No | 34 tests |
| Integration tests (real HTTP requests against the real app and a real MongoDB) | `tests/*.test.js` | **Yes** (`MONGODB_URI_TEST`) | 8 files |
| Linting / syntax | `npm run lint` | No | syntax check of `api`, `scripts`, `tests` + ESLint for `src` |

## 3. Configuration checklist
- [ ] `JWT_SECRET` generated randomly (command in `.env.example`), set only in Vercel
- [ ] `npm run check-env -- --production` reports no errors, and you have read every warning
- [ ] `SITE_URL=https://babyfoodgallery.com` and `APP_URL` listing the same address (and the `www` version if it is reachable)
- [ ] Atlas: database user limited to one database; network access `0.0.0.0/0` (Vercel has no fixed address); backups enabled
- [ ] Cloudinary variables set and `IMAGE_STORAGE=cloudinary`
- [ ] `npm run ensure-indexes` run once against the production database
- [ ] First admin created with `npm run create-admin` (long, unique password)
- [ ] `package-lock.json` committed; CI switched from `npm install` to `npm ci`
- [ ] `MONGODB_URI_TEST` and `RATE_LIMIT_*` are **not** set in Vercel

## 4. Security checklist before launch
1. Generate `JWT_SECRET` with the command in `.env.example`; set it only in Vercel's environment settings.
2. Run `npm run check-env -- --production` with your production values; fix every error and read every warning.
3. Create the first admin with `npm run create-admin` using a long unique password (a password manager is ideal).
4. Atlas: a database user limited to this one database; Vercel needs network access "from anywhere" (`0.0.0.0/0`), so the strong database password is the protection. Enable backups.
5. Turn on two-factor authentication for GitHub, Vercel, MongoDB Atlas, Cloudinary and your domain registrar.
6. Run `npm run ensure-indexes` once against production.
7. Delete or replace the demo products; remove the demo admin/test accounts; remove `MONGODB_URI_TEST` from production settings.
8. Commit `package-lock.json`, switch CI to `npm ci`, review Dependabot pull requests.
9. After deploying, open `/robots.txt`, `/sitemap.xml`, a product page's source, and try an admin URL while logged out.

## 5. Manual functional checklist (real phone and desktop)
1. Register, log out, log in; try a wrong password; change the language; refresh (language is remembered).
2. Browse home, Baby Food, a category, a product; search; use filters; open a shared product link in a private window.
3. Add to cart, change quantities, try to exceed stock, remove; checkout inside Dhaka and outside Dhaka; check the fee and totals; place a COD order; refresh the confirmation page (no second order).
4. Cancel a pending order; confirm the stock came back (Admin > Products).
5. As admin: confirm → process → ship → deliver an order; mark cash collected; add a note; print the invoice; check Dashboard and Reports numbers against your own count.
6. Moderate a review; edit a delivery fee; place a new order and check the new fee.
7. Share a product link on Facebook/WhatsApp (Facebook Sharing Debugger) and check the preview.
8. With a Pixel ID set: banner appears, nothing loads before "Accept", Pixel Helper shows ViewContent / AddToCart / InitiateCheckout / one Purchase.
9. Turn off the network mid-use: the offline banner and error messages with a Retry button appear.

## 6. Security review

Status: reviewed by reading the code, by automated static checks and by pattern scans. **No penetration test has been done and the integration tests have not yet been executed against a live database.** Treat this as a careful first review, not a certification. File paths below are inside `api/_lib/` unless they start with `scripts/` or `vercel.json`.

### Controls in place
| Area | What is done | Where |
|---|---|---|
| Passwords | bcrypt (cost 12), min 8 chars with a letter and a number, 72-byte limit enforced; hashes never returned (`select: false`, stripped in `toJSON`) | `utils/password.js`, `models/User.js` |
| Sessions | Signed JWT in an `httpOnly` cookie, `Secure` in production. Customer 7 days (`SameSite=Lax`), admin 8 hours (`SameSite=Strict`, sent only to `/api/admin`). Separate cookie **and** token audience per realm | `utils/session.js` |
| Session revocation | Roles and `isActive` are re-read from the database on every request (disable/demote is immediate); a password change invalidates all older tokens | `middleware/auth.js` |
| Authorization | Server-side guards on every protected route (inventory below). Admin routes are mounted behind one `requireAdmin`. Customer data is always filtered by the logged-in user's id; other people's orders answer 404 | `routes/admin.js`, `routes/orders.js`, ... |
| Admin accounts | Created only by `npm run create-admin` (hidden password prompt). No admin sign-up route (checked automatically). Sign-up ignores any `role` in the request | `scripts/createAdmin.js` |
| Brute force | 10 failed logins / 15 min / IP **plus** a 15-minute lock after 5 failures per account. Counters are stored in MongoDB so they hold across serverless instances; they fail open if the database errors | `middleware/rateLimits.js`, `utils/authenticate.js` |
| Other abuse limits | Shared limits on register, contact (+ honeypot), orders, reviews, cancellations; general soft limit on the API; 100 KB JSON body limit; 4 MB upload limit | `middleware/rateLimits.js` |
| Input validation | Every body, query and path parameter is validated with Zod before use; unknown fields are dropped; ids and tracking numbers are pattern-checked | `schemas/*` |
| NoSQL injection | Operator keys (`$...`, `a.b`) are stripped from input; search text is escaped before it becomes a regex; no query is built from raw request data (scanned) | `middleware/sanitize.js` |
| Mass assignment | Writes use only validated fields (no `isDemo`, `soldCount`, `role`, ratings, etc. from the client) | `schemas/*`, routes |
| CSRF | `SameSite` cookies plus a server check that state-changing requests come from an allowed origin | `middleware/originGuard.js` |
| CORS | Allow-list from `APP_URL`; credentials only for those origins | `app.js` |
| Headers | Helmet defaults on the API; a strict Content-Security-Policy on HTML pages (own scripts only, https images, Meta Pixel host only, no plugins); `nosniff`, referrer and permissions policies on static files | `seo/meta.js`, `vercel.json` |
| Price integrity | The browser sends ids and quantities only; prices, discounts, delivery fee and totals are recomputed from the database; stock is deducted atomically (cannot oversell); duplicate checkout submissions return the same order | `services/orders.js` |
| File uploads | Admin only, type decided from the file's bytes (JPEG/PNG/WebP; SVG refused), random file names, size and rate limited; Cloudinary secret stays on the server | `services/imageStorage.js` |
| Output safety | No raw HTML insertion anywhere in the browser code (scanned); server-generated HTML and JSON-LD are escaped | `seo/meta.js` |
| Privacy | Customers never receive internal notes, cost prices, other users' data or idempotency keys; reviews show first names only; the Meta Pixel receives no personal data and only loads after consent | various |
| Secrets | Server-only environment variables, validated at startup (production refuses placeholders and missing values), never logged (scanned), never in the browser bundle (scanned), `.env` ignored by git | `config/validate.js` |
| Redirects | Redirect targets come from validated slugs or normalized paths; paths containing backslashes are refused | `seo/router.js` |

### Who can do what (and how it is tested)
| | Anonymous | Customer | Admin |
|---|---|---|---|
| Browse catalog, search, quote a cart | yes | yes | yes |
| Register / log in | yes | n/a | n/a |
| Place and see own orders, wishlist, profile, reviews | no (401) | own data only | no: admin accounts cannot use customer routes |
| Any `/api/admin/*` route | no (401) | no (401) | yes |
| Disable a customer, change settings, move orders along | no | no | yes |

Tests: `auth.test.js` (customer and anonymous blocked from admin APIs, roles separated), `account.test.js` and `orders.test.js` (privacy between customers), `admin.test.js` (every back-office route refuses customers), plus the automatic check in `npm run check`.

`npm run check -- --routes` prints every API route with its access level (public, customer, admin), generated from the code: 62 routes (18 public, 14 customer, 30 admin).

### Findings of the review
Fixed in a later release:
1. **Rate limits did not work across servers.** On Vercel each request can run on a different instance, so in-memory counters would never add up. Sensitive actions now use a shared MongoDB counter.
2. **A misconfigured production `APP_URL` would have silently broken every login and order** (the origin check would answer 403). Startup validation now refuses it, along with placeholder secrets, a missing database URI and a non-https site address.
3. **Paths containing a backslash** could have been echoed into a redirect (a known open-redirect trick); they are now refused.
4. Unique indexes (duplicate orders, phone numbers, SKUs) are what the code relies on; `npm run ensure-indexes` makes sure they exist, and the test suite initialises them first.
5. A stale, unused public environment variable was removed so that nothing is implied to be browser-visible.

Checked and found clean: authorization wiring (automated), no admin sign-up, no queries from raw request data, no HTML-injection sinks, no dynamic code execution, no sensitive data in browser storage, no secrets or sensitive logging.

### Accepted risks and limitations
- **Logout cannot cancel an already-stolen token** until it expires (7 days customer, 8 hours admin); a password change does. Rotating `JWT_SECRET` ends every session at once.
- **No two-factor authentication** and **no password reset** (needs an email/SMS provider). Admin passwords must be long and unique.
- **No CAPTCHA.** Abuse is limited by rate limits, per-account lockout and the contact-form honeypot.
- Registering with an existing phone number says so (usability); this allows checking whether a number has an account, within the sign-up rate limit.
- `GET /api/health/db` is public and reveals only that the database answers.
- The CSP allows inline styles (needed by the UI framework). Scripts are restricted to the site itself and the Meta Pixel host.
- Admin accounts can only be disabled in the database (customers can be disabled in the admin screen); every admin has full rights.
- Customers' phone numbers and addresses are visible to every admin by design; keep the number of admins small.
- Cloudinary image URLs are public.
- Dependencies were not audited here (no network). CI runs `npm audit`, and Dependabot is configured.

### If something goes wrong
- **Suspected leak of a secret:** rotate it (Vercel setting, Atlas password, Cloudinary key). Changing `JWT_SECRET` signs everyone out.
- **Suspicious admin activity:** disable that account in the database (`isActive: false`), rotate `JWT_SECRET`, review recent orders and status history (every change records who made it).
- **Abusive customer:** disable the account in Admin > Customers.

## 7. Known limitations

### Not verified yet (the most important list)

- The integration tests, the production build, ESLint and the running site have **not been executed**: the development environment had no internet access. Run `npm install`, `npm run check`, `npm test`, `npm run build` and the manual checklist in the Testing section of README.md, and report anything that fails.
- Real Facebook crawlers, the Meta Pixel, Cloudinary uploads, Atlas transactions and Vercel routing have not been exercised.
- No Lighthouse / Core Web Vitals scores have been measured.
- The `@fontsource/noto-sans-bengali` import paths come from the package's documentation; if the build complains, report it.

### Catalog

- **No product variants** (sizes, flavours): each product has one price and one stock level. This needs a design decision before it can be added, because it changes stock, cart, orders and reports.
- No custom product attributes; ingredients/age/other details are free text the admin types (nothing is invented).
- Removing an image from a product does not delete it from Cloudinary.
- Search is substring matching on name and brand (no typo tolerance or Bengali/English transliteration).
- No stock-change history.

### Ordering and payments

- **Cash on delivery only**, by design for the first release. A payment-provider interface exists; no gateway is implemented.
- "Inside Dhaka" means the Dhaka district only (Gazipur, Narayanganj etc. count as outside).
- Delivery fee has two flat rates; no weight/area-based pricing and no free-delivery threshold.
- Customers can cancel while an order is Pending or Confirmed; there is no returns/refund workflow.
- No order confirmation or status emails/SMS (needs a provider).
- Stock is deducted when an order is placed (not reserved earlier in the cart).

### Accounts

- **No forgot-password / reset** (needs an email or SMS provider).
- No two-factor authentication, no social login, no saved address book, no account deletion.
- Logout cannot cancel an already-stolen token before it expires.

### Admin and reporting

- Reports group by **order date**, so a month's delivered sales can still grow after the month ends.
- No CSV/Excel export (print or screenshot for now).
- Estimated profit needs cost prices and excludes delivery costs.
- Every admin has full rights; admins can only be disabled in the database.
- The admin area is English-only.
- Dashboard is not live-updating.

### SEO, performance, analytics

- Search engines still run JavaScript to see the full page body; the server provides metadata, structured data and a plain-text fallback, not complete server-rendered pages.
- Page HTML is cached 5 minutes at the CDN, so renamed products can show old metadata briefly.
- English pages use `?lang=en` addresses, not `/en/` paths.
- Facebook numbers will be lower than real sales (visitors who decline tracking are not counted); the admin reports are the source of truth.

### Operations

- No automated backups beyond what Atlas provides (enable them), no uptime monitoring or error tracking service yet (DEPLOYMENT.md suggests options).
- No browser end-to-end or automated accessibility tests.
