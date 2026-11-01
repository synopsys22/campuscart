import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, inject } from 'vitest';
import { createApp } from '../../src/app.js';
import { Category, Coupon, Product, User } from '../../src/models/index.js';
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

/** Moves an order forward through each status until it reaches the target. */
export async function advanceOrderTo(adminBearer, orderId, target) {
  const flow = ['Confirmed', 'Shipped', 'Delivered'];
  for (const status of flow) {
    await api()
      .patch(`/api/orders/${orderId}/status`)
      .set('Authorization', adminBearer)
      .send({ status })
      .expect(200);
    if (status === target) break;
  }
}
