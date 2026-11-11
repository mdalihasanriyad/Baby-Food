import mongoose from 'mongoose';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import { PUBLIC_FILTER } from '../services/catalog.js';

// Read-only counts used by `npm run dev` and `npm run check-db` to show whether the database really holds data.
export async function databaseSummary() {
  const [categories, products, published, demo, customers, admins, categoriesWithoutSection] = await Promise.all([
    Category.countDocuments(), Product.countDocuments(), Product.countDocuments(PUBLIC_FILTER), Product.countDocuments({ isDemo: true }),
    User.countDocuments({ role: 'customer' }), User.countDocuments({ role: 'admin' }), Category.countDocuments({ group: { $exists: false } }),
  ]);
  return { name: mongoose.connection.name, categories, products, published, demo, customers, admins, categoriesWithoutSection };
}
