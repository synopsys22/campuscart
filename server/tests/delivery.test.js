import { describe, expect, it } from 'vitest';
import { Cart, Order, Product, User } from '../src/models/index.js';
import { addWorkingDays, estimateForPincode } from '../src/services/delivery.service.js';
import {
  advanceOrderTo,
  api,
  makeAdmin,
  makeProduct,
  makeUser,
  placeOrder,
  placePaidOrder,
  shippingAddress,
  useDatabase,
} from './support/helpers.js';

useDatabase();

const DAY_MS = 24 * 60 * 60 * 1000;

describe('delivery dates and fees', () => {
  it('is faster close to the Chennai warehouse and refuses pincodes no courier reaches', () => {
    const from = new Date('2026-11-02T06:00:00Z'); // A Monday in India
    const local = estimateForPincode('600001', from);
    const south = estimateForPincode('620015', from);
    const north = estimateForPincode('110042', from);
    expect(local).toMatchObject({ serviceable: true, standard: { days: 2 }, express: { days: 1 } });
    expect(south).toMatchObject({ serviceable: true, region: 'South India', standard: { days: 4 } });
    expect(north).toMatchObject({ serviceable: true, standard: { days: 6 }, express: { days: 3 } });
    expect(estimateForPincode('900001', from).serviceable).toBe(false);
  });

  it('skips Sundays when counting delivery days', () => {
    const saturday = new Date('2026-11-07T06:00:00Z');
    const nextWorkingDay = addWorkingDays(saturday, 1);
    expect(new Date(nextWorkingDay.getTime() + 5.5 * 3600 * 1000).getUTCDay()).toBe(1);
  });

  it('answers pincode checks for the product page', async () => {
    const ok = await api().get('/api/delivery/estimate?pincode=600017');
    expect(ok.body.data).toMatchObject({ serviceable: true, standard: { days: 2 } });
    const bad = await api().get('/api/delivery/estimate?pincode=12');
    expect(bad.status).toBe(400);
  });

  it('lists campus pickup points and time slots', async () => {
    const { body } = await api().get('/api/delivery/options');
    expect(body.data.pickupPoints.length).toBeGreaterThan(0);
    expect(body.data.pickupSlots.length).toBeGreaterThan(0);
    expect(body.data.fees).toMatchObject({ standard: 49, express: 99, freeShippingMin: 999 });
  });

  it('offers each delivery option with its fee in the cart', async () => {
    const { bearer } = await makeUser();
    const product = await makeProduct({ price: 500, mrp: 500 });
    await api().post('/api/cart/items').set('Authorization', bearer).send({ productId: product._id.toString() });
    const { body } = await api().get('/api/cart').set('Authorization', bearer);
    expect(body.data.pricing.deliveryOptions).toEqual([
      { id: 'standard', label: 'Standard delivery', fee: 49 },
      { id: 'express', label: 'Express delivery', fee: 99 },
      { id: 'pickup', label: 'Campus pickup', fee: 0 },
    ]);
  });
});

