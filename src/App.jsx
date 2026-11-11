import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import Home from './pages/Home.jsx';
import RequireAuth from './components/RequireAuth.jsx';
import ConsentBanner from './components/ConsentBanner.jsx';
import OfflineBanner from './components/OfflineBanner.jsx';
import RouteFocus from './components/RouteFocus.jsx';
import { useLang } from './context/LanguageContext.jsx';

const Shop = lazy(() => import('./pages/Shop.jsx'));
const GroupPage = lazy(() => import('./pages/GroupPage.jsx'));
const CategoryPage = lazy(() => import('./pages/CategoryPage.jsx'));
const ProductPage = lazy(() => import('./pages/ProductPage.jsx'));
const Wishlist = lazy(() => import('./pages/Wishlist.jsx'));
const Cart = lazy(() => import('./pages/Cart.jsx'));
const Checkout = lazy(() => import('./pages/Checkout.jsx'));
const About = lazy(() => import('./pages/About.jsx'));
const Contact = lazy(() => import('./pages/Contact.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));
const Login = lazy(() => import('./pages/Login.jsx'));
const Register = lazy(() => import('./pages/Register.jsx'));
const AccountLayout = lazy(() => import('./pages/account/AccountLayout.jsx'));
const Orders = lazy(() => import('./pages/account/Orders.jsx'));
const OrderDetail = lazy(() => import('./pages/account/OrderDetail.jsx'));
const Profile = lazy(() => import('./pages/account/Profile.jsx'));
const MyReviews = lazy(() => import('./pages/account/MyReviews.jsx'));
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin.jsx'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout.jsx'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard.jsx'));
const AdminProducts = lazy(() => import('./pages/admin/AdminProducts.jsx'));
const AdminProductForm = lazy(() => import('./pages/admin/AdminProductForm.jsx'));
const AdminCategories = lazy(() => import('./pages/admin/AdminCategories.jsx'));
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders.jsx'));
const AdminOrderDetail = lazy(() => import('./pages/admin/AdminOrderDetail.jsx'));
const AdminOrderPrint = lazy(() => import('./pages/admin/AdminOrderPrint.jsx'));
const AdminCustomers = lazy(() => import('./pages/admin/AdminCustomers.jsx'));
const AdminCustomerDetail = lazy(() => import('./pages/admin/AdminCustomerDetail.jsx'));
const AdminReviews = lazy(() => import('./pages/admin/AdminReviews.jsx'));
const AdminReports = lazy(() => import('./pages/admin/AdminReports.jsx'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings.jsx'));

// Old confirmation links keep working.
function OrderRedirect() {
  const { trackingId } = useParams();
  return <Navigate to={`/account/orders/${trackingId}`} replace />;
}

export default function App() {
  const { t } = useLang();
  const { pathname } = useLocation();

  if (pathname.startsWith('/admin')) {
    return (
      <Suspense fallback={<div className="p-10 text-center" role="status">…</div>}>
        <Routes>
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route element={<AdminLayout />}>
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/products" element={<AdminProducts />} />
            <Route path="/admin/products/new" element={<AdminProductForm />} />
            <Route path="/admin/products/:id" element={<AdminProductForm />} />
            <Route path="/admin/categories" element={<AdminCategories />} />
            <Route path="/admin/orders" element={<AdminOrders />} />
            <Route path="/admin/orders/:trackingId" element={<AdminOrderDetail />} />
            <Route path="/admin/orders/:trackingId/print" element={<AdminOrderPrint />} />
            <Route path="/admin/customers" element={<AdminCustomers />} />
            <Route path="/admin/customers/:id" element={<AdminCustomerDetail />} />
            <Route path="/admin/reviews" element={<AdminReviews />} />
            <Route path="/admin/reports" element={<AdminReports />} />
            <Route path="/admin/settings" element={<AdminSettings />} />
          </Route>
          <Route path="/admin/*" element={<Navigate to="/admin/dashboard" replace />} />
        </Routes>
      </Suspense>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-xl focus:bg-white focus:px-4 focus:py-3 focus:font-semibold focus:text-sky-700 focus:shadow-frame">{t('a11y.skip')}</a>
      <OfflineBanner />
      <RouteFocus />
      <Header />
      <main id="main" tabIndex={-1} className="flex-1">
        <Suspense fallback={<div className="container-x py-20 text-center text-ink-soft" role="status">…</div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/shop" element={<Shop />} />
            <Route path="/baby-food" element={<GroupPage group="baby" />} />
            <Route path="/adult-food" element={<GroupPage group="adult" />} />
            <Route path="/category/:slug" element={<CategoryPage />} />
            <Route path="/product/:slug" element={<ProductPage />} />
            <Route path="/wishlist" element={<RequireAuth><Wishlist /></RequireAuth>} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={<RequireAuth><Checkout /></RequireAuth>} />
            <Route path="/order/:trackingId" element={<OrderRedirect />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/account" element={<RequireAuth><AccountLayout /></RequireAuth>}>
              <Route index element={<Navigate to="orders" replace />} />
              <Route path="orders" element={<Orders />} />
              <Route path="orders/:trackingId" element={<OrderDetail />} />
              <Route path="profile" element={<Profile />} />
              <Route path="reviews" element={<MyReviews />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
      <ConsentBanner />
    </div>
  );
}
