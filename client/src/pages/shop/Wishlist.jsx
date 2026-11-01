import { Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ProductBin } from '../../components/product.jsx';
import { EmptyState, ErrorState, PathCrumbs, SkeletonGrid } from '../../components/ui.jsx';
import { usePageTitle, useWishlist } from '../../hooks/shop.js';

export default function Wishlist() {
  usePageTitle('Wishlist');
  const { items, isLoading, isError, error, refetch } = useWishlist();
  return (
    <div className="container page">
      <PathCrumbs parts={[{ label: 'wishlist' }]} />
      <h1 className="page-title">Wishlist</h1>
      {isLoading && <SkeletonGrid count={4} />}
      {isError && <ErrorState error={error} onRetry={refetch} />}
      {!isLoading && !isError && items.length === 0 && (
        <EmptyState
          icon={Heart}
          title="Nothing saved yet"
          action={<Link to="/products" className="btn btn-primary">Browse products</Link>}
        >
          Use the heart on any product to keep it here for later.
        </EmptyState>
      )}
      {items.length > 0 && <ProductBin products={items} />}
    </div>
  );
}
