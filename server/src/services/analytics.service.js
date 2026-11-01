import { ORDER_STATUSES, Order, Product } from '../models/index.js';

const TIME_ZONE = 'Asia/Kolkata';
const DAY_MS = 24 * 60 * 60 * 1000;
const LIVE_ORDERS = { status: { $ne: 'Cancelled' } };
const LOW_STOCK = { isActive: true, $expr: { $lte: ['$stock', '$lowStockThreshold'] } };

const dayKey = (date) => date.toLocaleDateString('en-CA', { timeZone: TIME_ZONE });

export async function summary() {
  const [[totals], customers, pendingOrders, lowStockCount] = await Promise.all([
    Order.aggregate([
      { $match: LIVE_ORDERS },
      { $group: { _id: null, revenue: { $sum: '$total' }, orders: { $sum: 1 } } },
    ]),
    Order.distinct('user', LIVE_ORDERS),
    Order.countDocuments({ status: 'Pending' }),
    Product.countDocuments(LOW_STOCK),
  ]);
  const revenue = totals?.revenue ?? 0;
  const orders = totals?.orders ?? 0;
  return {
    revenue,
    orders,
    averageOrderValue: orders ? Math.round(revenue / orders) : 0,
    customers: customers.length,
    pendingOrders,
    lowStockCount,
  };
}

/** Revenue per day for the last N days, including days with no sales, so charts have no gaps. */
export async function revenueByDay(days) {
  const now = Date.now();
  const keys = Array.from({ length: days }, (_, index) =>
    dayKey(new Date(now - (days - 1 - index) * DAY_MS)),
  );
  // One extra day is fetched so the first day's early hours are covered in any time zone.
  const rows = await Order.aggregate([
    { $match: { ...LIVE_ORDERS, createdAt: { $gte: new Date(now - (days + 1) * DAY_MS) } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TIME_ZONE } },
        revenue: { $sum: '$total' },
        orders: { $sum: 1 },
      },
    },
  ]);
  const byDay = new Map(rows.map((row) => [row._id, row]));
  return keys.map((date) => ({
    date,
    revenue: byDay.get(date)?.revenue ?? 0,
    orders: byDay.get(date)?.orders ?? 0,
  }));
}

export function categorySales() {
  return Order.aggregate([
    { $match: LIVE_ORDERS },
    { $unwind: '$items' },
    { $lookup: { from: 'products', localField: 'items.product', foreignField: '_id', as: 'product' } },
    { $unwind: '$product' },
    { $lookup: { from: 'categories', localField: 'product.category', foreignField: '_id', as: 'category' } },
    { $unwind: '$category' },
    {
      $group: {
        _id: '$category.name',
        revenue: { $sum: '$items.lineTotal' },
        units: { $sum: '$items.qty' },
      },
    },
    { $sort: { revenue: -1, _id: 1 } },
    { $project: { _id: 0, category: '$_id', revenue: 1, units: 1 } },
  ]);
}

export function topProducts(limit = 5) {
  return Order.aggregate([
    { $match: LIVE_ORDERS },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.product',
        name: { $last: '$items.name' },
        slug: { $last: '$items.slug' },
        units: { $sum: '$items.qty' },
        revenue: { $sum: '$items.lineTotal' },
      },
    },
    { $sort: { revenue: -1, _id: 1 } },
    { $limit: limit },
    { $project: { _id: 0, productId: '$_id', name: 1, slug: 1, units: 1, revenue: 1 } },
  ]);
}

export async function orderStatusBreakdown() {
  const rows = await Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
  const counts = new Map(rows.map((row) => [row._id, row.count]));
  return ORDER_STATUSES.map((status) => ({ status, count: counts.get(status) ?? 0 }));
}

export function lowStockProducts(limit = 10) {
  return Product.find(LOW_STOCK)
    .select('name slug sku stock lowStockThreshold images')
    .sort({ stock: 1, name: 1 })
    .limit(limit);
}
