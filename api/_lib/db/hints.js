// Plain-language guidance derived from a database summary. Pure function: unit-tested without a database.
export function databaseHints(s) {
  const out = [];
  if (s.categories === 0 || s.products === 0) {
    out.push('The database has no catalog yet (a working connection does not mean it has data). Load the sample categories and products with:  npm run seed   (safe: it only adds what is missing, never overwrites or deletes)');
  } else if (s.published === 0) {
    out.push('Products exist but none is published and active, so the shop shows nothing. Publish them in Admin > Products, or run:  npm run seed');
  }
  if (s.admins === 0) out.push('No admin account exists yet. Create one with:  npm run create-admin');
  if (s.categories > 0 && s.categoriesWithoutSection > 0) {
    out.push(`${s.categoriesWithoutSection} categor${s.categoriesWithoutSection === 1 ? 'y has' : 'ies have'} no "Shop section", so they will not appear on the Baby Food / Adult Food pages. Set it in Admin > Categories (or run:  npm run seed  to fill it in for the sample categories).`);
  }
  if (s.products > 0 && s.demo === s.products) out.push('Every product is sample (demo) data. That is fine for trying the site; replace it with real products before launch.');
  return out;
}
