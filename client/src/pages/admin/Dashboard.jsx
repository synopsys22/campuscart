import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { analyticsApi } from '../../api/index.js';
import { ErrorState, SkeletonRows } from '../../components/ui.jsx';
import { usePageTitle } from '../../hooks/shop.js';
import { formatINR } from '../../utils/format.js';

const RANGES = [
  ['7d', '7 days'],
  ['30d', '30 days'],
  ['90d', '90 days'],
];

const STATUS_COLORS = {
  Pending: 'var(--warning)',
  Confirmed: 'var(--info)',
  Shipped: 'var(--info)',
  Delivered: 'var(--success)',
  Cancelled: 'var(--danger)',
};

const shortDate = (date) =>
  new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/** Compact rupee labels for the axis: ₹12k, ₹1.2L. */
function compactINR(value) {
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${Math.round(value / 1000)}k`;
  return `₹${value}`;
}

const axisTick = { fill: 'var(--muted)', fontSize: 12, fontFamily: 'var(--font-mono)' };

function RevenueTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { date, revenue, orders } = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <p className="muted small">{shortDate(date)}</p>
      <p className="mono">{formatINR(revenue)}</p>
      <p className="small muted">{orders} order{orders === 1 ? '' : 's'}</p>
    </div>
  );
}

function RevenueChart() {
  const [range, setRange] = useState('30d');
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['analytics-revenue', range],
    queryFn: () => analyticsApi.revenue(range),
  });
  const total = data?.reduce((sum, row) => sum + row.revenue, 0) ?? 0;

  return (
    <section className="panel" aria-labelledby="revenue-heading">
      <div className="row-between">
        <div>
          <h2 id="revenue-heading">Revenue</h2>
          <p className="small muted">
            <span className="mono">{formatINR(total)}</span> in the last {range.replace('d', ' days')}, excluding cancelled orders
          </p>
        </div>
        <div className="chip-row" role="group" aria-label="Date range">
          {RANGES.map(([value, label]) => (
            <button
              type="button"
              key={value}
              className={`chip ${range === value ? 'chip-on' : ''}`}
              aria-pressed={range === value}
              onClick={() => setRange(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {isLoading && <div className="chart skeleton" aria-hidden="true" />}
      {isError && <ErrorState error={error} onRetry={refetch} />}
      {data && (
        <>
          <div className="chart" role="img" aria-label={`Daily revenue for the last ${range.replace('d', ' days')}, totalling ${formatINR(total)}`}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 8, right: 28, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--line)" strokeOpacity={0.6} />
                <XAxis dataKey="date" tickFormatter={shortDate} tick={axisTick} tickLine={false} axisLine={{ stroke: 'var(--line-strong)' }} minTickGap={40} />
                <YAxis tickFormatter={compactINR} tick={axisTick} tickLine={false} axisLine={false} width={52} />
                <Tooltip content={<RevenueTooltip />} cursor={{ stroke: 'var(--muted)', strokeDasharray: '3 3' }} />
                <Area type="monotone" dataKey="revenue" stroke="var(--accent)" strokeWidth={2} fill="var(--accent-soft)" activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <details className="small">
            <summary>View as a table</summary>
            <div className="table-scroll table-scroll-short">
              <table className="table">
                <thead><tr><th>Date</th><th className="num">Orders</th><th className="num">Revenue</th></tr></thead>
                <tbody>
                  {data.map((row) => (
                    <tr key={row.date}>
                      <td>{shortDate(row.date)}</td>
                      <td className="num mono">{row.orders}</td>
                      <td className="num mono">{formatINR(row.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}

function CategoryTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { category, revenue, units } = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <p className="muted small">{category}</p>
      <p className="mono">{formatINR(revenue)}</p>
      <p className="small muted">{units} units</p>
    </div>
  );
}

function CategoryChart({ rows }) {
  return (
    <section className="panel" aria-labelledby="category-heading">
      <h2 id="category-heading">Sales by category</h2>
      <div className="chart chart-tall" role="img" aria-label="Revenue by category, highest first. The same figures are in the table below.">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 28, bottom: 0, left: 0 }}>
            <CartesianGrid horizontal={false} stroke="var(--line)" strokeOpacity={0.6} />
            <XAxis type="number" tickFormatter={compactINR} tick={axisTick} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="category" width={132} tick={{ fill: 'var(--text)', fontSize: 12 }} tickLine={false} axisLine={{ stroke: 'var(--line-strong)' }} interval={0} />
            <Tooltip content={<CategoryTooltip />} cursor={{ fill: 'var(--raised)' }} />
            <Bar dataKey="revenue" fill="var(--accent)" radius={[0, 4, 4, 0]} barSize={14} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="small">
        <summary>View as a table</summary>
        <div className="table-scroll table-scroll-short">
          <table className="table">
            <thead><tr><th>Category</th><th className="num">Units</th><th className="num">Revenue</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.category}>
                  <td>{row.category}</td>
                  <td className="num mono">{row.units}</td>
                  <td className="num mono">{formatINR(row.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

function StatusBreakdown({ rows }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return (
    <section className="panel" aria-labelledby="status-heading">
      <h2 id="status-heading">Orders by status</h2>
      <ul className="status-bars">
        {rows.map((row) => (
          <li key={row.status}>
            <span>{row.status}</span>
            <span className="rating-bar" aria-hidden="true">
              <span style={{ width: total ? `${(row.count / total) * 100}%` : 0, background: STATUS_COLORS[row.status] }} />
            </span>
            <span className="mono num-cell">{row.count}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Dashboard() {
  usePageTitle('Admin dashboard');
  const summary = useQuery({ queryKey: ['analytics-summary'], queryFn: analyticsApi.summary });
  const categories = useQuery({ queryKey: ['analytics-categories'], queryFn: analyticsApi.categorySales });
  const statuses = useQuery({ queryKey: ['analytics-status'], queryFn: analyticsApi.orderStatus });
  const top = useQuery({ queryKey: ['analytics-top'], queryFn: analyticsApi.topProducts });
  const lowStock = useQuery({ queryKey: ['analytics-low'], queryFn: analyticsApi.lowStock });

  if (summary.isError) return <ErrorState error={summary.error} onRetry={summary.refetch} />;

  const s = summary.data;
  return (
    <div className="stack-lg">
      <h1>Dashboard</h1>
      {!s ? (
        <SkeletonRows count={1} />
      ) : (
        <dl className="kpi-row">
          <div className="kpi"><dt>Revenue</dt><dd>{formatINR(s.revenue)}</dd></div>
          <div className="kpi"><dt>Orders</dt><dd>{s.orders}</dd></div>
          <div className="kpi"><dt>Average order</dt><dd>{formatINR(s.averageOrderValue)}</dd></div>
          <div className="kpi"><dt>Customers</dt><dd>{s.customers}</dd></div>
          <div className="kpi">
            <dt><Link to="/admin/orders?status=Pending" className="text-link">Orders to confirm</Link></dt>
            <dd>{s.pendingOrders}</dd>
          </div>
          <div className="kpi">
            <dt><Link to="/admin/inventory?lowStock=true" className="text-link">Low on stock</Link></dt>
            <dd>{s.lowStockCount}</dd>
          </div>
        </dl>
      )}

      <RevenueChart />

      <div className="panel-grid">
        {categories.data && <CategoryChart rows={categories.data} />}
        <div className="stack">
          {statuses.data && <StatusBreakdown rows={statuses.data} />}
          <section className="panel" aria-labelledby="top-heading">
            <h2 id="top-heading">Top products</h2>
            <div className="table-scroll">
              <table className="table">
                <thead><tr><th>Product</th><th className="num">Units</th><th className="num">Revenue</th></tr></thead>
                <tbody>
                  {top.data?.map((row) => (
                    <tr key={row.productId}>
                      <td><Link to={`/products/${row.slug}`} className="line-name">{row.name}</Link></td>
                      <td className="num mono">{row.units}</td>
                      <td className="num mono">{formatINR(row.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      <section className="panel" aria-labelledby="low-heading">
        <div className="row-between">
          <h2 id="low-heading">Low-stock alerts</h2>
          <Link to="/admin/inventory?lowStock=true" className="text-link small">Update inventory</Link>
        </div>
        <div className="table-scroll">
          <table className="table">
            <thead><tr><th>Product</th><th>SKU</th><th className="num">In stock</th><th className="num">Alert at</th></tr></thead>
            <tbody>
              {lowStock.data?.map((row) => (
                <tr key={row._id}>
                  <td>{row.name}</td>
                  <td className="mono">{row.sku}</td>
                  <td className="num mono">
                    <span className={row.stock === 0 ? 'stock-out' : 'stock-low'}>{row.stock}</span>
                  </td>
                  <td className="num mono">{row.lowStockThreshold}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
