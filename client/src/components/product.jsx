import { GitCompareArrows, Heart, PackageSearch, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCompare } from '../context/CompareContext.jsx';
import { useAddToCart, useWishlist } from '../hooks/shop.js';
import { EmptyState, Price, Stars } from './ui.jsx';

export function ProductImage({ src, alt, className = '' }) {
  if (!src) return <div className={`product-image product-image-empty ${className}`} role="img" aria-label={alt} />;
  return <img className={`product-image ${className}`} src={src} alt={alt} loading="lazy" />;
}

export function StockNote({ product }) {
  if (product.isActive === false) return <span className="stock stock-out">No longer available</span>;
  if (product.stock === 0) return <span className="stock stock-out">Out of stock</span>;
  if (product.stock <= (product.lowStockThreshold ?? 5)) {
    return <span className="stock stock-low">Only {product.stock} left</span>;
  }
  return <span className="stock stock-in">In stock</span>;
}

export function WishlistButton({ product, withLabel = false }) {
  const wishlist = useWishlist();
  const saved = wishlist.has(product._id);
  const label = saved ? 'Remove from wishlist' : 'Save to wishlist';
  return (
    <button
      type="button"
      className={withLabel ? 'btn btn-quiet' : 'icon-btn'}
      aria-label={withLabel ? undefined : `${label}: ${product.name}`}
      aria-pressed={saved}
      onClick={() => wishlist.toggle(product)}
    >
      <Heart size={16} className={saved ? 'heart-on' : ''} aria-hidden="true" />
      {withLabel && label}
    </button>
  );
}

export function CompareButton({ product, withLabel = false }) {
  const compare = useCompare();
  const active = compare.has(product._id);
  const label = active ? 'Remove from compare' : 'Add to compare';
  return (
    <button
      type="button"
      className={withLabel ? 'btn btn-quiet' : `icon-btn ${active ? 'icon-btn-active' : ''}`}
      aria-label={withLabel ? undefined : `${label}: ${product.name}`}
      aria-pressed={active}
      onClick={() => compare.toggle(product)}
    >
      <GitCompareArrows size={16} aria-hidden="true" />
      {withLabel && label}
    </button>
  );
}

export function ProductCell({ product }) {
  const cart = useAddToCart();
  const soldOut = product.stock === 0;
  return (
    <article className="bin-cell">
      <div className="bin-media">
        <Link to={`/products/${product.slug}`} tabIndex={-1} aria-hidden="true">
          <ProductImage src={product.images?.[0]} alt="" />
        </Link>
        <div className="bin-tools">
          <WishlistButton product={product} />
          <CompareButton product={product} />
        </div>
      </div>
      <div className="bin-body">
        <p className="bin-brand small muted">{product.brand}</p>
        <h3 className="bin-name">
          <Link to={`/products/${product.slug}`}>{product.name}</Link>
        </h3>
        {product.ratingCount > 0 && <Stars value={product.ratingAvg} count={product.ratingCount} />}
        <Price price={product.price} mrp={product.mrp} />
        <div className="bin-foot">
          <StockNote product={product} />
          <button
            type="button"
            className="btn btn-small"
            disabled={soldOut || cart.pendingId === product._id}
            aria-label={`Add ${product.name} to cart`}
            onClick={() => cart.add(product)}
          >
            <ShoppingCart size={14} aria-hidden="true" /> Add
          </button>
        </div>
      </div>
    </article>
  );
}

export function ProductBin({ products, list = false }) {
  return (
    <div className={`bin ${list ? 'bin-list' : ''}`}>
      {products.map((product) => (
        <ProductCell key={product._id} product={product} />
      ))}
    </div>
  );
}

export function NoProducts({ action }) {
  return (
    <EmptyState icon={PackageSearch} title="No products match" action={action}>
      Try a different search, or remove a filter.
    </EmptyState>
  );
}
