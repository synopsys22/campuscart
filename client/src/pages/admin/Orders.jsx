import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { orderApi } from '../../api/index.js';
import { ORDER_STATUSES, OrderTimeline, ReturnStatus, TrackingCard } from '../../components/orders.jsx';
import {
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
import { useDebounce, usePageTitle } from '../../hooks/shop.js';
import { DELIVERY_LABELS, formatDate, formatINR, statusLabel } from '../../utils/format.js';
import { NotFound } from '../NotFound.jsx';
import { OrderFacts, OrderItems, OrderTotals } from '../shop/Orders.jsx';
import { useAdminMutation } from './shared.jsx';

const NEXT_STATUS = { Pending: 'Confirmed', Confirmed: 'Shipped', Shipped: 'Out for Delivery', 'Out for Delivery': 'Delivered' };
const CANCELLABLE = ['Pending', 'Confirmed'];
const RETURNS_FILTER = 'returns';
const REFRESH = ['admin-orders', 'order', 'my-orders', 'analytics-summary', 'analytics-status', 'analytics-revenue', 'analytics-categories', 'analytics-top', 'analytics-low', 'products', 'product', 'admin-inventory', 'admin-payments', 'admin-wallet', 'wallet'];

/** The admin's button text for the next step. Pickup orders are handed over at a desk. */
function nextLabel(next, method) {
  if (method === 'pickup' && next === 'Out for Delivery') return 'Mark as ready for pickup';
  if (method === 'pickup' && next === 'Delivered') return 'Mark as collected';
  return `Mark as ${next}`;
}

export function AdminOrders() {
  usePageTitle('Manage orders');
  const [params, setParams] = useSearchParams();
  const filter = params.get('status') ?? (params.get('return') ? RETURNS_FILTER : '');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const term = useDebounce(search);
  const query = filter === RETURNS_FILTER ? { returnStatus: 'Requested' } : { status: filter };

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-orders', filter, term, page],
    queryFn: () => orderApi.listAll({ ...query, search: term, page, limit: 15 }),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="stack">
      <h1>Orders</h1>
      <div className="toolbar">
        <label className="visually-hidden" htmlFor="order-search">Search orders</label>
        <input
          id="order-search"
          className="input"
          placeholder="Search by order number, tracking number or customer"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <label className="visually-hidden" htmlFor="order-status">Filter by status</label>
        <select
          id="order-status"
          className="input input-auto"
          value={filter}
          onChange={(event) => {
            const { value } = event.target;
            if (value === RETURNS_FILTER) setParams({ return: 'Requested' });
            else setParams(value ? { status: value } : {});
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {ORDER_STATUSES.map((value) => <option key={value} value={value}>{value}</option>)}
          <option value={RETURNS_FILTER}>Return requested</option>
        </select>
        {data && <span className="small muted">{data.meta.total} orders</span>}
      </div>
      {isLoading && <SkeletonRows />}
      {isError && <ErrorState error={error} onRetry={refetch} />}
      {data && (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr><th>Order</th><th>Customer</th><th>Date</th><th>Delivery</th><th>Status</th><th className="num">Total</th></tr>
            </thead>
            <tbody>
              {data.items.map((order) => (
                <tr key={order._id}>
                  <td><Link to={`/admin/orders/${order._id}`} className="mono text-link">{order.orderNumber}</Link></td>
                  <td>
                    {order.user?.name}
                    <div className="small muted">{order.user?.email}</div>
                  </td>
                  <td>{formatDate(order.createdAt)}</td>
                  <td className="small">{DELIVERY_LABELS[order.delivery?.method ?? 'standard']}</td>
                  <td>
                    <span className="row status-cell">
                      <StatusBadge status={order.status} />
                      {order.returnRequest?.status === 'Requested' && <StatusBadge status="Requested" label="Return requested" />}
                    </span>
                  </td>
                  <td className="num">{formatINR(order.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination meta={data?.meta} onPage={setPage} />
    </div>
  );
}

function CancelOrderDialog({ order, onClose }) {
  const [note, setNote] = useState('');
  const cancel = useAdminMutation(() => orderApi.setStatus(order._id, { status: 'Cancelled', note }), {
    quietErrors: true,
    success: `Cancelled ${order.orderNumber}`,
    invalidate: REFRESH,
    onDone: onClose,
  });
  const paid = order.payment.status === 'Paid';
  return (
    <Modal title={`Cancel ${order.orderNumber}?`} onClose={onClose}>
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          cancel.mutate();
        }}
      >
        <p className="muted">
          The items go back into stock{paid ? `, ${formatINR(order.total)} is refunded,` : ''} and the customer sees your reason on their order.
        </p>
        <TextField label="Reason" value={note} onChange={(e) => setNote(e.target.value)} />
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

/** Delivery needs the 4-digit code that only the customer can see. */
function DeliverDialog({ order, onClose }) {
  const [code, setCode] = useState('');
  const pickup = order.delivery?.method === 'pickup';
  const deliver = useAdminMutation(() => orderApi.setStatus(order._id, { status: 'Delivered', code }), {
    quietErrors: true,
    success: pickup ? 'Marked as collected' : 'Marked as Delivered',
    invalidate: REFRESH,
    onDone: onClose,
  });
  return (
    <Modal title={pickup ? 'Hand over at the pickup desk' : 'Confirm delivery'} onClose={onClose}>
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          deliver.mutate();
        }}
      >
        <p className="muted">
          Ask {order.user?.name ?? 'the customer'} for the 4-digit delivery code on their order page. It proves the parcel reached the right person.
        </p>
        <TextField
          label="Delivery code"
          className="input otp-input mono"
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          value={code}
          error={deliver.error?.fieldErrors?.code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 4))}
          autoFocus
        />
        {deliver.error && !deliver.error.fieldErrors && <FormError error={deliver.error} />}
        <div className="row modal-actions">
          <button type="button" className="btn btn-quiet" onClick={onClose}>Not yet</button>
          <button type="submit" className="btn btn-primary" disabled={deliver.isPending || code.length !== 4}>
            {deliver.isPending ? 'Checking...' : pickup ? 'Confirm collection' : 'Confirm delivery'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ReturnDecision({ order }) {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const decide = useAdminMutation((body) => orderApi.decideReturn(order._id, body), {
    quietErrors: true,
    success: (_result, body) => (body.decision === 'approve' ? 'Return approved and refunded' : 'Return rejected'),
    invalidate: REFRESH,
    onDone: () => setRejecting(false),
  });
  const toWallet = !['MOCK_CARD', 'MOCK_UPI'].includes(order.payment.method);
  return (
    <section className="panel" aria-labelledby="return-heading">
      <h2 id="return-heading">Return request</h2>
      <ReturnStatus order={order} forAdmin />
      {order.returnRequest.status === 'Requested' && (
        <>
          <p className="small muted">
            Approving means the items have been collected. They go back into stock, and {formatINR(order.total)} is refunded to{' '}
            {toWallet ? "the customer's wallet" : order.payment.detail || 'the account that paid'}.
          </p>
          {rejecting ? (
            <form
              className="stack"
              onSubmit={(event) => {
                event.preventDefault();
                decide.mutate({ decision: 'reject', note });
              }}
            >
              <TextField label="Why can't it be returned?" value={note} error={decide.error?.fieldErrors?.note} onChange={(e) => setNote(e.target.value)} />
              <div className="row">
                <button type="button" className="btn btn-quiet" onClick={() => setRejecting(false)}>Back</button>
                <button type="submit" className="btn btn-danger" disabled={decide.isPending}>Reject return</button>
              </div>
            </form>
          ) : (
            <div className="row">
              <button type="button" className="btn btn-quiet" onClick={() => setRejecting(true)}>Reject</button>
              <button type="button" className="btn btn-primary" disabled={decide.isPending} onClick={() => decide.mutate({ decision: 'approve' })}>
                {decide.isPending ? 'Refunding...' : 'Approve and refund'}
              </button>
            </div>
          )}
          {decide.error && !decide.error.fieldErrors && <FormError error={decide.error} />}
        </>
      )}
    </section>
  );
}

export function AdminOrderDetail() {
  const { id } = useParams();
  const [dialog, setDialog] = useState(null);
  const { data: order, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['order', id],
    queryFn: () => orderApi.get(id),
    retry: (count, err) => ![400, 404].includes(err.status) && count < 1,
  });
  usePageTitle(order?.orderNumber);

  const next = order && NEXT_STATUS[order.status];
  const method = order?.delivery?.method ?? 'standard';
  const advance = useAdminMutation(() => orderApi.setStatus(id, { status: next }), {
    success: () => `Marked as ${next}`,
    invalidate: REFRESH,
  });

  if (isLoading) return <Spinner />;
  if ([400, 404].includes(error?.status)) return <NotFound message="This order doesn't exist." />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <div className="stack-lg">
      <PathCrumbs parts={[{ label: 'admin', to: '/admin' }, { label: 'orders', to: '/admin/orders' }, { label: order.orderNumber }]} />
      <div className="row-between">
        <div>
          <h1 className="mono order-number">{order.orderNumber}</h1>
          <p className="small muted">
            {order.user?.name}, {order.user?.email}
          </p>
        </div>
        <div className="row">
          <StatusBadge status={order.status} label={statusLabel(order.status, method)} />
          {CANCELLABLE.includes(order.status) && (
            <button type="button" className="btn btn-quiet" onClick={() => setDialog('cancel')}>Cancel order</button>
          )}
          {next && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={advance.isPending}
              onClick={() => (next === 'Delivered' ? setDialog('deliver') : advance.mutate())}
            >
              {advance.isPending ? 'Updating...' : nextLabel(next, method)}
            </button>
          )}
        </div>
      </div>
      {order.returnRequest && <ReturnDecision order={order} />}
      <div className="panel-grid">
        <section className="panel" aria-labelledby="admin-tracking">
          <h2 id="admin-tracking">Tracking</h2>
          <TrackingCard order={order} />
          <OrderTimeline order={order} />
        </section>
        <section className="panel" aria-labelledby="admin-totals">
          <h2 id="admin-totals">Totals</h2>
          <OrderTotals order={order} />
        </section>
      </div>
      <OrderItems order={order} />
      <OrderFacts order={order} forAdmin />
      {dialog === 'cancel' && <CancelOrderDialog order={order} onClose={() => setDialog(null)} />}
      {dialog === 'deliver' && <DeliverDialog order={order} onClose={() => setDialog(null)} />}
    </div>
  );
}
