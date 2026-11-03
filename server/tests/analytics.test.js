import { describe, expect, it } from 'vitest';
import { Order } from '../src/models/index.js';
import {
  advanceOrderTo,
  api,
  makeAdmin,
  makeCategory,
  makeProduct,
  makeUser,
  placeOrder,
  useDatabase,
} from './support/helpers.js';

useDatabase();

const get = (bearer, path) => api().get(`/api/admin/analytics/${path}`).set('Authorization', bearer);

/** Two live orders worth 2000 and 1500, and one cancelled order that must not count. */
async function scenario() {
  const admin = await makeAdmin();
  const hardware = await makeCategory({ name: 'Hardware', slug: 'hardware' });
  const books = await makeCategory({ name: 'Books', slug: 'books' });
  const board = await makeProduct({ name: 'Board', category: hardware._id, price: 1000, mrp: 1000, stock: 50 });
  const book = await makeProduct({ name: 'Book', category: books._id, price: 1500, mrp: 1500, stock: 50 });
  const cancelled = await makeProduct({ name: 'Cancelled item', category: books._id, price: 9000, mrp: 9000, stock: 50 });

  const buyerOne = await makeUser();
  const buyerTwo = await makeUser();
  const first = await placeOrder(buyerOne.bearer, [{ product: board, qty: 2 }]);
  await advanceOrderTo(admin.bearer, first.body.data._id, 'Delivered');
  await placeOrder(buyerTwo.bearer, [{ product: book }]);
  const dropped = await placeOrder(buyerTwo.bearer, [{ product: cancelled }]);
  await api()
    .post(`/api/orders/${dropped.body.data._id}/cancel`)
    .set('Authorization', buyerTwo.bearer)
    .send({})
    .expect(200);
  return { bearer: admin.bearer };
}

describe('analytics access', () => {
  it('is blocked for students', async () => {
    const { bearer } = await makeUser();
    expect((await get(bearer, 'summary')).status).toBe(403);
  });
});

describe('analytics figures', () => {
  it('summarizes revenue and excludes cancelled orders', async () => {
    const { bearer } = await scenario();
    const { body } = await get(bearer, 'summary');
    expect(body.data).toMatchObject({
      revenue: 3500,
      orders: 2,
      averageOrderValue: 1750,
      customers: 2,
      pendingOrders: 1,
    });
  });

  it('reports zero, not an error, with no orders', async () => {
    const { bearer } = await makeAdmin();
    const { body } = await get(bearer, 'summary');
    expect(body.data).toMatchObject({ revenue: 0, orders: 0, averageOrderValue: 0 });
  });

  it('returns one row per day, filling days with no sales', async () => {
    const { bearer } = await scenario();
    const { body } = await get(bearer, 'revenue?range=7d');
    expect(body.data).toHaveLength(7);
    expect(body.data.at(-1)).toMatchObject({ revenue: 3500, orders: 2 });
    expect(body.data[0]).toMatchObject({ revenue: 0, orders: 0 });
  });

  it('leaves out orders older than the range', async () => {
    const { bearer } = await scenario();
    // Goes straight to the driver because Mongoose treats createdAt as read-only.
    await Order.collection.updateMany({}, { $set: { createdAt: new Date(Date.now() - 20 * 86400000) } });
    const week = await get(bearer, 'revenue?range=7d');
    expect(week.body.data.reduce((sum, row) => sum + row.revenue, 0)).toBe(0);
    const month = await get(bearer, 'revenue?range=30d');
    expect(month.body.data.reduce((sum, row) => sum + row.revenue, 0)).toBe(3500);
  });

  it('rejects an unknown range', async () => {
    const { bearer } = await makeAdmin();
    expect((await get(bearer, 'revenue?range=1y')).status).toBe(400);
  });

  it('splits sales by category', async () => {
    const { bearer } = await scenario();
    const { body } = await get(bearer, 'category-sales');
    expect(body.data).toEqual([
      { category: 'Hardware', revenue: 2000, units: 2 },
      { category: 'Books', revenue: 1500, units: 1 },
    ]);
  });

  it('ranks top products by revenue', async () => {
    const { bearer } = await scenario();
    const { body } = await get(bearer, 'top-products');
    expect(body.data.map((row) => row.name)).toEqual(['Board', 'Book']);
    expect(body.data[0]).toMatchObject({ units: 2, revenue: 2000 });
  });

  it('counts orders in every status, including zeros', async () => {
    const { bearer } = await scenario();
    const { body } = await get(bearer, 'order-status');
    const counts = Object.fromEntries(body.data.map((row) => [row.status, row.count]));
    expect(counts).toEqual({
      Pending: 1,
      Confirmed: 0,
      Shipped: 0,
      'Out for Delivery': 0,
      Delivered: 1,
      Cancelled: 1,
      Returned: 0,
    });
  });

  it('lists low-stock products, lowest first, skipping inactive ones', async () => {
    const { bearer } = await makeAdmin();
    await makeProduct({ name: 'Two left', stock: 2, lowStockThreshold: 5 });
    await makeProduct({ name: 'Sold out', stock: 0, lowStockThreshold: 5 });
    await makeProduct({ name: 'Plenty', stock: 50, lowStockThreshold: 5 });
    await makeProduct({ name: 'Inactive', stock: 1, lowStockThreshold: 5, isActive: false });
    const { body } = await get(bearer, 'low-stock');
    expect(body.data.map((row) => row.name)).toEqual(['Sold out', 'Two left']);
  });
});
