import { useQuery } from '@tanstack/react-query';
import { ShoppingCart, Tag, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { cartApi, couponApi } from '../../api/index.js';
import { AnimatedNumber, useSmoothList } from '../../components/motion.jsx';
import { ProductImage } from '../../components/product.jsx';
import { EmptyState, ErrorState, PathCrumbs, SkeletonRows, Stepper } from '../../components/ui.jsx';
import { useCart, useCartMutation, usePageTitle } from '../../hooks/shop.js';
import { couponSummary, formatINR } from '../../utils/format.js';

export function OrderSummaryRows({ pricing, deliveryLabel = 'Shipping' }) {
  const rowsRef = useSmoothList();
  return (
    <dl className="summary-rows" ref={rowsRef}>
      <div>
        <dt>Subtotal ({pricing.itemCount} item{pricing.itemCount === 1 ? '' : 's'})</dt>
        <dd>{formatINR(pricing.subtotal)}</dd>
      </div>
      {pricing.discount > 0 && (
        <div>
          <dt>Coupon discount</dt>
          <dd className="summary-good">-{formatINR(pricing.discount)}</dd>
        </div>
      )}
      <div>
        <dt>{deliveryLabel}</dt>
        <dd>{pricing.shippingFee === 0 ? 'Free' : formatINR(pricing.shippingFee)}</dd>
      </div>
      <div className="summary-total">
        <dt>Total</dt>
        <dd data-testid="order-total"><AnimatedNumber value={pricing.total} format={formatINR} /></dd>
      </div>
    </dl>
  );
}

function CouponBox({ cart }) {
  const [code, setCode] = useState('');
  const [showOffers, setShowOffers] = useState(false);
  const offers = useQuery({ queryKey: ['coupons-available'], queryFn: couponApi.available, enabled: showOffers });

  const removeCoupon = useCartMutation(cartApi.removeCoupon, { success: 'Coupon removed' });
  // Errors appear beside the box rather than as a toast, because the student needs to act on them.
  const applied = useCartMutation(cartApi.applyCoupon, {
    quietErrors: true,
    success: (value) => `Applied ${value.toUpperCase()}`,
    onSuccess: () => {
      setCode('');
      setShowOffers(false);
    },
  });

  return (
    <div className="coupon">
      {cart.couponCode ? (
        <div className={`coupon-applied ${cart.couponError ? 'coupon-invalid' : ''}`}>
          <span className="row">
            <Tag size={15} aria-hidden="true" />
            <strong className="mono">{cart.couponCode}</strong>
          </span>
          <button type="button" className="icon-btn" aria-label="Remove coupon" onClick={() => removeCoupon.mutate()}>
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <form
          className="coupon-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (code.trim()) applied.mutate(code.trim());
          }}
        >
          <label className="visually-hidden" htmlFor="coupon-code">Coupon code</label>
          <input id="coupon-code" className="input mono" placeholder="Coupon code" value={code} onChange={(e) => setCode(e.target.value)} />
          <button type="submit" className="btn" disabled={applied.isPending}>Apply</button>
        </form>
      )}
      {cart.couponError && <p className="field-error" role="alert">{cart.couponError}</p>}
      {applied.error && !cart.couponCode && <p className="field-error" role="alert">{applied.error.message}</p>}
      {!cart.couponCode && (
        <button type="button" className="text-link small" aria-expanded={showOffers} onClick={() => setShowOffers(!showOffers)}>
          {showOffers ? 'Hide available coupons' : 'See available coupons'}
        </button>
      )}
      {showOffers && !cart.couponCode && (
        <ul className="offers">
          {offers.data?.map((coupon) => (
            <li key={coupon._id}>
              <div>
                <strong className="mono">{coupon.code}</strong>
                <p className="small muted">{coupon.description || couponSummary(coupon)}</p>
              </div>
              <button type="button" className="btn btn-small" onClick={() => applied.mutate(coupon.code)}>Apply</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CartLine({ item }) {
  const { product, qty } = item;
  const setQty = useCartMutation((value) => cartApi.setQty(product._id, value));
  const remove = useCartMutation(() => cartApi.remove(product._id), { success: `Removed ${product.name}` });
  return (
    <li className="line">
      <ProductImage src={product.images?.[0]} alt="" className="line-image" />
      <div className="line-info">
        <Link to={`/products/${product.slug}`} className="line-name">{product.name}</Link>
        <span className="small muted">{formatINR(product.price)} each</span>
        {item.issue && <span className="small stock-low" role="alert">{item.issue}</span>}
      </div>
      <Stepper value={qty} max={Math.max(product.stock, qty)} disabled={setQty.isPending} onChange={(value) => setQty.mutate(value)} label={`Quantity of ${product.name}`} />
      <span className="line-total">{formatINR(item.lineTotal)}</span>
      <button type="button" className="icon-btn" aria-label={`Remove ${product.name}`} disabled={remove.isPending} onClick={() => remove.mutate()}>
        <Trash2 size={16} aria-hidden="true" />
      </button>
    </li>
  );
}

export default function Cart() {
  usePageTitle('Cart');
  const navigate = useNavigate();
  const { data: cart, isLoading, isError, error, refetch } = useCart();
  const clear = useCartMutation(cartApi.clear, { success: 'Cart cleared' });
  const linesRef = useSmoothList();

  if (isLoading) return <div className="container page"><SkeletonRows /></div>;
  if (isError) return <div className="container page"><ErrorState error={error} onRetry={refetch} /></div>;

  if (cart.items.length === 0) {
    return (
      <div className="container page">
        <PathCrumbs parts={[{ label: 'cart' }]} />
        <EmptyState
          icon={ShoppingCart}
          title="Your cart is empty"
          action={<Link to="/products" className="btn btn-primary">Browse products</Link>}
        >
          Add products from the store, or start from a project kit.
        </EmptyState>
      </div>
    );
  }

  const { pricing } = cart;
  const shippingProgress = Math.min((pricing.subtotal / pricing.freeShippingThreshold) * 100, 100);

  return (
    <div className="container page">
      <PathCrumbs parts={[{ label: 'cart' }]} />
      <div className="row-between catalog-head">
        <h1>Your cart</h1>
        <button type="button" className="text-link small" disabled={clear.isPending} onClick={() => clear.mutate()}>
          Clear cart
        </button>
      </div>
      <div className="two-col">
        <ul className="line-list" ref={linesRef}>
          {cart.items.map((item) => <CartLine key={item.product._id} item={item} />)}
        </ul>
        <aside className="summary">
          <h2>Order summary</h2>
          <CouponBox cart={cart} />
          <OrderSummaryRows pricing={pricing} />
          {pricing.savings > 0 && <p className="small summary-good">You save {formatINR(pricing.savings)} on this order.</p>}
          {pricing.amountToFreeShipping > 0 && (
            <div className="budget">
              <div className="budget-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(shippingProgress)} aria-label="Progress to free shipping">
                <span style={{ width: `${shippingProgress}%` }} />
              </div>
              <p className="small muted">Add {formatINR(pricing.amountToFreeShipping)} more for free shipping.</p>
            </div>
          )}
          <button type="button" className="btn btn-primary btn-large btn-full" disabled={!cart.canCheckout} onClick={() => navigate('/checkout')}>
            Go to checkout
          </button>
          {!cart.canCheckout && (
            <p className="small stock-low">
              {cart.couponError ? 'Remove the coupon to continue.' : 'Fix the items marked above before checking out.'}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
