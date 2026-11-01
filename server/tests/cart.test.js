import { describe, expect, it } from 'vitest';
import {
  api,
  makeCoupon,
  makeProduct,
  makeUser,
  placeOrder,
  shippingAddress,
  useDatabase,
} from './support/helpers.js';

useDatabase();

const add = (bearer, product, qty = 1) =>
  api().post('/api/cart/items').set('Authorization', bearer).send({ productId: product._id.toString(), qty });
const getCart = async (bearer) => (await api().get('/api/cart').set('Authorization', bearer)).body.data;
const applyCoupon = (bearer, code) =>
  api().post('/api/cart/coupon').set('Authorization', bearer).send({ code });

describe('cart items', () => {
  it('requires login', async () => {
    expect((await api().get('/api/cart')).status).toBe(401);
  });

  it('starts empty', async () => {
    const { bearer } = await makeUser();
    const cart = await getCart(bearer);
    expect(cart.items).toEqual([]);
    expect(cart.pricing).toMatchObject({ subtotal: 0, shippingFee: 0, total: 0, itemCount: 0 });
  });

  it('adds items and merges repeat adds', async () => {
    const { bearer } = await makeUser();
    const product = await makeProduct({ price: 300 });
    await add(bearer, product, 1);
    const res = await add(bearer, product, 2);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].qty).toBe(3);
    expect(res.body.data.items[0].lineTotal).toBe(900);
  });

  it('refuses more than the available stock', async () => {
    const { bearer } = await makeUser();
    const product = await makeProduct({ stock: 2 });
    const res = await add(bearer, product, 3);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/only 2 left/i);
  });

  it('refuses a merged quantity above stock', async () => {
    const { bearer } = await makeUser();
    const product = await makeProduct({ stock: 2 });
    await add(bearer, product, 2);
    const res = await add(bearer, product, 1);
    expect(res.status).toBe(400);
  });

  it('refuses an inactive product', async () => {
    const { bearer } = await makeUser();
    const product = await makeProduct({ isActive: false });
    expect((await add(bearer, product)).status).toBe(404);
  });

  it('changes quantity and removes items', async () => {
    const { bearer } = await makeUser();
    const product = await makeProduct({ price: 100 });
    await add(bearer, product);
    const changed = await api()
      .patch(`/api/cart/items/${product._id}`)
      .set('Authorization', bearer)
      .send({ qty: 4 });
    expect(changed.body.data.pricing.subtotal).toBe(400);
    const removed = await api().delete(`/api/cart/items/${product._id}`).set('Authorization', bearer);
    expect(removed.body.data.items).toEqual([]);
  });

  it('rejects a zero quantity', async () => {
    const { bearer } = await makeUser();
    const product = await makeProduct();
    await add(bearer, product);
    const res = await api().patch(`/api/cart/items/${product._id}`).set('Authorization', bearer).send({ qty: 0 });
    expect(res.status).toBe(400);
  });

  it('clears the cart', async () => {
    const { bearer } = await makeUser();
    await add(bearer, await makeProduct());
    const res = await api().delete('/api/cart').set('Authorization', bearer);
    expect(res.body.data.items).toEqual([]);
  });

  it('flags an item that went out of stock after it was added', async () => {
    const { bearer } = await makeUser();
    const product = await makeProduct({ stock: 5 });
    await add(bearer, product, 3);
    product.stock = 1;
    await product.save();
    const cart = await getCart(bearer);
    expect(cart.items[0].available).toBe(false);
    expect(cart.items[0].issue).toMatch(/only 1 left/i);
    expect(cart.canCheckout).toBe(false);
  });
});

describe('cart pricing', () => {
  it('charges ₹49 shipping below ₹999 and nothing from ₹999', async () => {
    const { bearer } = await makeUser();
    const below = await makeProduct({ price: 998, mrp: 998 });
    await add(bearer, below);
    expect((await getCart(bearer)).pricing).toMatchObject({ shippingFee: 49, total: 1047 });

    const { bearer: other } = await makeUser();
    const exact = await makeProduct({ price: 999, mrp: 999 });
    await add(other, exact);
    expect((await getCart(other)).pricing).toMatchObject({ shippingFee: 0, total: 999 });
  });

  it('uses the current price, not the price when added', async () => {
    const { bearer } = await makeUser();
    const product = await makeProduct({ price: 500, mrp: 800 });
    await add(bearer, product);
    product.price = 700;
    await product.save();
    expect((await getCart(bearer)).pricing.subtotal).toBe(700);
  });
});