describe('placing orders with a delivery choice', () => {
  it('charges ₹99 for express even above the free-shipping amount, with an earlier date', async () => {
    const { bearer } = await makeUser();
    const standard = await placeOrder(bearer, [{ product: await makeProduct({ price: 1500, mrp: 1500 }) }]);
    const express = await placeOrder(bearer, [{ product: await makeProduct({ price: 1500, mrp: 1500 }) }], {
      delivery: { method: 'express' },
    });
    expect(standard.body.data).toMatchObject({ shippingFee: 0, total: 1500, delivery: { method: 'standard' } });
    expect(express.body.data).toMatchObject({ shippingFee: 99, total: 1599, delivery: { method: 'express' } });
    expect(new Date(express.body.data.estimatedDelivery) < new Date(standard.body.data.estimatedDelivery)).toBe(true);
  });

  it('places a free campus pickup order with no address', async () => {
    const { bearer } = await makeUser();
    const product = await makeProduct({ price: 300, mrp: 300 });
    await api().post('/api/cart/items').set('Authorization', bearer).send({ productId: product._id.toString() });
    const res = await api()
      .post('/api/orders')
      .set('Authorization', bearer)
      .send({ delivery: { method: 'pickup', pickupPoint: 'central-library', pickupSlot: '14-16' }, paymentMethod: 'COD' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      shippingFee: 0,
      total: 300,
      shippingAddress: null,
      delivery: { method: 'pickup', pickupPoint: 'Central Library entrance', pickupSlot: '2 PM to 4 PM' },
    });
  });

  it('needs a valid pickup point and slot for pickup, and an address otherwise', async () => {
    const { bearer } = await makeUser();
    const product = await makeProduct();
    await api().post('/api/cart/items').set('Authorization', bearer).send({ productId: product._id.toString() });
    const pickup = await api()
      .post('/api/orders')
      .set('Authorization', bearer)
      .send({ delivery: { method: 'pickup', pickupPoint: 'moon' }, paymentMethod: 'COD' });
    expect(pickup.status).toBe(400);
    expect(pickup.body.errors).toMatchObject({ 'delivery.pickupPoint': 'Choose a pickup point.', 'delivery.pickupSlot': 'Choose a pickup time.' });
    const noAddress = await api().post('/api/orders').set('Authorization', bearer).send({ paymentMethod: 'COD' });
    expect(noAddress.body.errors.address).toBe('Choose a delivery address.');
  });

  it('refuses a pincode no courier reaches and leaves the cart and stock alone', async () => {
    const { bearer, user } = await makeUser();
    const product = await makeProduct({ stock: 4 });
    const res = await placeOrder(bearer, [{ product }], { address: { ...shippingAddress, pincode: '900123' } });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/don't deliver to pincode 900123/);
    expect((await Product.findById(product._id)).stock).toBe(4);
    expect((await Cart.findOne({ user: user._id })).items).toHaveLength(1);
  });

  it('labels pickup steps for the pickup desk', async () => {
    const { bearer: admin } = await makeAdmin();
    const { bearer } = await makeUser();
    const product = await makeProduct();
    await api().post('/api/cart/items').set('Authorization', bearer).send({ productId: product._id.toString() });
    const { body } = await api()
      .post('/api/orders')
      .set('Authorization', bearer)
      .send({ delivery: { method: 'pickup', pickupPoint: 'cs-department', pickupSlot: '10-12' }, paymentMethod: 'COD' });
    await advanceOrderTo(admin, body.data._id, 'Delivered');
    const order = await Order.findById(body.data._id);
    expect(order.delivery.courier).toBe('CampusCart Campus Desk');
    expect(order.statusHistory.map((event) => event.note).slice(2)).toEqual([
      'Sent to CS Department office',
      'Ready at CS Department office, 10 AM to 12 PM',
      'Collected. Delivery code checked',
    ]);
  });
});

