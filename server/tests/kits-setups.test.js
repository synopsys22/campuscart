import { describe, expect, it } from 'vitest';
import { api, makeAdmin, makeProduct, makeUser, useDatabase } from './support/helpers.js';

useDatabase();

async function kitBody() {
  const board = await makeProduct({ name: 'Board', price: 500, mrp: 600, stock: 10 });
  const sensor = await makeProduct({ name: 'Sensor', price: 100, mrp: 150, stock: 10 });
  return {
    board,
    sensor,
    body: {
      name: 'IoT Starter Kit',
      description: 'Everything needed for a first IoT project.',
      audience: 'Beginners',
      semester: 3,
      items: [
        { product: board._id.toString(), qty: 1 },
        { product: sensor._id.toString(), qty: 2 },
      ],
    },
  };
}

describe('project kits', () => {
  it('lets only admins create kits', async () => {
    const { body } = await kitBody();
    const { bearer } = await makeUser();
    expect((await api().post('/api/kits').send(body)).status).toBe(401);
    expect((await api().post('/api/kits').set('Authorization', bearer).send(body)).status).toBe(403);
  });

  it('creates a kit and reports its total from live prices', async () => {
    const { body } = await kitBody();
    const { bearer } = await makeAdmin();
    const created = await api().post('/api/kits').set('Authorization', bearer).send(body);
    expect(created.status).toBe(201);
    expect(created.body.data.slug).toBe('iot-starter-kit');

    const list = await api().get('/api/kits');
    expect(list.body.data[0]).toMatchObject({ totalPrice: 700, mrpTotal: 900, itemCount: 3, inStock: true });

    const one = await api().get('/api/kits/iot-starter-kit');
    expect(one.body.data.items[0].product.name).toBe('Board');
  });

  it('rejects a kit that contains a product that does not exist', async () => {
    const { body } = await kitBody();
    const { bearer } = await makeAdmin();
    body.items[0].product = '507f1f77bcf86cd799439011';
    const res = await api().post('/api/kits').set('Authorization', bearer).send(body);
    expect(res.status).toBe(400);
  });

  it('adds every item to the cart in one action', async () => {
    const { body } = await kitBody();
    const { bearer: admin } = await makeAdmin();
    const { body: kit } = await api().post('/api/kits').set('Authorization', admin).send(body);
    const { bearer } = await makeUser();
    const res = await api().post(`/api/kits/${kit.data._id}/add-to-cart`).set('Authorization', bearer);
    expect(res.status).toBe(200);
    expect(res.body.data.added).toHaveLength(2);
    expect(res.body.data.skipped).toEqual([]);
    expect(res.body.data.cart.pricing.subtotal).toBe(700);
  });

  it('skips unavailable items and reports them', async () => {
    const { body, sensor } = await kitBody();
    const { bearer: admin } = await makeAdmin();
    const { body: kit } = await api().post('/api/kits').set('Authorization', admin).send(body);
    sensor.stock = 1;
    await sensor.save();
    const { bearer } = await makeUser();
    const res = await api().post(`/api/kits/${kit.data._id}/add-to-cart`).set('Authorization', bearer);
    expect(res.body.data.added.map((item) => item.name)).toEqual(['Board']);
    expect(res.body.data.skipped[0]).toMatchObject({ name: 'Sensor', reason: 'Only 1 left in stock' });
  });

  it('marks a kit as not fully in stock', async () => {
    const { body, sensor } = await kitBody();
    const { bearer } = await makeAdmin();
    await api().post('/api/kits').set('Authorization', bearer).send(body);
    sensor.stock = 0;
    await sensor.save();
    const list = await api().get('/api/kits');
    expect(list.body.data[0].inStock).toBe(false);
  });

  it('updates and deletes a kit', async () => {
    const { body } = await kitBody();
    const { bearer } = await makeAdmin();
    const { body: kit } = await api().post('/api/kits').set('Authorization', bearer).send(body);
    const updated = await api()
      .patch(`/api/kits/${kit.data._id}`)
      .set('Authorization', bearer)
      .send({ audience: 'Everyone' });
    expect(updated.body.data.audience).toBe('Everyone');
    await api().delete(`/api/kits/${kit.data._id}`).set('Authorization', bearer).expect(200);
    expect((await api().get('/api/kits')).body.data).toEqual([]);
  });

  it('returns 404 for an unknown kit', async () => {
    expect((await api().get('/api/kits/nothing-here')).status).toBe(404);
  });
});

