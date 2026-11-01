import { describe, expect, it } from 'vitest';
import { api, makeAdmin, makeCategory, makeProduct, makeUser, useDatabase } from './support/helpers.js';

useDatabase();

describe('product discovery', () => {
  it('returns paginated products with metadata', async () => {
    await Promise.all(Array.from({ length: 5 }, () => makeProduct()));
    const res = await api().get('/api/products?limit=2&page=2');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta).toMatchObject({ page: 2, limit: 2, total: 5, pages: 3 });
  });

  it('searches partial words across name and brand', async () => {
    await makeProduct({ name: 'Raspberry Pi 5', brand: 'Raspberry' });
    await makeProduct({ name: 'Notebook', brand: 'Classmate' });
    const byName = await api().get('/api/products?q=rasp');
    expect(byName.body.data.map((p) => p.name)).toEqual(['Raspberry Pi 5']);
    const byBrand = await api().get('/api/products?q=classmate');
    expect(byBrand.body.data.map((p) => p.name)).toEqual(['Notebook']);
  });

  it('treats special characters in search as plain text', async () => {
    await makeProduct({ name: 'C++ Primer' });
    const res = await api().get(`/api/products?q=${encodeURIComponent('c++')}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('filters by category slug', async () => {
    const hardware = await makeCategory({ name: 'Hardware', slug: 'hardware' });
    await makeProduct({ name: 'Board', category: hardware._id });
    await makeProduct({ name: 'Other' });
    const res = await api().get('/api/products?category=hardware');
    expect(res.body.data.map((p) => p.name)).toEqual(['Board']);
    expect(res.body.data[0].category.name).toBe('Hardware');
  });

  it('filters by price range, brand, rating, stock and semester', async () => {
    await makeProduct({ name: 'Cheap', price: 100, brand: 'A', ratingAvg: 3, stock: 0, semesters: [1] });
    await makeProduct({ name: 'Mid', price: 500, brand: 'B', ratingAvg: 4.5, stock: 5, semesters: [3, 5] });
    await makeProduct({ name: 'Costly', price: 5000, brand: 'B', ratingAvg: 4.8, stock: 5, semesters: [5] });

    const names = async (query) =>
      (await api().get(`/api/products?${query}`)).body.data.map((p) => p.name).sort();

    expect(await names('minPrice=200&maxPrice=1000')).toEqual(['Mid']);
    expect(await names('brand=A')).toEqual(['Cheap']);
    expect(await names('rating=4')).toEqual(['Costly', 'Mid']);
    expect(await names('inStock=true')).toEqual(['Costly', 'Mid']);
    expect(await names('semester=3')).toEqual(['Mid']);
  });

  it('sorts by price and rating', async () => {
    await makeProduct({ name: 'B', price: 200, ratingAvg: 5 });
    await makeProduct({ name: 'A', price: 100, ratingAvg: 1 });
    await makeProduct({ name: 'C', price: 300, ratingAvg: 3 });
    const names = async (sort) =>
      (await api().get(`/api/products?sort=${sort}`)).body.data.map((p) => p.name);
    expect(await names('price_asc')).toEqual(['A', 'B', 'C']);
    expect(await names('price_desc')).toEqual(['C', 'B', 'A']);
    expect(await names('rating')).toEqual(['B', 'C', 'A']);
  });

  it('rejects an unknown sort value', async () => {
    const res = await api().get('/api/products?sort=sideways');
    expect(res.status).toBe(400);
  });

  it('gets one product by slug and hides inactive products from the public', async () => {
    await makeProduct({ slug: 'visible-one' });
    await makeProduct({ slug: 'hidden-one', isActive: false });
    expect((await api().get('/api/products/visible-one')).status).toBe(200);
    expect((await api().get('/api/products/hidden-one')).status).toBe(404);
    const list = await api().get('/api/products');
    expect(list.body.data.map((p) => p.slug)).toEqual(['visible-one']);
  });

  it('lets an admin see inactive products', async () => {
    const { bearer } = await makeAdmin();
    await makeProduct({ slug: 'hidden-one', isActive: false });
    const list = await api().get('/api/products?includeInactive=true').set('Authorization', bearer);
    expect(list.body.data).toHaveLength(1);
    const anonymous = await api().get('/api/products?includeInactive=true');
    expect(anonymous.body.data).toHaveLength(0);
    const one = await api().get('/api/products/hidden-one').set('Authorization', bearer);
    expect(one.status).toBe(200);
  });

  it('returns filter options with counts', async () => {
    const hardware = await makeCategory({ name: 'Hardware', slug: 'hardware' });
    await makeProduct({ category: hardware._id, brand: 'Pi', price: 100, semesters: [3] });
    await makeProduct({ category: hardware._id, brand: 'Arduino', price: 900, semesters: [5] });
    const res = await api().get('/api/products/filters');
    expect(res.body.data.brands).toEqual(['Arduino', 'Pi']);
    expect(res.body.data.price).toEqual({ min: 100, max: 900 });
    expect(res.body.data.semesters).toEqual([3, 5]);
    expect(res.body.data.categories[0]).toMatchObject({ slug: 'hardware', count: 2 });
  });

  it('suggests products for quick search', async () => {
    await makeProduct({ name: 'Arduino Uno' });
    await makeProduct({ name: 'Notebook' });
    const res = await api().get('/api/products/suggest?q=ard');
    expect(res.body.data.map((p) => p.name)).toEqual(['Arduino Uno']);
  });

  it('returns related products from the same category, not itself', async () => {
    const category = await makeCategory();
    await makeProduct({ slug: 'main', category: category._id });
    await makeProduct({ slug: 'sibling', category: category._id });
    await makeProduct({ slug: 'unrelated' });
    const res = await api().get('/api/products/main/related');
    expect(res.body.data.map((p) => p.slug)).toEqual(['sibling']);
  });

  it('returns products to compare, capped at four, in the requested order', async () => {
    const products = await Promise.all(Array.from({ length: 5 }, () => makeProduct()));
    const ids = products.map((p) => p._id.toString());
    const two = await api().get(`/api/products/compare?ids=${ids[1]},${ids[0]}`);
    expect(two.body.data.map((p) => p._id)).toEqual([ids[1], ids[0]]);
    const tooMany = await api().get(`/api/products/compare?ids=${ids.join(',')}`);
    expect(tooMany.status).toBe(400);
  });
});

describe('product administration', () => {
  const body = (categoryId) => ({
    name: 'ESP32 Dev Board',
    brand: 'Espressif',
    sku: 'esp-32',
    description: 'A Wi-Fi and Bluetooth microcontroller board.',
    category: categoryId,
    price: 499,
    mrp: 699,
    stock: 20,
    specs: [{ group: 'Connectivity', key: 'Wi-Fi', value: '802.11 b/g/n' }],
  });

  it('blocks students and guests from creating products', async () => {
    const category = await makeCategory();
    const { bearer } = await makeUser();
    expect((await api().post('/api/products').send(body(category._id))).status).toBe(401);
    expect((await api().post('/api/products').set('Authorization', bearer).send(body(category._id))).status).toBe(403);
  });

  it('creates a product with a generated slug and uppercase SKU', async () => {
    const category = await makeCategory();
    const { bearer } = await makeAdmin();
    const res = await api().post('/api/products').set('Authorization', bearer).send(body(category._id));
    expect(res.status).toBe(201);
    expect(res.body.data.slug).toBe('esp32-dev-board');
    expect(res.body.data.sku).toBe('ESP-32');
    expect(res.body.data.specs[0].key).toBe('Wi-Fi');
  });

  it('gives a second product with the same name a different slug', async () => {
    const category = await makeCategory();
    const { bearer } = await makeAdmin();
    await api().post('/api/products').set('Authorization', bearer).send(body(category._id)).expect(201);
    const res = await api()
      .post('/api/products')
      .set('Authorization', bearer)
      .send({ ...body(category._id), sku: 'ESP-33' });
    expect(res.status).toBe(201);
    expect(res.body.data.slug).toBe('esp32-dev-board-2');
  });

  it('rejects a price above MRP', async () => {
    const category = await makeCategory();
    const { bearer } = await makeAdmin();
    const res = await api()
      .post('/api/products')
      .set('Authorization', bearer)
      .send({ ...body(category._id), price: 900, mrp: 100 });
    expect(res.status).toBe(400);
    expect(res.body.errors.price).toBeTruthy();
  });

  it('rejects a category that does not exist', async () => {
    const { bearer } = await makeAdmin();
    const res = await api()
      .post('/api/products')
      .set('Authorization', bearer)
      .send(body('507f1f77bcf86cd799439011'));
    expect(res.status).toBe(400);
  });

  it('updates a product', async () => {
    const { bearer } = await makeAdmin();
    const product = await makeProduct();
    const res = await api().patch(`/api/products/${product._id}`).set('Authorization', bearer).send({ price: 750 });
    expect(res.status).toBe(200);
    expect(res.body.data.price).toBe(750);
  });

  it('checks price against MRP on a partial update too', async () => {
    const { bearer } = await makeAdmin();
    const product = await makeProduct({ price: 1000, mrp: 1200 });
    const res = await api().patch(`/api/products/${product._id}`).set('Authorization', bearer).send({ price: 5000 });
    expect(res.status).toBe(400);
  });

  it('soft-deletes a product', async () => {
    const { bearer } = await makeAdmin();
    const product = await makeProduct({ slug: 'to-remove' });
    const res = await api().delete(`/api/products/${product._id}`).set('Authorization', bearer);
    expect(res.status).toBe(200);
    expect((await api().get('/api/products/to-remove')).status).toBe(404);
    const stillThere = await api().get('/api/products/to-remove').set('Authorization', bearer);
    expect(stillThere.body.data.isActive).toBe(false);
  });

  it('sets stock directly and rejects negatives', async () => {
    const { bearer } = await makeAdmin();
    const product = await makeProduct({ stock: 5 });
    const ok = await api().patch(`/api/products/${product._id}/stock`).set('Authorization', bearer).send({ stock: 42 });
    expect(ok.body.data.stock).toBe(42);
    const bad = await api().patch(`/api/products/${product._id}/stock`).set('Authorization', bearer).send({ stock: -1 });
    expect(bad.status).toBe(400);
  });
});

describe('categories', () => {
  it('lists categories publicly in sort order, hiding inactive ones', async () => {
    await makeCategory({ name: 'Second', sortOrder: 2 });
    await makeCategory({ name: 'First', sortOrder: 1 });
    await makeCategory({ name: 'Hidden', isActive: false });
    const res = await api().get('/api/categories');
    expect(res.body.data.map((c) => c.name)).toEqual(['First', 'Second']);
  });

  it('lets an admin create and update a category', async () => {
    const { bearer } = await makeAdmin();
    const created = await api().post('/api/categories').set('Authorization', bearer).send({ name: 'Dev Hardware' });
    expect(created.status).toBe(201);
    expect(created.body.data.slug).toBe('dev-hardware');
    const updated = await api()
      .patch(`/api/categories/${created.body.data._id}`)
      .set('Authorization', bearer)
      .send({ description: 'Boards and sensors' });
    expect(updated.body.data.description).toBe('Boards and sensors');
  });

  it('refuses to delete a category that still has products', async () => {
    const { bearer } = await makeAdmin();
    const category = await makeCategory();
    await makeProduct({ category: category._id });
    const res = await api().delete(`/api/categories/${category._id}`).set('Authorization', bearer);
    expect(res.status).toBe(409);
  });

  it('deletes an empty category', async () => {
    const { bearer } = await makeAdmin();
    const category = await makeCategory();
    const res = await api().delete(`/api/categories/${category._id}`).set('Authorization', bearer);
    expect(res.status).toBe(200);
  });
});
