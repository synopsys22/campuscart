import { Component, lazy, Suspense } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { StoreLayout } from './components/Layout.jsx';
import { Spinner } from './components/ui.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { Forbidden, NotFound } from './pages/NotFound.jsx';
import {
  AccountLayout,
  Addresses,
  ChangePassword,
  MyReviews,
  MySetups,
  Profile,
} from './pages/shop/Account.jsx';
import Cart from './pages/shop/Cart.jsx';
import Checkout from './pages/shop/Checkout.jsx';
import { MyOrders, OrderDetail, OrderSuccess } from './pages/shop/Orders.jsx';
import Wallet from './pages/shop/Wallet.jsx';
import Wishlist from './pages/shop/Wishlist.jsx';
import { Login, Register } from './pages/store/Auth.jsx';
import Catalog from './pages/store/Catalog.jsx';
import Categories from './pages/store/Categories.jsx';
import Compare from './pages/store/Compare.jsx';
import Home from './pages/store/Home.jsx';
import { KitDetail, KitList } from './pages/store/Kits.jsx';
import PayApprove from './pages/store/PayApprove.jsx';
import ProductDetail from './pages/store/ProductDetail.jsx';
import SetupBuilder from './pages/store/SetupBuilder.jsx';
import Track from './pages/store/Track.jsx';

// The admin area, with its charts, loads only when an admin opens it.
const AdminRoutes = lazy(() => import('./pages/admin/AdminRoutes.jsx'));

export class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error(error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="crash">
        <h1>This page stopped working</h1>
        <p>Reload to try again. Your cart and orders are safe.</p>
        <button type="button" className="btn btn-primary" onClick={() => window.location.assign('/')}>
          Reload CampusCart
        </button>
      </div>
    );
  }
}

function RequireLogin() {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}

function RequireAdmin() {
  const { user, isAdmin, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (!isAdmin) return <Forbidden />;
  return <Outlet />;
}

export function App() {
  return (
    <Routes>
      {/* Opened on the phone that scanned a UPI QR code, so it has no store header or login. */}
      <Route path="pay/:id" element={<PayApprove />} />
      <Route element={<StoreLayout />}>
        <Route index element={<Home />} />
        <Route path="products" element={<Catalog />} />
        <Route path="products/:slug" element={<ProductDetail />} />
        <Route path="categories" element={<Categories />} />
        <Route path="kits" element={<KitList />} />
        <Route path="kits/:slug" element={<KitDetail />} />
        <Route path="setup-builder" element={<SetupBuilder />} />
        <Route path="compare" element={<Compare />} />
        <Route path="track" element={<Track />} />
        <Route path="track/:trackingNumber" element={<Track />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />

        <Route element={<RequireLogin />}>
          <Route path="cart" element={<Cart />} />
          <Route path="checkout" element={<Checkout />} />
          <Route path="wishlist" element={<Wishlist />} />
          <Route path="order-success/:id" element={<OrderSuccess />} />
          <Route path="account" element={<AccountLayout />}>
            <Route index element={<Profile />} />
            <Route path="orders" element={<MyOrders />} />
            <Route path="orders/:id" element={<OrderDetail />} />
            <Route path="wallet" element={<Wallet />} />
            <Route path="addresses" element={<Addresses />} />
            <Route path="reviews" element={<MyReviews />} />
            <Route path="setups" element={<MySetups />} />
            <Route path="password" element={<ChangePassword />} />
          </Route>
        </Route>

        <Route element={<RequireAdmin />}>
          <Route
            path="admin/*"
            element={
              <Suspense fallback={<Spinner label="Loading the dashboard" />}>
                <AdminRoutes />
              </Suspense>
            }
          />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