describe('build your setup', () => {
  const makeLaptop = () => makeProduct({ name: 'Laptop', setupSlot: 'laptop', price: 50000, mrp: 60000 });
  const makeMouse = () => makeProduct({ name: 'Mouse', setupSlot: 'mouse', price: 800, mrp: 1000 });

  it('lists every slot with its in-stock options, publicly', async () => {
    await makeLaptop();
    await makeProduct({ name: 'Sold out mouse', setupSlot: 'mouse', stock: 0 });
    const res = await api().get('/api/setups/slots');
    expect(res.status).toBe(200);
    expect(res.body.data.map((slot) => slot.slot)).toContain('keyboard');
    expect(res.body.data.find((slot) => slot.slot === 'laptop').products[0].name).toBe('Laptop');
    expect(res.body.data.find((slot) => slot.slot === 'mouse').products).toEqual([]);
  });

  it('saves a build and reports total and budget', async () => {
    const { bearer } = await makeUser();
    const laptop = await makeLaptop();
    const mouse = await makeMouse();
    const res = await api()
      .post('/api/setups')
      .set('Authorization', bearer)
      .send({
        name: 'Hostel desk',
        budget: 50000,
        slots: [
          { slot: 'laptop', product: laptop._id.toString() },
          { slot: 'mouse', product: mouse._id.toString() },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ total: 50800, overBudget: true });
  });

  it('rejects a product in the wrong slot', async () => {
    const { bearer } = await makeUser();
    const mouse = await makeMouse();
    const res = await api()
      .post('/api/setups')
      .set('Authorization', bearer)
      .send({ name: 'Wrong', slots: [{ slot: 'laptop', product: mouse._id.toString() }] });
    expect(res.status).toBe(400);
  });

  it('rejects the same slot used twice', async () => {
    const { bearer } = await makeUser();
    const mouse = await makeMouse();
    const entry = { slot: 'mouse', product: mouse._id.toString() };
    const res = await api()
      .post('/api/setups')
      .set('Authorization', bearer)
      .send({ name: 'Twice', slots: [entry, entry] });
    expect(res.status).toBe(400);
  });

  it('keeps saved builds private to their owner', async () => {
    const owner = await makeUser();
    const other = await makeUser();
    const mouse = await makeMouse();
    const { body } = await api()
      .post('/api/setups')
      .set('Authorization', owner.bearer)
      .send({ name: 'Mine', slots: [{ slot: 'mouse', product: mouse._id.toString() }] });
    expect((await api().get('/api/setups').set('Authorization', other.bearer)).body.data).toEqual([]);
    expect((await api().get('/api/setups').set('Authorization', owner.bearer)).body.data).toHaveLength(1);
    const url = `/api/setups/${body.data._id}`;
    expect((await api().patch(url).set('Authorization', other.bearer).send({ name: 'Stolen' })).status).toBe(404);
    expect((await api().delete(url).set('Authorization', other.bearer)).status).toBe(404);
    expect((await api().post(`${url}/add-to-cart`).set('Authorization', other.bearer)).status).toBe(404);
  });

  it('updates a build, adds it to the cart and deletes it', async () => {
    const { bearer } = await makeUser();
    const mouse = await makeMouse();
    const laptop = await makeLaptop();
    const { body } = await api()
      .post('/api/setups')
      .set('Authorization', bearer)
      .send({ name: 'Desk', slots: [{ slot: 'mouse', product: mouse._id.toString() }] });
    const url = `/api/setups/${body.data._id}`;

    const updated = await api()
      .patch(url)
      .set('Authorization', bearer)
      .send({
        name: 'Better desk',
        slots: [
          { slot: 'mouse', product: mouse._id.toString() },
          { slot: 'laptop', product: laptop._id.toString() },
        ],
      });
    expect(updated.body.data.name).toBe('Better desk');
    expect(updated.body.data.total).toBe(50800);

    const cart = await api().post(`${url}/add-to-cart`).set('Authorization', bearer);
    expect(cart.body.data.cart.pricing.subtotal).toBe(50800);

    await api().delete(url).set('Authorization', bearer).expect(200);
  });
});
