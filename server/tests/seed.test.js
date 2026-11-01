import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { PROJECT_ROOT } from '../src/config/env.js';
import { Category, Coupon, Kit, Order, Product, Review, Setup, User } from '../src/models/index.js';
import { nextOrderNumber } from '../src/services/order.service.js';
import { ensureSeeded, seedDatabase } from '../seed/seed.js';
import { api, useDatabase } from './support/helpers.js';

useDatabase();

const login = (email, password) => api().post('/api/auth/login').send({ email, password });
const imageExists = (url) => fs.existsSync(path.join(PROJECT_ROOT, 'client', 'public', url));

describe('seedDatabase', () => {
  beforeEach(async () => {
    await seedDatabase();
  });

  it('creates a full catalog across all categories', async () => {
    expect(await Category.countDocuments()).toBe(11);
    expect(await Product.countDocuments()).toBeGreaterThanOrEqual(50);
    for (const category of await Category.find()) {
      expect(await Product.countDocuments({ category: category._id })).toBeGreaterThan(0);
    }
  });

  it('gives every product valid pricing, specs and an image that exists', async () => {
    for (const product of await Product.find()) {
      expect(product.price, product.name).toBeLessThanOrEqual(product.mrp);
      expect(product.price, product.name).toBeGreaterThan(0);
      expect(product.specs.length, product.name).toBeGreaterThan(0);
      expect(imageExists(product.images[0]), product.images[0]).toBe(true);
    }
  });

  it('has low-stock and sold-out products, for the demo', async () => {
    expect(await Product.countDocuments({ stock: 0 })).toBeGreaterThan(0);
    const low = await Product.countDocuments({
      stock: { $gt: 0 },
      $expr: { $lte: ['$stock', '$lowStockThreshold'] },
    });
    expect(low).toBeGreaterThan(0);
  });

  it('offers a product for every setup slot', async () => {
    const { body } = await api().get('/api/setups/slots');
    for (const slot of body.data) expect(slot.products.length, slot.slot).toBeGreaterThan(0);
  });

  it('creates working demo accounts', async () => {
    const admin = await login('admin@campuscart.dev', 'Admin@123');
    expect(admin.body.data.user.role).toBe('admin');
    const student = await login('student@campuscart.dev', 'Student@123');
    expect(student.body.data.user.role).toBe('student');
  });

  it('gives the demo student one order in every status and an item awaiting review', async () => {
    const student = await User.findOne({ email: 'student@campuscart.dev' });
    const statuses = await Order.distinct('status', { user: student._id });
    expect(statuses.sort()).toEqual(['Cancelled', 'Confirmed', 'Delivered', 'Pending', 'Shipped']);

    const delivered = await Order.find({ user: student._id, status: 'Delivered' });
    const bought = delivered.flatMap((order) => order.items.map((item) => item.product.toString()));
    const reviewed = await Review.distinct('product', { user: student._id });
    const awaiting = bought.filter((id) => !reviewed.some((reviewedId) => reviewedId.equals(id)));
    expect(awaiting.length).toBeGreaterThan(0);
  });

  it('spreads orders over 90 days with a status history ending in the current status', async () => {
    const orders = await Order.find();
    expect(orders.length).toBeGreaterThanOrEqual(50);
    const ages = orders.map((order) => (Date.now() - order.createdAt) / 86400000);
    expect(Math.max(...ages)).toBeGreaterThan(60);
    expect(Math.max(...ages)).toBeLessThanOrEqual(91);
    for (const order of orders) {
      expect(order.statusHistory.at(-1).status, order.orderNumber).toBe(order.status);
      const lineSum = order.items.reduce((sum, item) => sum + item.lineTotal, 0);
      expect(order.subtotal, order.orderNumber).toBe(lineSum);
      expect(order.total, order.orderNumber).toBe(order.subtotal - order.discount + order.shippingFee);
    }
  });

  it('only has reviews backed by the same user delivered order', async () => {
    const reviews = await Review.find();
    expect(reviews.length).toBeGreaterThanOrEqual(50);
    for (const review of reviews) {
      const order = await Order.findById(review.order);
      expect(order.status).toBe('Delivered');
      expect(order.user.equals(review.user)).toBe(true);
      expect(order.items.some((item) => item.product.equals(review.product))).toBe(true);
    }
  });

  it('stores product ratings that match the reviews', async () => {
    const reviewed = await Review.distinct('product');
    for (const id of reviewed) {
      const reviews = await Review.find({ product: id });
      const product = await Product.findById(id);
      const average = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
      expect(product.ratingCount).toBe(reviews.length);
      expect(product.ratingAvg).toBe(Math.round(average * 10) / 10);
    }
  });

  it('sets soldCount from non-cancelled orders', async () => {
    const orders = await Order.find({ status: { $ne: 'Cancelled' } });
    const units = new Map();
    for (const order of orders) {
      for (const item of order.items) {
        const key = item.product.toString();
        units.set(key, (units.get(key) ?? 0) + item.qty);
      }
    }
    for (const product of await Product.find()) {
      expect(product.soldCount, product.name).toBe(units.get(product._id.toString()) ?? 0);
    }
  });

  it('creates kits, coupons and saved setups', async () => {
    expect(await Kit.countDocuments()).toBe(6);
    expect(await Coupon.countDocuments()).toBe(5);
    expect(await Setup.countDocuments()).toBe(2);
    expect((await api().post('/api/auth/login').send({ email: 'nobody@x.dev', password: 'x' })).status).toBe(401);
    const expired = await Coupon.findOne({ code: 'EXPIRED20' });
    expect(expired.expiresAt.getTime()).toBeLessThan(Date.now());
    for (const kit of await Kit.find()) expect(imageExists(kit.image), kit.image).toBe(true);
  });

  it('continues order numbers after the seeded ones', async () => {
    const numbers = (await Order.find().select('orderNumber')).map((order) => order.orderNumber);
    const fresh = await nextOrderNumber();
    expect(numbers).not.toContain(fresh);
  });

  it('wipes old data when run again', async () => {
    const before = await Product.countDocuments();
    await seedDatabase();
    expect(await Product.countDocuments()).toBe(before);
  });
});

describe('ensureSeeded', () => {
  it('seeds an empty database', async () => {
    expect(await ensureSeeded()).toBe(true);
    expect(await Product.countDocuments()).toBeGreaterThan(0);
  });

  it('leaves existing data alone', async () => {
    await seedDatabase();
    await Product.updateMany({}, { stock: 123 });
    expect(await ensureSeeded()).toBe(false);
    expect((await Product.findOne()).stock).toBe(123);
  });
});
