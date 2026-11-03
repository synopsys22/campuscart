import { describe, expect, it } from 'vitest';
import { Cart, Coupon, Payment, Product } from '../src/models/index.js';
import {
  advanceOrderTo,
  api,
  deliveryCodeOf,
  makeAdmin,
  makeCoupon,
  makeProduct,
  makeUser,
  placeOrder,
  placePaidOrder,
  shippingAddress,
  useDatabase,
} from './support/helpers.js';

useDatabase();

const stockOf = async (product) => (await Product.findById(product._id)).stock;

describe('placing an order', () => {
  it('creates an order with correct totals and a snapshot of each item', async () => {
    const { bearer } = await makeUser();
    const product = await makeProduct({ name: 'Arduino', price: 400, mrp: 500, stock: 5 });
    const res = await placeOrder(bearer, [{ product, qty: 2 }]);
    expect(res.status).toBe(201);
    const order = res.body.data;
    expect(order.orderNumber).toMatch(/^CC-\d{4}-\d{6}$/);
    expect(order.status).toBe('Pending');
    expect(order.subtotal).toBe(800);
    expect(order.shippingFee).toBe(49);
    expect(order.total).toBe(849);
    expect(order.items[0]).toMatchObject({ name: 'Arduino', price: 400, qty: 2, lineTotal: 800 });
    expect(order.shippingAddress.city).toBe('Chennai');
    expect(order.statusHistory.map((h) => h.status)).toEqual(['Pending']);
  });

  it('reduces stock, increases soldCount and clears the cart', async () => {
    const { bearer, user } = await makeUser();
    const product = await makeProduct({ stock: 5 });
    await placeOrder(bearer, [{ product, qty: 2 }]);
    const fresh = await Product.findById(product._id);
    expect(fresh.stock).toBe(3);
    expect(fresh.soldCount).toBe(2);
    const cart = await Cart.findOne({ user: user._id });
    expect(cart.items).toHaveLength(0);
    expect(cart.couponCode).toBeNull();
  });

  it('keeps old order details after the product is edited', async () => {
    const { bearer } = await makeUser();
    const product = await makeProduct({ name: 'Old Name', price: 400, mrp: 500 });
    const { body } = await placeOrder(bearer, [{ product }]);
    product.name = 'New Name';
    product.price = 450;
    await product.save();
    const order = await api().get(`/api/orders/${body.data._id}`).set('Authorization', bearer);
    expect(order.body.data.items[0]).toMatchObject({ name: 'Old Name', price: 400 });
  });

  it('rejects an empty cart', async () => {
    const { bearer } = await makeUser();
    const res = await api()
      .post('/api/orders')
      .set('Authorization', bearer)
      .send({ address: shippingAddress, paymentMethod: 'COD' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/cart is empty/i);
  });

  it('requires a valid address and payment method', async () => {
    const { bearer } = await makeUser();
    await api()
      .post('/api/cart/items')
      .set('Authorization', bearer)
      .send({ productId: (await makeProduct())._id.toString() });
    const res = await api()
      .post('/api/orders')
      .set('Authorization', bearer)
      .send({ address: { line1: '' }, paymentMethod: 'BITCOIN' });
    expect(res.status).toBe(400);
  });

  it('records a paid card payment with a transaction reference and the card it used', async () => {
    const { bearer } = await makeUser();
    const res = await placePaidOrder(bearer, [{ product: await makeProduct() }]);
    expect(res.status).toBe(201);
    expect(res.body.data.payment.method).toBe('MOCK_CARD');
    expect(res.body.data.payment.status).toBe('Paid');
    expect(res.body.data.payment.transactionRef).toMatch(/^MOCK-/);
    expect(res.body.data.payment.detail).toBe('Visa ending 1111');
  });

  it('refuses a card or UPI order without a completed payment', async () => {
    const { bearer } = await makeUser();
    const res = await placeOrder(bearer, [{ product: await makeProduct() }], { paymentMethod: 'MOCK_UPI' });
    expect(res.status).toBe(400);
    expect(res.body.errors.paymentId).toMatch(/complete the payment/i);
  });

  it('leaves Cash on Delivery unpaid with no reference', async () => {
    const { bearer } = await makeUser();
    const res = await placeOrder(bearer, [{ product: await makeProduct() }]);
    expect(res.body.data.payment.status).toBe('Pending');
    expect(res.body.data.payment.transactionRef).toBeFalsy();
  });

  it('applies the coupon, stores it on the order and counts its use', async () => {
    const { bearer } = await makeUser();
    const coupon = await makeCoupon({ code: 'TEN', value: 10 });
    const product = await makeProduct({ price: 2000, mrp: 2000 });
    await api()
      .post('/api/cart/items')
      .set('Authorization', bearer)
      .send({ productId: product._id.toString() });
    await api().post('/api/cart/coupon').set('Authorization', bearer).send({ code: 'TEN' }).expect(200);
    const res = await api()
      .post('/api/orders')
      .set('Authorization', bearer)
      .send({ address: shippingAddress, paymentMethod: 'COD' });
    expect(res.body.data).toMatchObject({ couponCode: 'TEN', discount: 200, total: 1800 });
    expect((await Coupon.findById(coupon._id)).usedCount).toBe(1);
  });
});

describe('stock safety', () => {
  it('sells the last unit to exactly one of two competing buyers', async () => {
    const product = await makeProduct({ stock: 1 });
    const buyers = await Promise.all([makeUser(), makeUser()]);
    for (const { bearer } of buyers) {
      await api()
        .post('/api/cart/items')
        .set('Authorization', bearer)
        .send({ productId: product._id.toString() })
        .expect(200);
    }
    const results = await Promise.all(
      buyers.map(({ bearer }) =>
        api()
          .post('/api/orders')
          .set('Authorization', bearer)
          .send({ address: shippingAddress, paymentMethod: 'COD' }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([201, 400]);
    expect(await stockOf(product)).toBe(0);
  });

  it('puts back already-reserved stock when a later item fails', async () => {
    const { bearer, user } = await makeUser();
    const available = await makeProduct({ stock: 5 });
    const scarce = await makeProduct({ stock: 5 });
    for (const product of [available, scarce]) {
      await api()
        .post('/api/cart/items')
        .set('Authorization', bearer)
        .send({ productId: product._id.toString(), qty: 2 });
    }
    scarce.stock = 1;
    await scarce.save();
    const res = await api()
      .post('/api/orders')
      .set('Authorization', bearer)
      .send({ address: shippingAddress, paymentMethod: 'COD' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/only 1 left/i);
    expect(await stockOf(available)).toBe(5);
    expect(await stockOf(scarce)).toBe(1);
    expect((await Cart.findOne({ user: user._id })).items).toHaveLength(2);
  });

  it('does not exceed a coupon usage limit under competition', async () => {
    await makeCoupon({ code: 'LAST', usageLimit: 1 });
    const product = await makeProduct({ price: 2000, mrp: 2000, stock: 10 });
    const buyers = await Promise.all([makeUser(), makeUser()]);
    for (const { bearer } of buyers) {
      await api()
        .post('/api/cart/items')
        .set('Authorization', bearer)
        .send({ productId: product._id.toString() });
      await api().post('/api/cart/coupon').set('Authorization', bearer).send({ code: 'LAST' }).expect(200);
    }
    const results = await Promise.all(
      buyers.map(({ bearer }) =>
        api()
          .post('/api/orders')
          .set('Authorization', bearer)
          .send({ address: shippingAddress, paymentMethod: 'COD' }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([201, 400]);
    expect((await Coupon.findOne({ code: 'LAST' })).usedCount).toBe(1);
    expect(await stockOf(product)).toBe(9);
  });
});

describe('order access', () => {
  it('lists only my own orders, newest first', async () => {
    const me = await makeUser();
    const other = await makeUser();
    const first = await placeOrder(me.bearer, [{ product: await makeProduct() }]);
    await placeOrder(other.bearer, [{ product: await makeProduct() }]);
    const second = await placeOrder(me.bearer, [{ product: await makeProduct() }]);
    const res = await api().get('/api/orders/my').set('Authorization', me.bearer);
    expect(res.body.data.map((o) => o._id)).toEqual([second.body.data._id, first.body.data._id]);
  });

  it("stops a student opening someone else's order", async () => {
    const owner = await makeUser();
    const other = await makeUser();
    const { body } = await placeOrder(owner.bearer, [{ product: await makeProduct() }]);
    const res = await api().get(`/api/orders/${body.data._id}`).set('Authorization', other.bearer);
    expect(res.status).toBe(404);
  });

  it('lets an admin open any order and filter the full list', async () => {
    const { bearer: admin } = await makeAdmin();
    const owner = await makeUser({ name: 'Priya' });
    const { body } = await placeOrder(owner.bearer, [{ product: await makeProduct() }]);
    const one = await api().get(`/api/orders/${body.data._id}`).set('Authorization', admin);
    expect(one.status).toBe(200);

    const pending = await api().get('/api/orders?status=Pending').set('Authorization', admin);
    expect(pending.body.meta.total).toBe(1);
    expect(pending.body.data[0].user.name).toBe('Priya');
    const shipped = await api().get('/api/orders?status=Shipped').set('Authorization', admin);
    expect(shipped.body.meta.total).toBe(0);
    const search = await api().get(`/api/orders?search=${body.data.orderNumber}`).set('Authorization', admin);
    expect(search.body.meta.total).toBe(1);
  });

  it('blocks students from the admin order list', async () => {
    const { bearer } = await makeUser();
    expect((await api().get('/api/orders').set('Authorization', bearer)).status).toBe(403);
  });
});

describe('order status flow', () => {
  const setStatus = (bearer, id, status, note) =>
    api().patch(`/api/orders/${id}/status`).set('Authorization', bearer).send({ status, note });

  it('moves one step at a time and records history', async () => {
    const { bearer: admin } = await makeAdmin();
    const { bearer } = await makeUser();
    const { body } = await placeOrder(bearer, [{ product: await makeProduct() }]);
    await advanceOrderTo(admin, body.data._id, 'Delivered');
    const order = await api().get(`/api/orders/${body.data._id}`).set('Authorization', bearer);
    expect(order.body.data.status).toBe('Delivered');
    expect(order.body.data.statusHistory.map((h) => h.status)).toEqual([
      'Pending',
      'Confirmed',
      'Shipped',
      'Out for Delivery',
      'Delivered',
    ]);
  });

  it('gives a shipped order a courier and tracking number, and an out-for-delivery order a code', async () => {
    const { bearer: admin } = await makeAdmin();
    const { bearer } = await makeUser();
    const { body } = await placeOrder(bearer, [{ product: await makeProduct() }]);
    await advanceOrderTo(admin, body.data._id, 'Shipped');
    const shipped = await api().get(`/api/orders/${body.data._id}`).set('Authorization', bearer);
    expect(shipped.body.data.delivery.trackingNumber).toMatch(/^CCT\d{10}$/);
    expect(shipped.body.data.delivery.courier).toBe('CampusCart Logistics');
    expect(shipped.body.data.statusHistory.at(-1).note).toBe('Handed to CampusCart Logistics');
    expect(shipped.body.data.delivery.code).toBeNull();

    await advanceOrderTo(admin, body.data._id, 'Out for Delivery');
    const mine = await api().get(`/api/orders/${body.data._id}`).set('Authorization', bearer);
    expect(mine.body.data.delivery.code).toMatch(/^\d{4}$/);
    expect(mine.body.data.statusHistory.at(-1).note).toBe('Out for delivery in Chennai');
  });

  it('hides the delivery code from the admin and needs it to mark the order delivered', async () => {
    const { bearer: admin } = await makeAdmin();
    const { bearer } = await makeUser();
    const { body } = await placeOrder(bearer, [{ product: await makeProduct() }]);
    await advanceOrderTo(admin, body.data._id, 'Out for Delivery');

    const asAdmin = await api().get(`/api/orders/${body.data._id}`).set('Authorization', admin);
    expect(asAdmin.body.data.delivery.code).toBeUndefined();
    const listed = await api().get('/api/orders').set('Authorization', admin);
    expect(listed.body.data[0].delivery.code).toBeUndefined();

    const code = await deliveryCodeOf(body.data._id);
    const wrong = code === '1111' ? '2222' : '1111';
    const noCode = await setStatus(admin, body.data._id, 'Delivered');
    expect(noCode.status).toBe(400);
    expect(noCode.body.message).toMatch(/delivery code/i);
    const badCode = await api()
      .patch(`/api/orders/${body.data._id}/status`)
      .set('Authorization', admin)
      .send({ status: 'Delivered', code: wrong });
    expect(badCode.status).toBe(400);
    expect(badCode.body.message).toMatch(/doesn't match/);

    const good = await api()
      .patch(`/api/orders/${body.data._id}/status`)
      .set('Authorization', admin)
      .send({ status: 'Delivered', code });
    expect(good.status).toBe(200);
    expect(good.body.data.status).toBe('Delivered');
    expect(await deliveryCodeOf(body.data._id)).toBeNull();
  });

  it('rejects skipping a step or moving backwards', async () => {
    const { bearer: admin } = await makeAdmin();
    const { bearer } = await makeUser();
    const { body } = await placeOrder(bearer, [{ product: await makeProduct() }]);
    expect((await setStatus(admin, body.data._id, 'Shipped')).status).toBe(400);
    await setStatus(admin, body.data._id, 'Confirmed');
    expect((await setStatus(admin, body.data._id, 'Pending')).status).toBe(400);
  });

  it('marks Cash on Delivery as paid on delivery and records the cash as a payment', async () => {
    const { bearer: admin } = await makeAdmin();
    const { bearer } = await makeUser();
    const { body } = await placeOrder(bearer, [{ product: await makeProduct() }]);
    await advanceOrderTo(admin, body.data._id, 'Delivered');
    const order = await api().get(`/api/orders/${body.data._id}`).set('Authorization', bearer);
    expect(order.body.data.payment.status).toBe('Paid');
    expect(order.body.data.payment.transactionRef).toMatch(/^COD-/);
    const record = await Payment.findOne({ order: body.data._id });
    expect(record).toMatchObject({ method: 'COD', status: 'Succeeded', amount: body.data.total });
  });

  it('blocks students from changing status', async () => {
    const { bearer } = await makeUser();
    const { body } = await placeOrder(bearer, [{ product: await makeProduct() }]);
    expect((await setStatus(bearer, body.data._id, 'Confirmed')).status).toBe(403);
  });
});

describe('cancelling an order', () => {
  const cancel = (bearer, id, reason = 'Changed my mind') =>
    api().post(`/api/orders/${id}/cancel`).set('Authorization', bearer).send({ reason });

  it('restores stock and coupon usage, and records the reason', async () => {
    const { bearer } = await makeUser();
    const coupon = await makeCoupon({ code: 'BACK', usageLimit: 3 });
    const product = await makeProduct({ price: 2000, mrp: 2000, stock: 5 });
    await api()
      .post('/api/cart/items')
      .set('Authorization', bearer)
      .send({ productId: product._id.toString(), qty: 2 });
    await api().post('/api/cart/coupon').set('Authorization', bearer).send({ code: 'BACK' });
    const { body } = await api()
      .post('/api/orders')
      .set('Authorization', bearer)
      .send({ address: shippingAddress, paymentMethod: 'COD' });

    const res = await cancel(bearer, body.data._id);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('Cancelled');
    expect(res.body.data.cancelReason).toBe('Changed my mind');

    const fresh = await Product.findById(product._id);
    expect(fresh.stock).toBe(5);
    expect(fresh.soldCount).toBe(0);
    expect((await Coupon.findById(coupon._id)).usedCount).toBe(0);
  });

  it('refunds a card payment back to the card', async () => {
    const { bearer } = await makeUser();
    const { body } = await placePaidOrder(bearer, [{ product: await makeProduct() }]);
    const res = await cancel(bearer, body.data._id);
    expect(res.body.data.payment).toMatchObject({ status: 'Refunded', refundedTo: 'source' });
    const record = await Payment.findById(body.data.payment.record);
    expect(record.status).toBe('Refunded');
    expect(record.refund).toMatchObject({ amount: body.data.total, to: 'source' });
  });

  it('lets a student cancel while Confirmed but not once Shipped', async () => {
    const { bearer: admin } = await makeAdmin();
    const { bearer } = await makeUser();
    const confirmed = await placeOrder(bearer, [{ product: await makeProduct() }]);
    await advanceOrderTo(admin, confirmed.body.data._id, 'Confirmed');
    expect((await cancel(bearer, confirmed.body.data._id)).status).toBe(200);

    const shipped = await placeOrder(bearer, [{ product: await makeProduct() }]);
    await advanceOrderTo(admin, shipped.body.data._id, 'Shipped');
    const res = await cancel(bearer, shipped.body.data._id);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/can no longer be cancelled/i);
  });

  it('does not restore stock twice when cancelled twice', async () => {
    const { bearer } = await makeUser();
    const product = await makeProduct({ stock: 5 });
    const { body } = await placeOrder(bearer, [{ product, qty: 2 }]);
    await cancel(bearer, body.data._id);
    expect((await cancel(bearer, body.data._id)).status).toBe(400);
    expect(await stockOf(product)).toBe(5);
  });

  it("stops a student cancelling someone else's order", async () => {
    const owner = await makeUser();
    const other = await makeUser();
    const { body } = await placeOrder(owner.bearer, [{ product: await makeProduct() }]);
    expect((await cancel(other.bearer, body.data._id)).status).toBe(404);
  });

  it('lets an admin cancel before shipping using the status route', async () => {
    const { bearer: admin } = await makeAdmin();
    const { bearer } = await makeUser();
    const product = await makeProduct({ stock: 5 });
    const { body } = await placeOrder(bearer, [{ product }]);
    const res = await api()
      .patch(`/api/orders/${body.data._id}/status`)
      .set('Authorization', admin)
      .send({ status: 'Cancelled', note: 'Out of stock at the warehouse' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('Cancelled');
    expect(await stockOf(product)).toBe(5);
  });
});
