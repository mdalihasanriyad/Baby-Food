import Category from '../api/_lib/models/Category.js';
import Product from '../api/_lib/models/Product.js';
import StoreSettings from '../api/_lib/models/StoreSettings.js';
import { connectDB, disconnectDB } from '../api/_lib/db/connect.js';
import { isProd } from '../api/_lib/config/env.js';
import { categories, products } from './seedData.js';

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

if (isProd && !process.argv.includes('--allow-production')) {
  console.error('Refusing to seed demo data with NODE_ENV=production. Pass --allow-production if you really mean it.');
  process.exit(1);
}

try {
  await connectDB();

  // $setOnInsert => safe to re-run; never overwrites edits made later in the admin panel.
  const catIds = {};
  for (const [i, c] of categories.entries()) {
    const doc = await Category.findOneAndUpdate(
      { slug: c.slug },
      { $setOnInsert: { slug: c.slug, name: { bn: c.bn, en: c.en }, group: c.group, isVisible: true, sortOrder: i } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    catIds[c.slug] = doc._id;
    // Categories seeded before Phase 5 have no group yet: fill it in, but never override an admin's choice.
    await Category.updateOne({ slug: c.slug, group: { $exists: false } }, { $set: { group: c.group } });
  }

  let created = 0;
  for (const [i, [bn, en, brand, cat, price, salePrice, stock, featured]] of products.entries()) {
    const slug = slugify(en);
    const res = await Product.updateOne(
      { slug },
      {
        $setOnInsert: {
          slug, sku: `BFG-DEMO-${String(i + 1).padStart(3, '0')}`, name: { bn, en }, brand, category: catIds[cat],
          description: { bn: 'ডেমো পণ্য — বিবরণ অ্যাডমিন যোগ করবেন।', en: 'Demo product — description to be added by an admin.' },
          price, salePrice, effectivePrice: salePrice ?? price, stock,
          isPublished: true, isFeatured: featured, isDemo: true,
        },
      },
      { upsert: true }
    );
    if (res.upsertedCount) created += 1;
  }

  await StoreSettings.getSingleton();
  console.log(`Seed complete: ${categories.length} categories ensured, ${created} new demo products, settings ready.`);
} catch (err) {
  console.error(`Seed failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await disconnectDB();
}
