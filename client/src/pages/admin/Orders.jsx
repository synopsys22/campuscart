import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { orderApi } from '../../api/index.js';
import { OrderTimeline } from '../../components/orders.jsx';
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
import { formatDate, formatINR } from '../../utils/format.js';
import { NotFound } from '../NotFound.jsx';
import { OrderFacts, OrderItems, OrderTotals } from '../shop/Orders.jsx';
import { useAdminMutation } from './shared.jsx';

const STATUSES = ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'];
const NEXT_STATUS = { Pending: 'Confirmed', Confirmed: 'Shipped', Shipped: 'Delivered' };
const CANCELLABLE = ['Pending', 'Confirmed'];
const REFRESH = ['admin-orders', 'order', 'my-orders', 'analytics-summary', 'analytics-status', 'analytics-revenue', 'analytics-categories', 'analytics-top', 'analytics-low', 'products', 'product', 'admin-inventory'];

export function AdminOrders() {
  usePageTitle('Manage orders');
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const term = useDebounce(search);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-orders', status, term, page],
    queryFn: () => orderApi.listAll({ status, search: term, page, limit: 15 }),
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
          placeholder="Search by order number or customer"
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
          value={status}
          onChange={(event) => {
            setParams(event.target.value ? { status: event.target.value } : {});
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {STATUSES.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        {data && <span className="small muted">{data.meta.total} orders</span>}
      </div>
      {isLoading && <SkeletonRows />}
      {isError && <ErrorState error={error} onRetry={refetch} />}
      {data && (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr><th>Order</th><th>Customer</th><th>Date</th><th>Status</th><th className="num">Total</th></tr>
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
                  <td><StatusBadge status={order.status} /></td>
                  <td className="num mono">{formatINR(order.total)}</td>
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
  return (
    <Modal title={`Cancel ${order.orderNumber}?`} onClose={onClose}>
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          cancel.mutate();
        }}
      >
        <p className="muted">The items go back into stock, and the customer sees your reason on their order.</p>
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

export function AdminOrderDetail() {
  const { id } = useParams();
  const [cancelling, setCancelling] = useState(false);
  const { data: order, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['order', id],
    queryFn: () => orderApi.get(id),
    retry: (count, err) => ![400, 404].includes(err.status) && count < 1,
  });
  usePageTitle(order?.orderNumber);

  const next = order && NEXT_STATUS[order.status];
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
          <StatusBadge status={order.status} />
          {CANCELLABLE.includes(order.status) && (
            <button type="button" className="btn btn-quiet" onClick={() => setCancelling(true)}>Cancel order</button>
          )}
          {next && (
            <button type="button" className="btn btn-primary" disabled={advance.isPending} onClick={() => advance.mutate()}>
              {advance.isPending ? 'Updating...' : `Mark as ${next}`}
            </button>
          )}
        </div>
      </div>
      <div className="panel-grid">
        <section className="panel" aria-labelledby="admin-tracking">
          <h2 id="admin-tracking">Tracking</h2>
          <OrderTimeline order={order} />
        </section>
        <section className="panel" aria-labelledby="admin-totals">
          <h2 id="admin-totals">Totals</h2>
          <OrderTotals order={order} />
        </section>
      </div>
      <OrderItems order={order} />
      <OrderFacts order={order} />
      {cancelling && <CancelOrderDialog order={order} onClose={() => setCancelling(false)} />}
    </div>
  );
}
