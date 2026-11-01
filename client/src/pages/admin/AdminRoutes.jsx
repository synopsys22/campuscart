import {
  Boxes,
  LayoutDashboard,
  MessageSquare,
  Package,
  PackagePlus,
  ReceiptText,
  ShieldCheck,
  Tags,
  TicketPercent,
  Users,
} from 'lucide-react';
import { Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { RoleBanner, SideNav } from '../../components/Layout.jsx';
import { Enter } from '../../components/motion.jsx';
import { NotFound } from '../NotFound.jsx';
import Dashboard from './Dashboard.jsx';
import { AdminOrderDetail, AdminOrders } from './Orders.jsx';
import { AdminReviews, AdminUsers } from './People.jsx';
import { AdminCategories, AdminInventory, AdminProducts } from './Products.jsx';
import { AdminCoupons, AdminKits } from './Promotions.jsx';

const LINKS = [
  { to: '/admin', label: 'Dashboard', end: true, icon: LayoutDashboard, hint: 'Sales and stock across the whole store.' },
  { to: '/admin/orders', label: 'Orders', icon: ReceiptText, hint: "Every customer's orders. Move each one forward, or cancel it before it ships." },
  { to: '/admin/products', label: 'Products', icon: Package, hint: 'Add, edit and hide what the store sells.' },
  { to: '/admin/inventory', label: 'Inventory', icon: Boxes, hint: 'Update stock levels and act on low-stock alerts.' },
  { to: '/admin/categories', label: 'Categories', icon: Tags, hint: 'Add and edit the categories products sit in.' },
  { to: '/admin/kits', label: 'Project Kits', icon: PackagePlus, hint: 'Create and edit Project Kits.' },
  { to: '/admin/coupons', label: 'Coupons', icon: TicketPercent, hint: 'Create and edit discount codes.' },
  { to: '/admin/users', label: 'Users', icon: Users, hint: 'Search accounts, change roles, and activate or deactivate them.' },
  { to: '/admin/reviews', label: 'Reviews', icon: MessageSquare, hint: 'Remove reviews when needed.' },
];

function AdminLayout() {
  const { pathname } = useLocation();
  return (
    <div className="container page side-layout admin-area">
      <SideNav
        label="Admin"
        links={LINKS}
        heading={
          <>
            <span className="side-avatar"><ShieldCheck size={18} aria-hidden="true" /></span>
            <span>
              <strong>Admin panel</strong>
              <span className="small muted">Store management</span>
            </span>
          </>
        }
      />
      <div className="side-main">
        <Enter key={pathname}>
          <RoleBanner links={LINKS} />
          <Outlet />
        </Enter>
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
