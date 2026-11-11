// DEMO DATA ONLY. Sample prices (whole BDT) and stock; not market prices.
// No ingredients, nutrition, age or health claims are included.
export const categories = [
  { slug: 'baby-food', group: 'baby', bn: 'বেবি ফুড', en: 'Baby Food' },
  { slug: 'baby-milk-formula', group: 'baby', bn: 'বেবি মিল্ক ও ফর্মুলা', en: 'Baby Milk and Formula' },
  { slug: 'baby-cereals', group: 'baby', bn: 'বেবি সিরিয়াল', en: 'Baby Cereals' },
  { slug: 'baby-biscuits-snacks', group: 'baby', bn: 'বেবি বিস্কুট ও স্ন্যাক্স', en: 'Baby Biscuits and Snacks' },
  { slug: 'adult-food-nutrition', group: 'adult', bn: 'বড়দের খাবার ও পুষ্টি', en: 'Adult Food and Nutrition' },
  { slug: 'sugar-free', group: 'adult', bn: 'সুগার-ফ্রি পণ্য', en: 'Sugar-Free Products' },
  { slug: 'coffee-beverages', group: 'adult', bn: 'কফি ও পানীয়', en: 'Coffee and Beverages' },
  { slug: 'other', group: 'other', bn: 'অন্যান্য পণ্য', en: 'Other Products' },
];

// [bn, en, brand, categorySlug, price, salePrice, stock, featured]
export const products = [
  ['সেরেল্যাক', 'Cerelac', 'Cerelac', 'baby-cereals', 520, 480, 40, true],
  ['ন্যান', 'NAN', 'NAN', 'baby-milk-formula', 1450, 1390, 25, true],
  ['নিডো', 'NIDO', 'NIDO', 'baby-milk-formula', 980, null, 6, true],
  ['ল্যাক্টোজেন', 'Lactogen', 'Lactogen', 'baby-milk-formula', 890, 850, 18, true],
  ['অ্যাপ্টামিল', 'Aptamil', 'Aptamil', 'baby-milk-formula', 1850, null, 0, true],
  ['পেডিয়াশিওর', 'PediaSure', 'PediaSure', 'adult-food-nutrition', 1650, 1590, 12, true],
  ['হরলিক্স', 'Horlicks', 'Horlicks', 'adult-food-nutrition', 450, 420, 60, false],
  ['জিরো-ক্যাল সুগার সাবস্টিটিউট', 'Zero-Cal sugar substitute', 'Zero-Cal', 'sugar-free', 320, null, 35, false],
  ['বেবি বিস্কুট', 'Baby biscuits', 'Demo brand', 'baby-biscuits-snacks', 140, 120, 80, false],
  ['কফি', 'Coffee', 'Demo brand', 'coffee-beverages', 380, 350, 22, false],
];
