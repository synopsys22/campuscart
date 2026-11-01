import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Package } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useParams } from 'react-router-dom';
import { orderApi } from '../../api/index.js';
import { OrderTimeline } from '../../components/orders.jsx';
import { ProductImage } from '../../components/product.jsx';
import {
  EmptyState,
  ErrorState,
  FormError,
  Modal,
  Pagination,
  PathCrumbs,
  SkeletonRows,
  Spinner,
  StatusBadge,
  TextField,
} from '../../components/ui.jsx';
import { usePageTitle } from '../../hooks/shop.js';
import { formatDate, formatINR, PAYMENT_LABELS } from '../../utils/format.js';
import { NotFound } from '../NotFound.jsx';

const CANCELLABLE = ['Pending', 'Confirmed'];
const FILTERS = ['All', 'Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'];

export function OrderSuccess() {
  usePageTitle('Order placed');
  const { id } = useParams();
  const { data: order, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['order', id],
    queryFn: () => orderApi.get(id),
  });
  if (isLoading) return <Spinner />;
  if (isError) return <div className="container page"><ErrorState error={error} onRetry={refetch} /></div>;
  return (
    <div className="container page success">
      <CheckCircle2 size={48} strokeWidth={1.5} className="success-icon" aria-hidden="true" />
      <h1>Your order is placed</h1>
      <p className="mono">{order.orderNumber}</p>
      <p className="muted">
        Total {formatINR(order.total)}, paid by {PAYMENT_LABELS[order.payment.method]}. Expected by {formatDate(order.estimatedDelivery)}.
      </p>
      {order.payment.transactionRef && <p className="small muted mono">Demo reference {order.payment.transactionRef}</p>}
      <div className="row success-actions">
        <Link to={`/account/orders/${order._id}`} className="btn btn-primary">Track this order</Link>
        <Link to="/products" className="btn">Keep shopping</Link>
      </div>
    </div>
  );
}

