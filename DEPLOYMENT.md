# Deployment: GitHub + Vercel + MongoDB Atlas

Goal: **one GitHub repository → one Vercel project → one domain (babyfoodgallery.com).**

> This guide was written without being able to deploy from the build environment (no internet access there). Every step uses standard GitHub, Vercel and Atlas features, but expect to adjust small details. If anything differs from what you see on screen, trust the screen and tell me what you saw.

## 0. Before you start (do this on your computer)

```bash
npm install                      # creates package-lock.json: commit it
npm run check                    # 10 consistency checks
npm run test:unit                # 49 unit tests
npm run build                    # must finish without errors
npm start                        # open http://localhost:5000 and click around
```

If `npm run build` fails, stop and send me the error text: everything else depends on it.

## 1. Accounts you need
GitHub, Vercel (sign in with GitHub), MongoDB Atlas, Cloudinary (product images), and access to your domain's DNS (usually your registrar).

## 2. MongoDB Atlas
1. Create a free account at cloud.mongodb.com and an **M0** cluster (pick a region close to your Vercel region; Singapore/Mumbai are closest to Bangladesh).
2. **Database Access → Add New Database User:** username + strong generated password; privilege **Read and write to a specific database** → `babyfoodgallery`. Do not use an admin user.
3. **Network Access → Add IP Address → Allow access from anywhere (`0.0.0.0/0`).** Vercel functions have no fixed IP address, so this is required; your protection is the long database password. (Vercel's paid static-IP options are the alternative.)
4. **Connect → Drivers:** copy the `mongodb+srv://...` string, replace `<password>` with your password (URL-encode special characters) and put the database name before the `?`:
   `mongodb+srv://<db-user>:<db-password>@<cluster-host>/babyfoodgallery?retryWrites=true&w=majority`
5. Enable backups (Atlas → your cluster → Backup) as soon as your plan allows it.

## 3. Cloudinary (product images)
Create a free account; from the dashboard copy **Cloud name, API Key, API Secret**. Uploads are signed on the server, so the secret never reaches the browser.

## 4. Secrets
Generate the session secret (any computer with Node):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Check your production values **before** deploying. Put them in a temporary `.env` and run:

```bash
npm run check-env -- --production
```

Fix every ✘ line and read every `!` line. (Delete or empty the temporary values afterwards if the file is not just for local development.)

## 5. GitHub
1. github.com → **New repository** → name `baby-food-gallery`, **Private**, do not add a README or .gitignore (this project already has them).
2. In the project folder:

```bash
git init
git add .
git status                       # check: no .env file, no node_modules in the list
git commit -m "Baby Food Gallery"
git branch -M main
git remote add origin https://github.com/YOUR-USER/baby-food-gallery.git
git push -u origin main
```

3. The workflow in `.github/workflows/ci.yml` starts running automatically (Actions tab): checks, lint, all tests against a real MongoDB, and the production build. Fix anything red before relying on the deployment. Once `package-lock.json` is committed, change `npm install` to `npm ci` in that workflow.

## 6. Vercel
1. vercel.com → **Add New → Project → Import** your GitHub repository.
2. Settings on the import screen:

| Setting | Value |
|---|---|
| Framework Preset | **Vite** |
| Root Directory | `./` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | default (`npm install`) |
| Node.js version (Project Settings → General) | 22.x |

   (`vercel.json` already contains the build command and output directory.)

3. **Environment Variables** (add for *Production*; add the same for *Preview* if you want preview deployments to work with a database):

| Name | Value |
|---|---|
| `MONGODB_URI` | your Atlas connection string |
| `JWT_SECRET` | the generated secret |
| `SITE_URL` | `https://babyfoodgallery.com` |
| `APP_URL` | `https://babyfoodgallery.com,https://www.babyfoodgallery.com` |
| `IMAGE_STORAGE` | `cloudinary` |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | from Cloudinary |
| `META_PIXEL_ID` | optional |

   Do **not** set `NODE_ENV` (Vercel sets production), `MONGODB_URI_TEST`, or any `RATE_LIMIT_*` variable. None of these values is ever sent to the browser.

4. **Deploy.** You get an address like `baby-food-gallery.vercel.app`. Preview (non-production) deployments are automatically hidden from search engines.

## 7. First-time setup on the live database
On your own computer, temporarily put the **production** `MONGODB_URI` in `.env` (and remove it afterwards if this computer is shared), then:

```bash
npm run ensure-indexes     # unique indexes that prevent duplicate orders, phone numbers, SKUs
npm run create-admin       # your real admin account (long unique password)
npm run check-db           # confirms the connection
```

Do **not** run `npm run seed` against production unless you want sample products. They are flagged as demo and never indexed, but delete them before launch.

Then sign in at `https://YOUR-ADDRESS/admin/login` and add: categories, products with images, delivery fees, contact details and About text (Admin → Settings).

## 8. Custom domain and HTTPS
1. Vercel → your project → **Settings → Domains → Add** `babyfoodgallery.com` and `www.babyfoodgallery.com`.
2. At your registrar's DNS settings add **exactly the records Vercel shows** for each domain (typically an `A` record for the bare domain and a `CNAME` for `www`). Remove conflicting old `A`/`CNAME` records for the same names.
3. Wait for Vercel to show a green "Valid Configuration" (minutes to a few hours). **HTTPS certificates are issued automatically.**
4. Choose one main address (recommended: `babyfoodgallery.com`) and set the other to redirect to it in the Domains screen.
5. Make sure `SITE_URL` and `APP_URL` (step 6.3) match, then **redeploy** (Deployments → latest → Redeploy).

## 9. Verify the live site
| Check | Expected |
|---|---|
| `/` and a refresh on `/shop`, `/product/...`, `/account/orders` | The app loads every time (the API returns the app shell for any page address) |
| `/api/health` and `/api/health/db` | `{ ok: true }` and `{ database: "connected" }` |
| `/robots.txt` | Disallow rules and a `Sitemap:` line (on preview addresses it says `Disallow: /`, which is intended) |
| `/sitemap.xml` | Real products only (demo products are excluded) |
| View source of a product page | Title, canonical, `og:` tags and JSON-LD are in the raw HTML |
| Register, log in, place an order, see it in Admin → Orders | Works; login failing with "forbidden" means `APP_URL` is wrong |
| `/admin/orders` while logged out | Redirects to the admin login; `/api/admin/orders` answers 401 |
| Upload a product image | Works (otherwise check the Cloudinary variables) |

## 10. After launch
1. **Google Search Console:** add the domain property, verify with the DNS TXT record Google gives you, submit `https://babyfoodgallery.com/sitemap.xml`, and use URL Inspection → "Test live URL" on the home page and one product. (Not configured automatically.)
2. **Facebook Sharing Debugger** (developers.facebook.com/tools/debug): test a product link and press "Scrape Again" after any change. With ads: check the Pixel with Meta's Pixel Helper after pressing Accept on the banner.
3. **PageSpeed Insights** on the home page and a product page (mobile); note the scores. None have been measured yet.
4. **Monitoring:** Vercel → Logs (function errors); Atlas → Alerts (connections, storage); a free uptime monitor on `/api/health`.
5. **Delete demo products**, test orders and test accounts.

## 11. Day-to-day
- **Deploy a change:** `git push` to `main`; Vercel builds and publishes automatically. Pull requests get their own preview address.
- **Roll back:** Vercel → Deployments → pick an older good deployment → **Promote to Production** (instant).
- **Rotate the session secret** (signs everyone out): change `JWT_SECRET` in Vercel and redeploy.

## 12. Troubleshooting
| Symptom | Likely cause and fix |
|---|---|
| Build fails | Run `npm run build` locally and read the first error; send it to me |
| Every page returns 503 "client app is not built" | `dist/shell.html` is missing: the build command must be `npm run build` (it runs the postbuild step) |
| Every page is a function error | Environment validation refused to start: Vercel → Logs shows which variable (names only). Run `npm run check-env -- --production` locally |
| Login or checkout says forbidden (403) | `APP_URL` does not include the exact address in the browser (https, with or without `www`) |
| Data features answer 503 | `MONGODB_URI` wrong, or Atlas Network Access does not allow `0.0.0.0/0`, or the database user/password is wrong |
| Product images will not upload | Cloudinary variables missing; `IMAGE_STORAGE` must be `cloudinary` in production |
| Sitemap contains almost nothing | Only real (non-demo), published, active products and categories are listed |
| Share preview shows old text | Press "Scrape Again" in the Facebook debugger; pages are cached up to 5 minutes at the CDN |
| Rate-limit "too many attempts" while testing | Wait for the window (15 minutes for logins) |
