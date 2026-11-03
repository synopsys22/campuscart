import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Package, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useParams } from 'react-router-dom';
import { orderApi } from '../../api/index.js';
import { useDeliveryOptions } from '../../components/delivery.jsx';
import { SuccessMark, useSmoothList } from '../../components/motion.jsx';
import { DeliveryCodeCard, OrderTimeline, ReturnStatus, TrackingCard } from '../../components/orders.jsx';
import { ProductImage } from '../../components/product.jsx';
import {
  EmptyState,
  ErrorState,
  FormError,
  Modal,
  Pagination,
  PathCrumbs,
  SelectField,
  SkeletonRows,
  Spinner,
  StatusBadge,
  TextArea,
  TextField,
} from '../../components/ui.jsx';
import { usePageTitle } from '../../hooks/shop.js';
import {
  DELIVERY_LABELS,
  formatDate,
  formatDay,
  formatINR,
  PAYMENT_LABELS,
  refundNote,
  statusLabel,
} from '../../utils/format.js';
import { NotFound } from '../NotFound.jsx';

const CANCELLABLE = ['Pending', 'Confirmed'];
const FILTERS = ['All', 'Pending', 'Confirmed', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled', 'Returned'];

export function OrderSuccess() {
  usePageTitle('Order placed');
  const { id } = useParams();
  const { data: order, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['order', id],
    queryFn: () => orderApi.get(id),
  });
  if (isLoading) return <Spinner />;
  if (isError) return <div className="container page"><ErrorState error={error} onRetry={refetch} /></div>;
  const pickup = order.delivery?.method === 'pickup';
  const paid = order.payment.status === 'Paid';
  return (
    <div className="container page success">
      <SuccessMark />
      <h1>Your order is placed</h1>
      <p className="mono">{order.orderNumber}</p>
      <p className="muted">
        {formatINR(order.total)} {paid ? 'paid by' : 'to pay by'} {PAYMENT_LABELS[order.payment.method]}
        {order.payment.detail && ` (${order.payment.detail})`}.{' '}
        {pickup
          ? `Ready to collect at ${order.delivery.pickupPoint} from ${formatDay(order.estimatedDelivery)}, ${order.delivery.pickupSlot}.`
          : `${DELIVERY_LABELS[order.delivery?.method ?? 'standard']}, arriving by ${formatDay(order.estimatedDelivery)}.`}
      </p>
      {order.payment.transactionRef && <p className="small muted mono">Payment reference {order.payment.transactionRef}</p>}
      <div className="row success-actions">
        <Link to={`/account/orders/${order._id}`} className="btn btn-primary">Track this order</Link>
        <Link to="/products" className="btn">Keep shopping</Link>
      </div>
    </div>
  );
}

export function MyOrders() {
  usePageTitle('My orders');
  const listRef = useSmoothList();
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
      <ul className="order-list" ref={listRef}>
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
                  {order.delivery?.method && order.delivery.method !== 'standard' && `, ${DELIVERY_LABELS[order.delivery.method]}`}
                </span>
              </div>
              <StatusBadge status={order.status} />
              <span>{formatINR(order.total)}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Pagination meta={data?.meta} onPage={setPage} />
    </div>
  );
}

function useOrderUpdated(order) {
  const queryClient = useQueryClient();
  return (updated) => {
    queryClient.setQueryData(['order', order._id], { ...updated, user: order.user });
    queryClient.invalidateQueries({ queryKey: ['order', order._id] });
    queryClient.invalidateQueries({ queryKey: ['my-orders'] });
    queryClient.invalidateQueries({ queryKey: ['products'] });
    queryClient.invalidateQueries({ queryKey: ['product'] });
    queryClient.invalidateQueries({ queryKey: ['wallet'] });
  };
}

function CancelDialog({ order, onClose }) {
  const [reason, setReason] = useState('');
  const updated = useOrderUpdated(order);
  const cancel = useMutation({
    mutationFn: () => orderApi.cancel(order._id, reason),
    onSuccess: (result) => {
      updated(result);
      toast.success(`Cancelled ${order.orderNumber}`);
      onClose();
    },
  });
  const paid = order.payment.status === 'Paid';
  const toWallet = order.payment.method === 'WALLET';
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
          {paid
            ? `${formatINR(order.total)} goes back to ${toWallet ? 'your CampusCart wallet' : order.payment.detail || 'the account that paid'}, and the items go back into stock.`
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

function ReturnDialog({ order, onClose }) {
  const options = useDeliveryOptions();
  const [reason, setReason] = useState('');
  const [comment, setComment] = useState('');
  const updated = useOrderUpdated(order);
  const request = useMutation({
    mutationFn: () => orderApi.requestReturn(order._id, { reason, comment }),
    onSuccess: (result) => {
      updated(result);
      toast.success('Return requested');
      onClose();
    },
  });
  const toWallet = !['MOCK_CARD', 'MOCK_UPI'].includes(order.payment.method);
  return (
    <Modal title="Return this order" onClose={onClose}>
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          request.mutate();
        }}
      >
        <p className="muted">
          Once the store approves it, the items are collected and {formatINR(order.total)} is refunded to{' '}
          {toWallet ? 'your CampusCart wallet' : order.payment.detail || 'the account that paid'}.
        </p>
        <SelectField label="Why are you returning it?" value={reason} onChange={(e) => setReason(e.target.value)} error={request.error?.fieldErrors?.reason}>
          <option value="">Choose a reason</option>
          {options.data?.returnReasons.map((value) => <option key={value} value={value}>{value}</option>)}
        </SelectField>
        <TextArea label="Anything else? (optional)" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
        {request.error && !request.error.fieldErrors && <FormError error={request.error} />}
        <div className="row modal-actions">
          <button type="button" className="btn btn-quiet" onClick={onClose}>Keep it</button>
          <button type="submit" className="btn btn-primary" disabled={request.isPending || !reason}>
            {request.isPending ? 'Sending...' : 'Request return'}
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
            <span className="small muted">{formatINR(item.price)} × {item.qty}</span>
            {showReviewLinks && order.status === 'Delivered' && item.slug && (
              <Link to={`/products/${item.slug}#reviews`} className="text-link small">Review this product</Link>
            )}
          </div>
          <span>{formatINR(item.lineTotal)}</span>
        </li>
      ))}
    </ul>
  );
}

