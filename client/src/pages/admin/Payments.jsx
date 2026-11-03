import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { paymentApi } from '../../api/index.js';
import { ErrorState, Pagination, SkeletonRows, StatusBadge } from '../../components/ui.jsx';
import { useDebounce, usePageTitle } from '../../hooks/shop.js';
import { formatDateTime, formatINR, PAYMENT_LABELS } from '../../utils/format.js';

const STATUSES = ['Succeeded', 'Refunded', 'Failed', 'Expired', 'Created', 'Awaiting OTP', 'Awaiting approval'];
const METHODS = ['MOCK_UPI', 'MOCK_CARD', 'WALLET', 'COD'];

function paidWith(payment) {
  if (payment.card) return `${payment.card.brand} ending ${payment.card.last4}`;
  if (payment.method === 'MOCK_UPI') return payment.upiFlow === 'qr' ? 'QR code' : payment.upiId;
  if (payment.method === 'COD') return 'Cash on delivery';
  return '';
}

function Figures({ items }) {
  return (
    <dl className="kpi-row figures">
      {items.map(({ label, value }) => (
        <div key={label} className="kpi">
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function PaymentsTab() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [method, setMethod] = useState('');
  const [page, setPage] = useState(1);
  const term = useDebounce(search);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-payments', term, status, method, page],
    queryFn: () => paymentApi.listAll({ search: term, status, method, page }),
    placeholderData: keepPreviousData,
  });
  const reset = (setter) => (event) => {
    setter(event.target.value);
    setPage(1);
  };

  return (
    <div className="stack">
      {data?.summary && (
        <Figures
          items={[
            { label: 'Collected', value: formatINR(data.summary.collected) },
            { label: 'Refunded', value: formatINR(data.summary.refunded) },
            { label: 'Kept after refunds', value: formatINR(data.summary.net) },
            { label: 'Success rate', value: data.summary.successRate === null ? 'None yet' : `${data.summary.successRate}%` },
          ]}
        />
      )}
      <div className="toolbar">
        <label className="visually-hidden" htmlFor="payment-search">Search payments</label>
        <input id="payment-search" className="input" placeholder="Search by reference, order number or customer" value={search} onChange={reset(setSearch)} />
        <label className="visually-hidden" htmlFor="payment-status">Filter by status</label>
        <select id="payment-status" className="input input-auto" value={status} onChange={reset(setStatus)}>
          <option value="">All statuses</option>
          {STATUSES.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <label className="visually-hidden" htmlFor="payment-method">Filter by method</label>
        <select id="payment-method" className="input input-auto" value={method} onChange={reset(setMethod)}>
          <option value="">All methods</option>
          {METHODS.map((value) => <option key={value} value={value}>{PAYMENT_LABELS[value]}</option>)}
        </select>
        {data && <span className="small muted">{data.meta.total} payments, {data.summary.failed} failed</span>}
      </div>
      {isLoading && <SkeletonRows />}
      {isError && <ErrorState error={error} onRetry={refetch} />}
      {data && (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr><th>Reference</th><th>Date</th><th>Customer</th><th>For</th><th>Method</th><th>Status</th><th className="num">Amount</th></tr>
            </thead>
            <tbody>
              {data.items.map((payment) => (
                <tr key={payment._id}>
                  <td className="mono small nowrap">{payment.reference}</td>
                  <td className="small">{formatDateTime(payment.createdAt)}</td>
                  <td>
                    {payment.user?.name}
                    <div className="small muted">{payment.user?.email}</div>
                  </td>
                  <td className="small">
                    {payment.purpose === 'wallet_topup'
                      ? 'Wallet top-up'
                      : payment.order
                        ? <Link to={`/admin/orders/${payment.order}`} className="mono text-link nowrap">{payment.orderNumber}</Link>
                        : <span className="muted">No order</span>}
                  </td>
                  <td className="small">
                    {PAYMENT_LABELS[payment.method]}
                    <div className="muted">{paidWith(payment)}</div>
                  </td>
                  <td>
                    <StatusBadge status={payment.status} />
                    {payment.failureReason && <div className="small muted">{payment.failureReason}</div>}
                    {payment.refund && (
                      <div className="small muted">To {payment.refund.to === 'wallet' ? 'wallet' : 'source'}, {formatDateTime(payment.refund.at)}</div>
                    )}
                  </td>
                  <td className="num">{formatINR(payment.amount)}</td>
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

const KIND_LABELS = { topup: 'Top-up', payment: 'Order payment', refund: 'Refund', reversal: 'Reversal' };

function WalletTab() {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const term = useDebounce(search);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-wallet', term, type, page],
    queryFn: () => paymentApi.walletActivity({ search: term, type, page }),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="stack">
      {data?.summary && (
        <Figures
          items={[
            { label: 'Held in wallets', value: formatINR(data.summary.held) },
            { label: 'Added by students', value: formatINR(data.summary.toppedUp) },
            { label: 'Spent on orders', value: formatINR(data.summary.spent) },
            { label: 'Refunded to wallets', value: formatINR(data.summary.refunded) },
          ]}
        />
      )}
      <div className="toolbar">
        <label className="visually-hidden" htmlFor="wallet-search">Search wallet activity</label>
        <input
          id="wallet-search"
          className="input"
          placeholder="Search by customer or order number"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <label className="visually-hidden" htmlFor="wallet-type">Filter by direction</label>
        <select
          id="wallet-type"
          className="input input-auto"
          value={type}
          onChange={(event) => {
            setType(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Money in and out</option>
          <option value="credit">Money in</option>
          <option value="debit">Money out</option>
        </select>
        {data && <span className="small muted">{data.summary.wallets} wallets with money</span>}
      </div>
      {isLoading && <SkeletonRows />}
      {isError && <ErrorState error={error} onRetry={refetch} />}
      {data && (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr><th>Date</th><th>Customer</th><th>Type</th><th>Details</th><th className="num">Amount</th><th className="num">Balance after</th></tr>
            </thead>
            <tbody>
              {data.items.map((line) => (
                <tr key={line._id}>
                  <td className="small">{formatDateTime(line.createdAt)}</td>
                  <td>
                    {line.user?.name}
                    <div className="small muted">{line.user?.email}</div>
                  </td>
                  <td className="small">{KIND_LABELS[line.kind]}</td>
                  <td className="small">
                    {line.order ? <Link to={`/admin/orders/${line.order}`} className="text-link">{line.description}</Link> : line.description}
                  </td>
                  <td className={`num ${line.type === 'credit' ? 'summary-good' : ''}`}>
                    {line.type === 'credit' ? '+' : '-'}{formatINR(line.amount)}
                  </td>
                  <td className="num">{formatINR(line.balanceAfter)}</td>
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

export function AdminPayments() {
  usePageTitle('Payments');
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'wallet' ? 'wallet' : 'payments';
  return (
    <div className="stack">
      <h1>Payments</h1>
      <div className="pay-tabs page-tabs" role="group" aria-label="Show">
        <button type="button" aria-pressed={tab === 'payments'} onClick={() => setParams({})}>All payments</button>
        <button type="button" aria-pressed={tab === 'wallet'} onClick={() => setParams({ tab: 'wallet' })}>Wallet activity</button>
      </div>
      {tab === 'payments' ? <PaymentsTab /> : <WalletTab />}
    </div>
  );
}
