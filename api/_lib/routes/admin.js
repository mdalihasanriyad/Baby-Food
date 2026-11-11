import { Router } from 'express';
import adminAuth from './adminAuth.js';
import { requireAdmin } from '../middleware/auth.js';
import { noStore } from '../middleware/cache.js';
import products from './admin/products.js';
import categories from './admin/categories.js';
import uploads from './admin/uploads.js';
import orders from './admin/orders.js';
import dashboard from './admin/dashboard.js';
import reports from './admin/reports.js';
import customers from './admin/customers.js';
import reviews from './admin/reviews.js';
import settings from './admin/settings.js';

const router = Router();
router.use(noStore);

router.use('/auth', adminAuth); // only the login/logout/me routes are reachable without an admin session

// Everything mounted below this line requires a valid admin session. Future admin routes
// (products, orders, reports...) are added here and are protected automatically.
router.use(requireAdmin);
router.use('/products', products);
router.use('/categories', categories);
router.use('/uploads', uploads);
router.use('/orders', orders);
router.use('/dashboard', dashboard);
router.use('/reports', reports);
router.use('/customers', customers);
router.use('/reviews', reviews);
router.use('/settings', settings);
router.get('/ping', (req, res) => res.json({ ok: true, admin: req.user.name }));

export default router;
