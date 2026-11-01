import { NavLink, Outlet, Route, Routes } from 'react-router-dom';
import { NotFound } from '../NotFound.jsx';
import Dashboard from './Dashboard.jsx';
import { AdminOrderDetail, AdminOrders } from './Orders.jsx';
import { AdminReviews, AdminUsers } from './People.jsx';
import { AdminCategories, AdminInventory, AdminProducts } from './Products.jsx';
import { AdminCoupons, AdminKits } from './Promotions.jsx';

const LINKS = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/orders', label: 'Orders' },
  { to: '/admin/products', label: 'Products' },
  { to: '/admin/inventory', label: 'Inventory' },
  { to: '/admin/categories', label: 'Categories' },
  { to: '/admin/kits', label: 'Project Kits' },
  { to: '/admin/coupons', label: 'Coupons' },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/reviews', label: 'Reviews' },
];

function AdminLayout() {
  return (
    <div className="container page side-layout">
      <nav className="side-nav" aria-label="Admin">
        {LINKS.map((link) => (
          <NavLink key={link.to} to={link.to} end={link.end}>{link.label}</NavLink>
        ))}
      </nav>
      <div className="side-main">
        <Outlet />
      </div>
    </div>
  );
}

export default function AdminRoutes() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="orders/:id" element={<AdminOrderDetail />} />
        <Route path="products" element={<AdminProducts />} />
        <Route path="inventory" element={<AdminInventory />} />
        <Route path="categories" element={<AdminCategories />} />
        <Route path="kits" element={<AdminKits />} />
        <Route path="coupons" element={<AdminCoupons />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="reviews" element={<AdminReviews />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
