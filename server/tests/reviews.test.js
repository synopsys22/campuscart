import { describe, expect, it } from 'vitest';
import { Product } from '../src/models/index.js';
import { advanceOrderTo, api, makeAdmin, makeProduct, makeUser, placeOrder, useDatabase } from './support/helpers.js';

useDatabase();

const review = { rating: 5, title: 'Great board', body: 'Worked first time with my IoT project.' };
const post = (bearer, productId, data = review) =>
  api().post(`/api/products/${productId}/reviews`).set('Authorization', bearer).send(data);

async function buyerWithDeliveredOrder(product) {
  const admin = await makeAdmin();
  const buyer = await makeUser();
  const { body } = await placeOrder(buyer.bearer, [{ product }]);
  await advanceOrderTo(admin.bearer, body.data._id, 'Delivered');
  return { ...buyer, adminBearer: admin.bearer, orderId: body.data._id };
}

describe('writing a review', () => {
  it('is blocked for someone who never bought the product', async () => {
    const { bearer } = await makeUser();
    const res = await post(bearer, (await makeProduct())._id);
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/after your order is delivered/i);
  });

  it('is blocked until the order is delivered', async () => {
    const { bearer: admin } = await makeAdmin();
    const { bearer } = await makeUser();
    const product = await makeProduct();
    const { body } = await placeOrder(bearer, [{ product }]);
    await advanceOrderTo(admin, body.data._id, 'Shipped');
    expect((await post(bearer, product._id)).status).toBe(403);
  });

  it('is allowed after delivery and updates the product rating', async () => {
    const product = await makeProduct();
    const { bearer, orderId } = await buyerWithDeliveredOrder(product);
    const res = await post(bearer, product._id);
    expect(res.status).toBe(201);
    expect(res.body.data.order).toBe(orderId);
    const fresh = await Product.findById(product._id);
    expect(fresh.ratingAvg).toBe(5);
    expect(fresh.ratingCount).toBe(1);
  });

  it('allows only one review per product', async () => {
    const product = await makeProduct();
    const { bearer } = await buyerWithDeliveredOrder(product);
    await post(bearer, product._id).then((r) => expect(r.status).toBe(201));
    const second = await post(bearer, product._id);
    expect(second.status).toBe(409);
  });

  it('rejects a rating outside 1 to 5', async () => {
    const product = await makeProduct();
    const { bearer } = await buyerWithDeliveredOrder(product);
    expect((await post(bearer, product._id, { ...review, rating: 6 })).status).toBe(400);
  });

  it('averages ratings to one decimal place', async () => {
    const product = await makeProduct({ stock: 10 });
    const first = await buyerWithDeliveredOrder(product);
    const second = await buyerWithDeliveredOrder(product);
    const third = await buyerWithDeliveredOrder(product);
    await post(first.bearer, product._id, { ...review, rating: 5 });
    await post(second.bearer, product._id, { ...review, rating: 4 });
    await post(third.bearer, product._id, { ...review, rating: 4 });
    const fresh = await Product.findById(product._id);
    expect(fresh.ratingAvg).toBe(4.3);
    expect(fresh.ratingCount).toBe(3);
  });
});

describe('eligibility', () => {
  it('tells the page whether the user can review', async () => {
    const product = await makeProduct();
    const { bearer } = await buyerWithDeliveredOrder(product);
    const url = `/api/products/${product._id}/reviews/eligibility`;
    const before = await api().get(url).set('Authorization', bearer);
    expect(before.body.data.canReview).toBe(true);
    await post(bearer, product._id);
    const after = await api().get(url).set('Authorization', bearer);
    expect(after.body.data.canReview).toBe(false);
    expect(after.body.data.existingReview.title).toBe(review.title);
  });

  it('says no for a user with no delivered order', async () => {
    const { bearer } = await makeUser();
    const product = await makeProduct();
    const res = await api().get(`/api/products/${product._id}/reviews/eligibility`).set('Authorization', bearer);
    expect(res.body.data.canReview).toBe(false);
    expect(res.body.data.reason).toMatch(/delivered/i);
  });
});

describe('reading reviews', () => {
  it('is public, paginated and marks verified purchases', async () => {
    const product = await makeProduct();
    const { bearer, user } = await buyerWithDeliveredOrder(product);
    await post(bearer, product._id);
    const res = await api().get(`/api/products/${product._id}/reviews`);
    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(1);
    expect(res.body.data[0].user.name).toBe(user.name);
    expect(res.body.data[0].user.email).toBeUndefined();
    expect(res.body.data[0].verified).toBe(true);
    expect(res.body.summary.distribution[5]).toBe(1);
    expect(res.body.summary.distribution[1]).toBe(0);
  });
});

describe('editing and deleting', () => {
  it('lets the author edit and recalculates the rating', async () => {
    const product = await makeProduct();
    const { bearer } = await buyerWithDeliveredOrder(product);
    const { body } = await post(bearer, product._id);
    const res = await api().patch(`/api/reviews/${body.data._id}`).set('Authorization', bearer).send({ rating: 2 });
    expect(res.status).toBe(200);
    expect((await Product.findById(product._id)).ratingAvg).toBe(2);
  });

  it("stops other users editing or deleting a review", async () => {
    const product = await makeProduct();
    const { bearer } = await buyerWithDeliveredOrder(product);
    const { body } = await post(bearer, product._id);
    const other = await makeUser();
    expect((await api().patch(`/api/reviews/${body.data._id}`).set('Authorization', other.bearer).send({ rating: 1 })).status).toBe(403);
    expect((await api().delete(`/api/reviews/${body.data._id}`).set('Authorization', other.bearer)).status).toBe(403);
  });

  it('lets an admin delete any review and resets the rating', async () => {
    const product = await makeProduct();
    const { bearer, adminBearer } = await buyerWithDeliveredOrder(product);
    const { body } = await post(bearer, product._id);
    const res = await api().delete(`/api/reviews/${body.data._id}`).set('Authorization', adminBearer);
    expect(res.status).toBe(200);
    const fresh = await Product.findById(product._id);
    expect(fresh.ratingAvg).toBe(0);
    expect(fresh.ratingCount).toBe(0);
  });

  it('lists my reviews and all reviews for admins', async () => {
    const product = await makeProduct();
    const { bearer, adminBearer } = await buyerWithDeliveredOrder(product);
    await post(bearer, product._id);
    const mine = await api().get('/api/reviews/my').set('Authorization', bearer);
    expect(mine.body.data[0].product.name).toBe(product.name);
    const all = await api().get('/api/reviews').set('Authorization', adminBearer);
    expect(all.body.meta.total).toBe(1);
    expect((await api().get('/api/reviews').set('Authorization', bearer)).status).toBe(403);
  });
});
