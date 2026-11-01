import { useQuery } from '@tanstack/react-query';
import { ChevronRight, ClipboardCheck, IndianRupee, PackageX, ReceiptText, ShoppingBag, Users } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
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
import { AnimatedNumber, GrowBar, Reveal, staggerDelay } from '../../components/motion.jsx';
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

const axisTick = { fill: 'var(--muted)', fontSize: 12 };

function RevenueTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { date, revenue, orders } = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <p className="muted small">{shortDate(date)}</p>
      <p>{formatINR(revenue)}</p>
      <p className="small muted">{orders} order{orders === 1 ? '' : 's'}</p>
    </div>
  );
}

function RevenueChart() {
  const reduce = useReducedMotion();
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
          <p className="panel-figure"><AnimatedNumber value={total} format={formatINR} /></p>
          <p className="small muted">In the last {range.replace('d', ' days')}, excluding cancelled orders</p>
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
                <defs>
                  <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="var(--chart-1)" stopOpacity={0.35} />
                    <stop offset="1" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--line)" strokeOpacity={0.6} />
                <XAxis dataKey="date" tickFormatter={shortDate} tick={axisTick} tickLine={false} axisLine={false} minTickGap={40} />
                <YAxis tickFormatter={compactINR} tick={axisTick} tickLine={false} axisLine={false} width={52} />
                <Tooltip content={<RevenueTooltip />} cursor={{ stroke: 'var(--muted)', strokeDasharray: '3 3' }} />
                <Area type="monotone" dataKey="revenue" stroke="var(--chart-1)" strokeWidth={2} fill="url(#revenue-fill)" activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }} isAnimationActive={!reduce} animationDuration={700} />
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
                      <td className="num">{row.orders}</td>
                      <td className="num">{formatINR(row.revenue)}</td>
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
      <p>{formatINR(revenue)}</p>
      <p className="small muted">{units} units</p>
    </div>
  );
}

function CategoryChart({ rows }) {
  const reduce = useReducedMotion();
  return (
    <section className="panel" aria-labelledby="category-heading">
      <div>
        <h2 id="category-heading">Sales by category</h2>
        <p className="small muted">Item sales, before coupons and shipping</p>
      </div>
      <div className="chart chart-tall" role="img" aria-label="Revenue by category, highest first. The same figures are in the table below.">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 28, bottom: 0, left: 0 }}>
            <CartesianGrid horizontal={false} stroke="var(--line)" strokeOpacity={0.6} />
            <XAxis type="number" tickFormatter={compactINR} tick={axisTick} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="category" width={132} tick={{ fill: 'var(--text)', fontSize: 12 }} tickLine={false} axisLine={false} interval={0} />
            <Tooltip content={<CategoryTooltip />} cursor={{ fill: 'var(--raised)' }} />
            <Bar dataKey="revenue" fill="var(--chart-1)" radius={[0, 4, 4, 0]} barSize={14} isAnimationActive={!reduce} animationDuration={700} />
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
                  <td className="num">{row.units}</td>
                  <td className="num">{formatINR(row.revenue)}</td>
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
              <GrowBar percent={total ? (row.count / total) * 100 : 0} color={STATUS_COLORS[row.status]} />
            </span>
            <span className="num-cell">{row.count}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AttentionCard({ to, icon: Icon, count, label }) {
  return (
    <Link to={to} className={`attention-card ${count > 0 ? 'attention-card-on' : ''}`}>
      <span className="attention-icon" aria-hidden="true">
        <Icon size={20} strokeWidth={1.75} />
      </span>
      <span className="attention-count">{count}</span>
      <span>{label}</span>
      <ChevronRight className="attention-arrow" size={18} aria-hidden="true" />
    </Link>
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
        <>
          <dl className="kpi-row">
            {[
              { label: 'Revenue', value: s.revenue, format: formatINR, icon: IndianRupee, hue: '#6d83ff' },
              { label: 'Orders', value: s.orders, format: String, icon: ReceiptText, hue: '#9b7bff' },
              { label: 'Average order', value: s.averageOrderValue, format: formatINR, icon: ShoppingBag, hue: '#2fb8e6' },
              { label: 'Customers', value: s.customers, format: String, icon: Users, hue: '#ff7f5e' },
            ].map(({ label, value, format, icon: Icon, hue }, index) => (
              <Reveal key={label} className="kpi" delay={staggerDelay(index)} style={{ '--hue': hue }}>
                <span className="tint-icon" aria-hidden="true"><Icon size={18} strokeWidth={1.9} /></span>
                <dt>{label}</dt>
                <dd><AnimatedNumber value={value} format={format} countUp /></dd>
              </Reveal>
            ))}
          </dl>

          <section className="attention" aria-labelledby="attention-heading">
            <h2 id="attention-heading">Needs attention</h2>
            <div className="attention-grid">
              <AttentionCard to="/admin/orders?status=Pending" icon={ClipboardCheck} count={s.pendingOrders} label="Orders to confirm" />
              <AttentionCard to="/admin/inventory?lowStock=true" icon={PackageX} count={s.lowStockCount} label="Low on stock" />
            </div>
          </section>
        </>
      )}

      <RevenueChart />

      <div className="panel-grid">
        {categories.data && <CategoryChart rows={categories.data} />}
        <div className="stack">
          {statuses.data && <StatusBreakdown rows={statuses.data} />}
          <section className="panel" aria-labelledby="top-heading">
            <div>
              <h2 id="top-heading">Top products</h2>
              <p className="small muted">Item sales, before coupons and shipping</p>
            </div>
            <div className="table-scroll">
              <table className="table">
                <thead><tr><th>Product</th><th className="num">Units</th><th className="num">Revenue</th></tr></thead>
                <tbody>
                  {top.data?.map((row) => (
                    <tr key={row.productId}>
                      <td><Link to={`/products/${row.slug}`} className="line-name">{row.name}</Link></td>
                      <td className="num">{row.units}</td>
                      <td className="num">{formatINR(row.revenue)}</td>
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
                  <td className="num">
                    <span className={row.stock === 0 ? 'stock-out' : 'stock-low'}>{row.stock}</span>
                  </td>
                  <td className="num">{row.lowStockThreshold}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