describe('coupons on the cart', () => {
  const setup = async (price = 1000) => {
    const { bearer, user } = await makeUser();
    const product = await makeProduct({ price, mrp: price, stock: 50 });
    await add(bearer, product);
    return { bearer, user, product };
  };

  it('applies a percent coupon', async () => {
    const { bearer } = await setup(2000);
    await makeCoupon({ code: 'STUDENT10', type: 'percent', value: 10 });
    const res = await applyCoupon(bearer, 'student10');
    expect(res.status).toBe(200);
    expect(res.body.data.couponCode).toBe('STUDENT10');
    expect(res.body.data.pricing).toMatchObject({ subtotal: 2000, discount: 200, total: 1800 });
  });

  it('caps a percent coupon at maxDiscount', async () => {
    const { bearer } = await setup(5000);
    await makeCoupon({ code: 'CAPPED', value: 50, maxDiscount: 300 });
    const res = await applyCoupon(bearer, 'CAPPED');
    expect(res.body.data.pricing.discount).toBe(300);
  });

  it('applies a flat coupon but never below zero', async () => {
    const { bearer } = await setup(80);
    await makeCoupon({ code: 'FLAT', type: 'flat', value: 100 });
    const res = await applyCoupon(bearer, 'FLAT');
    expect(res.body.data.pricing.discount).toBe(80);
    expect(res.body.data.pricing.total).toBe(49);
  });

  it.each([
    ['unknown code', {}, 'NOPE', /isn't valid/i],
    ['inactive', { code: 'OFF', isActive: false }, 'OFF', /isn't valid/i],
    ['expired', { code: 'OLD', expiresAt: new Date(Date.now() - 86400000) }, 'OLD', /expired/i],
    ['not started', { code: 'SOON', startsAt: new Date(Date.now() + 86400000) }, 'SOON', /isn't active yet/i],
    ['minimum order', { code: 'MIN', minOrder: 5000 }, 'MIN', /minimum order of ₹5,000/i],
    ['used up', { code: 'GONE', usageLimit: 5, usedCount: 5 }, 'GONE', /fully redeemed/i],
  ])('rejects a coupon: %s', async (_name, coupon, code, message) => {
    const { bearer } = await setup();
    if (coupon.code) await makeCoupon(coupon);
    const res = await applyCoupon(bearer, code);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(message);
  });

  it('enforces the per-user limit', async () => {
    const { bearer, product } = await setup();
    await makeCoupon({ code: 'ONCE', perUserLimit: 1 });
    await applyCoupon(bearer, 'ONCE');
    await api()
      .post('/api/orders')
      .set('Authorization', bearer)
      .send({ address: shippingAddress, paymentMethod: 'COD' })
      .expect(201);
    await add(bearer, product);
    const res = await applyCoupon(bearer, 'ONCE');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already used/i);
  });

  it('removes a coupon', async () => {
    const { bearer } = await setup(2000);
    await makeCoupon({ code: 'BYE' });
    await applyCoupon(bearer, 'BYE');
    const res = await api().delete('/api/cart/coupon').set('Authorization', bearer);
    expect(res.body.data.couponCode).toBeNull();
    expect(res.body.data.pricing.discount).toBe(0);
  });

  it('drops the discount and explains when a coupon stops qualifying', async () => {
    const { bearer, product } = await setup(1000);
    await makeCoupon({ code: 'MIN900', minOrder: 900 });
    await applyCoupon(bearer, 'MIN900').then((r) => expect(r.status).toBe(200));
    product.price = 500;
    product.mrp = 500;
    await product.save();
    const cart = await getCart(bearer);
    expect(cart.pricing.discount).toBe(0);
    expect(cart.couponError).toMatch(/minimum order/i);
    // Checkout would refuse this coupon, so the cart must not send the student there.
    expect(cart.canCheckout).toBe(false);
  });
});

describe('available coupons', () => {
  it('lists only coupons that are currently usable', async () => {
    const { bearer } = await makeUser();
    await makeCoupon({ code: 'GOOD' });
    await makeCoupon({ code: 'DEAD', isActive: false });
    await makeCoupon({ code: 'OLD', expiresAt: new Date(Date.now() - 1000) });
    await makeCoupon({ code: 'FULL', usageLimit: 1, usedCount: 1 });
    const res = await api().get('/api/coupons/available').set('Authorization', bearer);
    expect(res.body.data.map((c) => c.code)).toEqual(['GOOD']);
  });
});

describe('wishlist', () => {
  it('adds, lists and removes products without duplicates', async () => {
    const { bearer } = await makeUser();
    const product = await makeProduct();
    await api().post(`/api/wishlist/${product._id}`).set('Authorization', bearer).expect(200);
    await api().post(`/api/wishlist/${product._id}`).set('Authorization', bearer).expect(200);
    const list = await api().get('/api/wishlist').set('Authorization', bearer);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].name).toBe(product.name);
    const removed = await api().delete(`/api/wishlist/${product._id}`).set('Authorization', bearer);
    expect(removed.body.data).toEqual([]);
  });

  it('hides products that were later deactivated', async () => {
    const { bearer } = await makeUser();
    const product = await makeProduct();
    await api().post(`/api/wishlist/${product._id}`).set('Authorization', bearer);
    product.isActive = false;
    await product.save();
    const list = await api().get('/api/wishlist').set('Authorization', bearer);
    expect(list.body.data).toEqual([]);
  });
});

describe('placeOrder helper sanity', () => {
  it('places an order through the helper', async () => {
    const { bearer } = await makeUser();
    const res = await placeOrder(bearer, [{ product: await makeProduct() }]);
    expect(res.status).toBe(201);
  });
});
