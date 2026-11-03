import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, inject } from 'vitest';
import { createApp } from '../../src/app.js';
import { Category, Coupon, Order, Product, User } from '../../src/models/index.js';
import { signToken } from '../../src/services/auth.service.js';

export const app = createApp();
export const api = () => request(app);

/** Gives a test file its own empty database, wiped before every test. */
export function useDatabase() {
  beforeAll(async () => {
    await mongoose.connect(inject('mongoUri'), { dbName: `test_${randomUUID()}` });
    await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
  });
  beforeEach(async () => {
    await Promise.all(Object.values(mongoose.models).map((model) => model.deleteMany({})));
  });
  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
}

let counter = 0;
const next = () => {
  counter += 1;
  return counter;
};

const cheapHash = bcrypt.hashSync('Password@1', 4);

export async function makeUser(overrides = {}) {
  const n = next();
  const user = await User.create({
    name: `User ${n}`,
    email: `user${n}@example.com`,
    passwordHash: cheapHash,
    ...overrides,
  });
  return { user, bearer: `Bearer ${signToken(user)}` };
}

export const makeAdmin = (overrides = {}) => makeUser({ role: 'admin', ...overrides });

export async function makeCategory(overrides = {}) {
  const n = next();
  return Category.create({ name: `Category ${n}`, slug: `category-${n}`, ...overrides });
}

export async function makeProduct(overrides = {}) {
  const n = next();
  const category = overrides.category || (await makeCategory())._id;
  return Product.create({
    name: `Product ${n}`,
    slug: `product-${n}`,
    sku: `SKU-${n}`,
    brand: 'Acme',
    description: 'A useful product for students.',
    price: 1000,
    mrp: 1200,
    stock: 10,
    ...overrides,
    category,
  });
}

export async function makeCoupon(overrides = {}) {
  const n = next();
  return Coupon.create({
    code: `CODE${n}`,
    description: 'Test coupon',
    type: 'percent',
    value: 10,
    ...overrides,
  });
}

export const shippingAddress = {
  label: 'Hostel',
  line1: 'Room 204, Block C',
  city: 'Chennai',
  state: 'Tamil Nadu',
  pincode: '600001',
};

/** Puts products in a user's cart and places the order through the real API. */
export async function placeOrder(bearer, items, extra = {}) {
  for (const { product, qty = 1 } of items) {
    await api()
      .post('/api/cart/items')
      .set('Authorization', bearer)
      .send({ productId: product._id.toString(), qty })
      .expect(200);
  }
  return api()
    .post('/api/orders')
    .set('Authorization', bearer)
    .send({ address: shippingAddress, paymentMethod: 'COD', ...extra });
}

/** The delivery code the customer would read from their order page. */
export async function deliveryCodeOf(orderId) {
  return (await Order.findById(orderId).select('+delivery.code')).delivery.code;
}

/**
 * Moves an order forward through each status until it reaches the target, reading the
 * delivery code the way the customer would hand it over.
 */
export async function advanceOrderTo(adminBearer, orderId, target) {
  const flow = ['Pending', 'Confirmed', 'Shipped', 'Out for Delivery', 'Delivered'];
  const { status: current } = await Order.findById(orderId);
  for (const status of flow.slice(flow.indexOf(current) + 1)) {
    const body = status === 'Delivered' ? { status, code: await deliveryCodeOf(orderId) } : { status };
    await api()
      .patch(`/api/orders/${orderId}/status`)
      .set('Authorization', adminBearer)
      .send(body)
      .expect(200);
    if (status === target) break;
  }
}

/** Pays for the current cart through the demo gateway with a test card. Returns the payment. */
export async function payByCard(bearer, { deliveryMethod = 'standard', number = '4111 1111 1111 1111', otp = '123456' } = {}) {
  const { body: created } = await api()
    .post('/api/payments')
    .set('Authorization', bearer)
    .send({ purpose: 'order', method: 'MOCK_CARD', deliveryMethod })
    .expect(201);
  const id = created.data._id;
  const { body: carded } = await api()
    .post(`/api/payments/${id}/card`)
    .set('Authorization', bearer)
    .send({ number, name: 'Test Student', expiry: '12/39', cvv: '123' })
    .expect(200);
  if (carded.data.status !== 'Awaiting OTP') return carded.data;
  const { body: verified } = await api().post(`/api/payments/${id}/otp`).set('Authorization', bearer).send({ otp });
  return verified.data;
}

/** Puts products in the cart, pays by test card and places the order. */
export async function placePaidOrder(bearer, items, { deliveryMethod = 'standard' } = {}) {
  for (const { product, qty = 1 } of items) {
    await api()
      .post('/api/cart/items')
      .set('Authorization', bearer)
      .send({ productId: product._id.toString(), qty })
      .expect(200);
  }
  const payment = await payByCard(bearer, { deliveryMethod });
  return api()
    .post('/api/orders')
    .set('Authorization', bearer)
    .send({ address: shippingAddress, delivery: { method: deliveryMethod }, paymentMethod: 'MOCK_CARD', paymentId: payment._id });
}