describe('public tracking', () => {
  it('shows the journey to anyone with the tracking number, without personal details', async () => {
    const { bearer: admin } = await makeAdmin();
    const { bearer } = await makeUser({ name: 'Private Person' });
    const { body } = await placeOrder(bearer, [{ product: await makeProduct(), qty: 2 }]);
    await advanceOrderTo(admin, body.data._id, 'Out for Delivery');
    const { trackingNumber } = (await Order.findById(body.data._id)).delivery;

    const res = await api().get(`/api/track/${trackingNumber.toLowerCase()}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      trackingNumber,
      courier: 'CampusCart Logistics',
      status: 'Out for Delivery',
      destination: 'Chennai, Tamil Nadu',
      itemCount: 2,
    });
    expect(res.body.data.events.map((event) => event.status)).toEqual(['Pending', 'Confirmed', 'Shipped', 'Out for Delivery']);
    expect(Object.keys(res.body.data)).not.toContain('code');
    expect(JSON.stringify(res.body)).not.toMatch(/Private Person|Room 204|user/);
  });

  it('explains an unknown or badly formed tracking number', async () => {
    expect((await api().get('/api/track/CCT0000000000')).status).toBe(404);
    const bad = await api().get('/api/track/hello');
    expect(bad.status).toBe(400);
  });
});

describe('returns', () => {
  const requestReturn = (bearer, id, body = { reason: 'Damaged or not working', comment: 'Screen flickers' }) =>
    api().post(`/api/orders/${id}/return`).set('Authorization', bearer).send(body);
  const decide = (bearer, id, body) => api().patch(`/api/orders/${id}/return`).set('Authorization', bearer).send(body);

  async function deliveredOrder({ paid = false } = {}) {
    const admin = await makeAdmin();
    const customer = await makeUser();
    const product = await makeProduct({ stock: 5, price: 600, mrp: 600 });
    const { body } = paid
      ? await placePaidOrder(customer.bearer, [{ product }])
      : await placeOrder(customer.bearer, [{ product }]);
    await advanceOrderTo(admin.bearer, body.data._id, 'Delivered');
    return { admin, customer, product, order: body.data };
  }

  it('lets the customer ask for a return within 7 days of delivery', async () => {
    const { customer, order } = await deliveredOrder();
    const detail = await api().get(`/api/orders/${order._id}`).set('Authorization', customer.bearer);
    const closes = new Date(detail.body.data.returnWindowEndsAt);
    expect(closes - Date.now()).toBeGreaterThan(6.9 * DAY_MS);

    const res = await requestReturn(customer.bearer, order._id);
    expect(res.status).toBe(200);
    expect(res.body.data.returnRequest).toMatchObject({ status: 'Requested', reason: 'Damaged or not working', comment: 'Screen flickers' });
    expect((await requestReturn(customer.bearer, order._id)).status).toBe(400);
  });

  it('refuses returns before delivery, after the window, and from other people', async () => {
    const { bearer } = await makeUser();
    const { body } = await placeOrder(bearer, [{ product: await makeProduct() }]);
    expect((await requestReturn(bearer, body.data._id)).body.message).toMatch(/only a delivered order/i);

    const late = await deliveredOrder();
    await Order.updateOne(
      { _id: late.order._id, 'statusHistory.status': 'Delivered' },
      { $set: { 'statusHistory.$.at': new Date(Date.now() - 8 * DAY_MS) } },
    );
    expect((await requestReturn(late.customer.bearer, late.order._id)).body.message).toMatch(/window has closed/);

    const stranger = await makeUser();
    expect((await requestReturn(stranger.bearer, late.order._id)).status).toBe(404);
    expect((await requestReturn(late.admin.bearer, late.order._id)).status).toBe(403);
  });

  it('restocks the item and refunds cash on delivery to the wallet when approved', async () => {
    const { admin, customer, product, order } = await deliveredOrder();
    await requestReturn(customer.bearer, order._id);
    const res = await decide(admin.bearer, order._id, { decision: 'approve' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      status: 'Returned',
      returnRequest: { status: 'Approved', refundAmount: 649 },
      payment: { status: 'Refunded', refundedTo: 'wallet' },
    });
    expect(res.body.data.statusHistory.at(-1).status).toBe('Returned');
    expect((await Product.findById(product._id)).stock).toBe(5);
    expect((await User.findById(customer.user._id)).walletBalance).toBe(649);
    expect((await decide(admin.bearer, order._id, { decision: 'approve' })).status).toBe(400);
  });

  it('refunds a card order back to the card when approved', async () => {
    const { admin, customer, order } = await deliveredOrder({ paid: true });
    await requestReturn(customer.bearer, order._id);
    const res = await decide(admin.bearer, order._id, { decision: 'approve' });
    expect(res.body.data.payment).toMatchObject({ status: 'Refunded', refundedTo: 'source' });
    expect((await User.findById(customer.user._id)).walletBalance).toBe(0);
  });

  it('needs a reason to reject, and keeps the order delivered', async () => {
    const { admin, customer, order } = await deliveredOrder();
    await requestReturn(customer.bearer, order._id);
    expect((await decide(admin.bearer, order._id, { decision: 'reject' })).body.errors.note).toMatch(/why/);
    const res = await decide(admin.bearer, order._id, { decision: 'reject', note: 'The seal was broken after delivery' });
    expect(res.body.data).toMatchObject({
      status: 'Delivered',
      returnRequest: { status: 'Rejected', resolutionNote: 'The seal was broken after delivery' },
    });
  });

  it('lets admins find returns waiting for a decision, and only admins decide', async () => {
    const { admin, customer, order } = await deliveredOrder();
    await requestReturn(customer.bearer, order._id);
    const list = await api().get('/api/orders?returnStatus=Requested').set('Authorization', admin.bearer);
    expect(list.body.meta.total).toBe(1);
    const summary = await api().get('/api/admin/analytics/summary').set('Authorization', admin.bearer);
    expect(summary.body.data.returnRequests).toBe(1);
    expect((await decide(customer.bearer, order._id, { decision: 'approve' })).status).toBe(403);
  });

  it('leaves returned orders out of revenue', async () => {
    const { admin, customer, order } = await deliveredOrder();
    const before = await api().get('/api/admin/analytics/summary').set('Authorization', admin.bearer);
    await requestReturn(customer.bearer, order._id);
    await decide(admin.bearer, order._id, { decision: 'approve' });
    const after = await api().get('/api/admin/analytics/summary').set('Authorization', admin.bearer);
    expect(after.body.data.revenue).toBe(before.body.data.revenue - order.total);
  });
});
