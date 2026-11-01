import { Check, GitCompareArrows, Heart, PackageSearch, ShoppingCart } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Link } from 'react-router-dom';
import { useCompare } from '../context/CompareContext.jsx';
import { useAddToCart, useWishlist } from '../hooks/shop.js';
import { EASE_OUT, SPRING, staggerDelay } from './motion.jsx';
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

/** The cart icon, which briefly becomes a tick once something has been added. */
export function CartIcon({ added, size = 14 }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={added ? 'added' : 'cart'}
        className={`icon-swap ${added ? 'added-mark' : ''}`}
        initial={reduce ? false : { scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.5, opacity: 0, transition: { duration: 0.08 } }}
        transition={SPRING}
      >
        {added ? <Check size={size} aria-hidden="true" /> : <ShoppingCart size={size} aria-hidden="true" />}
      </motion.span>
    </AnimatePresence>
  );
}

export function WishlistButton({ product, withLabel = false }) {
  const reduce = useReducedMotion();
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
      <motion.span
        key={saved ? 'saved' : 'not-saved'}
        className="icon-swap"
        initial={reduce || !saved ? false : { scale: 0.4 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 14 }}
      >
        <Heart size={16} className={saved ? 'heart-on' : ''} aria-hidden="true" />
      </motion.span>
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
        {product.ratingCount > 0 ? (
          <Stars value={product.ratingAvg} count={product.ratingCount} />
        ) : (
          <span className="stars-none">No reviews yet</span>
        )}
        <Price price={product.price} mrp={product.mrp} />
        <div className="bin-foot">
          <StockNote product={product} />
          <button
            type="button"
            className="btn btn-small btn-soft"
            disabled={soldOut || cart.pendingId === product._id}
            aria-label={`Add ${product.name} to cart`}
            onClick={() => cart.add(product)}
          >
            <CartIcon added={cart.addedId === product._id} /> Add
          </button>
        </div>
      </div>
    </article>
  );
}

export function ProductBin({ products, list = false }) {
  const reduce = useReducedMotion();
  return (
    <div className={`bin ${list ? 'bin-list' : ''}`}>
      {/* Cards fade up in a wave, and slide to their new places when filters or sorting change. */}
      <AnimatePresence mode="popLayout">
        {products.map((product, index) => (
          <motion.div
            key={product._id}
            className="reveal bin-slot"
            layout="position"
            initial={reduce ? false : { opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            viewport={{ once: true, margin: '0px 0px -40px 0px' }}
            transition={{
              duration: 0.45,
              ease: EASE_OUT,
              delay: staggerDelay(index),
              layout: { duration: 0.3, ease: EASE_OUT },
            }}
          >
            <ProductCell product={product} />
          </motion.div>
        ))}
      </AnimatePresence>
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