export function OrderTotals({ order }) {
  return (
    <dl className="summary-rows">
      <div><dt>Subtotal</dt><dd>{formatINR(order.subtotal)}</dd></div>
      {order.discount > 0 && (
        <div>
          <dt>Coupon <span className="mono">{order.couponCode}</span></dt>
          <dd className="summary-good">-{formatINR(order.discount)}</dd>
        </div>
      )}
      <div>
        <dt>{DELIVERY_LABELS[order.delivery?.method ?? 'standard']}</dt>
        <dd>{order.shippingFee === 0 ? 'Free' : formatINR(order.shippingFee)}</dd>
      </div>
      <div className="summary-total"><dt>Total</dt><dd>{formatINR(order.total)}</dd></div>
    </dl>
  );
}

export function OrderFacts({ order, forAdmin = false }) {
  const a = order.shippingAddress;
  const pickup = order.delivery?.method === 'pickup';
  const refund = refundNote(order, { forAdmin });
  const open = !['Cancelled', 'Delivered', 'Returned'].includes(order.status);
  return (
    <dl className="review-facts">
      <div>
        <dt className="muted small">{pickup ? 'Pick up at' : 'Deliver to'}</dt>
        <dd>
          {pickup
            ? `${order.delivery.pickupPoint}, ${order.delivery.pickupSlot}`
            : [a?.line1, a?.line2, a?.city, a?.state, a?.pincode].filter(Boolean).join(', ')}
        </dd>
      </div>
      <div>
        <dt className="muted small">Payment</dt>
        <dd className="row">
          {PAYMENT_LABELS[order.payment.method]} <StatusBadge status={order.payment.status} />
        </dd>
        {order.payment.detail && <dd className="small muted">{order.payment.detail}</dd>}
        {order.payment.transactionRef && <dd className="small muted mono">{order.payment.transactionRef}</dd>}
        {refund && <dd className="small summary-good">{refund}</dd>}
      </div>
      {open && (
        <div>
          <dt className="muted small">{pickup ? 'Ready from' : 'Expected by'}</dt>
          <dd>{formatDay(order.estimatedDelivery)}</dd>
          <dd className="small muted">{DELIVERY_LABELS[order.delivery?.method ?? 'standard']}</dd>
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

function ReturnArea({ order, onRequest }) {
  if (order.returnRequest) return <ReturnStatus order={order} />;
  if (order.status !== 'Delivered' || !order.returnWindowEndsAt) return null;
  const open = new Date(order.returnWindowEndsAt) > new Date();
  if (!open) return <p className="small muted">The return window for this order closed on {formatDate(order.returnWindowEndsAt)}.</p>;
  return (
    <div className="row-between return-offer">
      <p className="small">Not right? You can return this order until <strong>{formatDay(order.returnWindowEndsAt)}</strong>.</p>
      <button type="button" className="btn btn-small" onClick={onRequest}>
        <RotateCcw size={15} aria-hidden="true" /> Return this order
      </button>
    </div>
  );
}

export function OrderDetail() {
  const { id } = useParams();
  const [dialog, setDialog] = useState(null);
  const { data: order, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['order', id],
    queryFn: () => orderApi.get(id),
    retry: (count, err) => ![400, 404].includes(err.status) && count < 1,
  });
  usePageTitle(order?.orderNumber);

  if (isLoading) return <Spinner />;
  if ([400, 404].includes(error?.status)) return <NotFound message="This order doesn't exist, or it belongs to another account." />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;

  const method = order.delivery?.method ?? 'standard';
  return (
    <div className="stack-lg">
      <PathCrumbs parts={[{ label: 'orders', to: '/account/orders' }, { label: order.orderNumber }]} />
      <div className="row-between">
        <div>
          <h1 className="mono order-number">{order.orderNumber}</h1>
          <p className="small muted">Placed on {formatDate(order.createdAt)}</p>
        </div>
        <div className="row">
          <StatusBadge status={order.status} label={statusLabel(order.status, method)} />
          {CANCELLABLE.includes(order.status) && (
            <button type="button" className="btn btn-quiet btn-small" onClick={() => setDialog('cancel')}>Cancel order</button>
          )}
        </div>
      </div>
      <DeliveryCodeCard order={order} />
      <section aria-labelledby="tracking-heading" className="stack">
        <h2 id="tracking-heading">Tracking</h2>
        <TrackingCard order={order} />
        <OrderTimeline order={order} />
      </section>
      <ReturnArea order={order} onRequest={() => setDialog('return')} />
      <section aria-labelledby="items-heading" className="stack">
        <h2 id="items-heading">Items</h2>
        <OrderItems order={order} showReviewLinks />
        <OrderTotals order={order} />
      </section>
      <OrderFacts order={order} />
      {dialog === 'cancel' && <CancelDialog order={order} onClose={() => setDialog(null)} />}
      {dialog === 'return' && <ReturnDialog order={order} onClose={() => setDialog(null)} />}
    </div>
  );
}