export function MyOrders() {
  usePageTitle('My orders');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('All');
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['my-orders', status, page],
    queryFn: () => orderApi.mine({ page, limit: 10, status: status === 'All' ? undefined : status }),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="stack">
      <h1>My orders</h1>
      <div className="chip-row" role="group" aria-label="Filter by status">
        {FILTERS.map((filter) => (
          <button
            type="button"
            key={filter}
            className={`chip ${status === filter ? 'chip-on' : ''}`}
            aria-pressed={status === filter}
            onClick={() => {
              setStatus(filter);
              setPage(1);
            }}
          >
            {filter}
          </button>
        ))}
      </div>
      {isLoading && <SkeletonRows />}
      {isError && <ErrorState error={error} onRetry={refetch} />}
      {data?.items.length === 0 && (
        <EmptyState
          icon={Package}
          title={status === 'All' ? 'No orders yet' : `No ${status.toLowerCase()} orders`}
          action={status === 'All' && <Link to="/products" className="btn btn-primary">Browse products</Link>}
        >
          {status === 'All' ? 'Your orders and their tracking will appear here.' : 'Choose a different status to see other orders.'}
        </EmptyState>
      )}
      <ul className="order-list">
        {data?.items.map((order) => (
          <li key={order._id}>
            <Link to={`/account/orders/${order._id}`} className="order-row">
              <div className="order-row-images" aria-hidden="true">
                {order.items.slice(0, 3).map((item) => <img key={item.sku} src={item.image} alt="" />)}
              </div>
              <div className="order-row-info">
                <span className="mono">{order.orderNumber}</span>
                <span className="small muted">
                  {formatDate(order.createdAt)}, {order.items.length} product{order.items.length === 1 ? '' : 's'}
                </span>
              </div>
              <StatusBadge status={order.status} />
              <span className="mono">{formatINR(order.total)}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Pagination meta={data?.meta} onPage={setPage} />
    </div>
  );
}

function CancelDialog({ order, onClose }) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const cancel = useMutation({
    mutationFn: () => orderApi.cancel(order._id, reason),
    onSuccess: (updated) => {
      queryClient.setQueryData(['order', order._id], { ...updated, user: order.user });
      queryClient.invalidateQueries({ queryKey: ['my-orders'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product'] });
      toast.success(`Cancelled ${order.orderNumber}`);
      onClose();
    },
  });
  return (
    <Modal title="Cancel this order?" onClose={onClose}>
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          cancel.mutate();
        }}
      >
        <p className="muted">
          {order.payment.status === 'Paid'
            ? 'The demo payment will be marked as refunded, and the items go back into stock.'
            : 'The items go back into stock.'}
        </p>
        <TextField label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <FormError error={cancel.error} />
        <div className="row modal-actions">
          <button type="button" className="btn btn-quiet" onClick={onClose}>Keep order</button>
          <button type="submit" className="btn btn-danger" disabled={cancel.isPending}>
            {cancel.isPending ? 'Cancelling...' : 'Cancel order'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function OrderItems({ order, showReviewLinks = false }) {
  return (
    <ul className="line-list">
      {order.items.map((item) => (
        <li key={item.sku} className="line">
          <ProductImage src={item.image} alt="" className="line-image" />
          <div className="line-info">
            {item.slug ? <Link to={`/products/${item.slug}`} className="line-name">{item.name}</Link> : <span className="line-name">{item.name}</span>}
            <span className="small muted mono">{formatINR(item.price)} × {item.qty}</span>
            {showReviewLinks && order.status === 'Delivered' && item.slug && (
              <Link to={`/products/${item.slug}#reviews`} className="text-link small">Review this product</Link>
            )}
          </div>
          <span className="mono">{formatINR(item.lineTotal)}</span>
        </li>
      ))}
    </ul>
  );
}

export function OrderTotals({ order }) {
  return (
    <dl className="summary-rows">
      <div><dt>Subtotal</dt><dd className="mono">{formatINR(order.subtotal)}</dd></div>
      {order.discount > 0 && (
        <div>
          <dt>Coupon <span className="mono">{order.couponCode}</span></dt>
          <dd className="mono summary-good">-{formatINR(order.discount)}</dd>
        </div>
      )}
      <div><dt>Shipping</dt><dd className="mono">{order.shippingFee === 0 ? 'Free' : formatINR(order.shippingFee)}</dd></div>
      <div className="summary-total"><dt>Total</dt><dd className="mono">{formatINR(order.total)}</dd></div>
    </dl>
  );
}

export function OrderFacts({ order }) {
  const a = order.shippingAddress;
  return (
    <dl className="review-facts">
      <div>
        <dt className="muted small">Deliver to</dt>
        <dd>{[a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean).join(', ')}</dd>
      </div>
      <div>
        <dt className="muted small">Payment</dt>
        <dd className="row">
          {PAYMENT_LABELS[order.payment.method]} <StatusBadge status={order.payment.status} />
        </dd>
        {order.payment.transactionRef && <dd className="small muted mono">{order.payment.transactionRef}</dd>}
      </div>
      {order.status !== 'Cancelled' && order.status !== 'Delivered' && (
        <div>
          <dt className="muted small">Expected by</dt>
          <dd>{formatDate(order.estimatedDelivery)}</dd>
        </div>
      )}
      {order.cancelReason && (
        <div>
          <dt className="muted small">Reason for cancelling</dt>
          <dd>{order.cancelReason}</dd>
        </div>
      )}
    </dl>
  );
}

export function OrderDetail() {
  const { id } = useParams();
  const [cancelling, setCancelling] = useState(false);
  const { data: order, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['order', id],
    queryFn: () => orderApi.get(id),
    retry: (count, err) => ![400, 404].includes(err.status) && count < 1,
  });
  usePageTitle(order?.orderNumber);

  if (isLoading) return <Spinner />;
  if ([400, 404].includes(error?.status)) return <NotFound message="This order doesn't exist, or it belongs to another account." />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <div className="stack-lg">
      <PathCrumbs parts={[{ label: 'orders', to: '/account/orders' }, { label: order.orderNumber }]} />
      <div className="row-between">
        <div>
          <h1 className="mono order-number">{order.orderNumber}</h1>
          <p className="small muted">Placed on {formatDate(order.createdAt)}</p>
        </div>
        <div className="row">
          <StatusBadge status={order.status} />
          {CANCELLABLE.includes(order.status) && (
            <button type="button" className="btn btn-quiet btn-small" onClick={() => setCancelling(true)}>Cancel order</button>
          )}
        </div>
      </div>
      <section aria-labelledby="tracking-heading" className="stack">
        <h2 id="tracking-heading">Tracking</h2>
        <OrderTimeline order={order} />
      </section>
      <section aria-labelledby="items-heading" className="stack">
        <h2 id="items-heading">Items</h2>
        <OrderItems order={order} showReviewLinks />
        <OrderTotals order={order} />
      </section>
      <OrderFacts order={order} />
      {cancelling && <CancelDialog order={order} onClose={() => setCancelling(false)} />}
    </div>
  );
}
