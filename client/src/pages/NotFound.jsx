import { Unplug } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui.jsx';
import { usePageTitle } from '../hooks/shop.js';

export function NotFound({ message = "That page doesn't exist. The link may be out of date." }) {
  usePageTitle('Page not found');
  return (
    <div className="container page">
      <EmptyState
        icon={Unplug}
        title="Nothing connected here"
        action={<Link to="/products" className="btn btn-primary">Browse the store</Link>}
      >
        {message}
      </EmptyState>
    </div>
  );
}

export function Forbidden() {
  usePageTitle('Admin only');
  return (
    <div className="container page">
      <EmptyState
        icon={Unplug}
        title="This page is for admins"
        action={<Link to="/" className="btn btn-primary">Go to the store</Link>}
      >
        Your account doesn't have access to the admin dashboard.
      </EmptyState>
    </div>
  );
}
