import { describe, expect, it } from 'vitest';
import { Order, Payment, Product, User, WalletTransaction } from '../src/models/index.js';
import {
  api,
  makeAdmin,
  makeProduct,
  makeUser,
  payByCard,
  placeOrder,
  shippingAddress,
  useDatabase,
} from './support/helpers.js';

useDatabase();

const addToCart = (bearer, product, qty = 1) =>
  api().post('/api/cart/items').set('Authorization', bearer).send({ productId: product._id.toString(), qty }).expect(200);
const startPayment = (bearer, body) => api().post('/api/payments').set('Authorization', bearer).send(body);
const step = (bearer, id, path, body = {}) => api().post(`/api/payments/${id}/${path}`).set('Authorization', bearer).send(body);
const order = (bearer, body) =>
  api().post('/api/orders').set('Authorization', bearer).send({ address: shippingAddress, ...body });
const card = (number) => ({ number, name: 'Test Student', expiry: '12/39', cvv: '123' });

/** Pretends the few seconds a UPI app takes to answer have passed. */
const letUpiAppAnswer = (id) => Payment.updateOne({ _id: id }, { $set: { requestedAt: new Date(Date.now() - 10000) } });

describe('card payments', () => {
  it('charges the cart total for the chosen delivery, then asks for the bank OTP', async () => {
    const { bearer } = await makeUser();
    await addToCart(bearer, await makeProduct({ price: 1500, mrp: 1500 }));
    const created = await startPayment(bearer, { purpose: 'order', method: 'MOCK_CARD', deliveryMethod: 'express' });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ amount: 1599, status: 'Created', reference: expect.stringMatching(/^MOCK-/) });

    const carded = await step(bearer, created.body.data._id, 'card', card('4111 1111 1111 1111'));
    expect(carded.body.data).toMatchObject({ status: 'Awaiting OTP', card: { brand: 'Visa', last4: '1111' } });
    const stored = await Payment.findById(created.body.data._id).lean();
    expect(JSON.stringify(stored)).not.toMatch(/4111111111111111|12\/39|"123"/);

    const paid = await step(bearer, created.body.data._id, 'otp', { otp: '123456' });
    expect(paid.body.data).toMatchObject({ status: 'Succeeded' });
  });

  it('fails the declined and low-balance test cards before any OTP', async () => {
    const { bearer } = await makeUser();
    await addToCart(bearer, await makeProduct());
    for (const [number, reason] of [
      ['4000000000000002', 'Declined by the bank'],
      ['4000000000009995', 'Not enough balance on the card'],
    ]) {
      const { body } = await startPayment(bearer, { purpose: 'order', method: 'MOCK_CARD' });
      const res = await step(bearer, body.data._id, 'card', card(number));
      expect(res.body.data).toMatchObject({ status: 'Failed', failureReason: reason });
    }
  });

  it('checks the card details and refuses anything but a test card', async () => {
    const { bearer } = await makeUser();
    await addToCart(bearer, await makeProduct());
    const { body } = await startPayment(bearer, { purpose: 'order', method: 'MOCK_CARD' });
    const bad = await step(bearer, body.data._id, 'card', { number: '4111 1111 1111 1112', name: 'A', expiry: '01/20', cvv: '12' });
    expect(bad.status).toBe(400);
    expect(bad.body.errors).toMatchObject({
      number: 'This card number is not valid.',
      name: 'Enter the name on the card.',
      expiry: 'This card has expired.',
      cvv: 'Enter the 3-digit CVV.',
    });
    // A real-looking card that passes every check is still refused.
    const real = await step(bearer, body.data._id, 'card', card('4012888888881881'));
    expect(real.status).toBe(400);
    expect(real.body.message).toMatch(/only the test cards/);
  });

  it('allows 3 OTP attempts, then fails the payment', async () => {
    const { bearer } = await makeUser();
    await addToCart(bearer, await makeProduct());
    const { body } = await startPayment(bearer, { purpose: 'order', method: 'MOCK_CARD' });
    await step(bearer, body.data._id, 'card', card('5555 5555 5555 4444'));
    const first = await step(bearer, body.data._id, 'otp', { otp: '000000' });
    expect(first.status).toBe(400);
    expect(first.body.message).toBe('That OTP is wrong. 2 tries left.');
    await step(bearer, body.data._id, 'otp', { otp: '000000' });
    const third = await step(bearer, body.data._id, 'otp', { otp: '000000' });
    expect(third.body.data).toMatchObject({ status: 'Failed', failureReason: 'Wrong OTP entered 3 times' });
    expect((await step(bearer, body.data._id, 'otp', { otp: '123456' })).status).toBe(400);
  });

  it('times out after 10 minutes', async () => {
    const { bearer } = await makeUser();
    await addToCart(bearer, await makeProduct());
    const { body } = await startPayment(bearer, { purpose: 'order', method: 'MOCK_CARD' });
    await Payment.updateOne({ _id: body.data._id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    const res = await api().get(`/api/payments/${body.data._id}`).set('Authorization', bearer);
    expect(res.body.data.status).toBe('Expired');
    expect((await step(bearer, body.data._id, 'card', card('4111111111111111'))).status).toBe(400);
  });

  it("keeps each person's payments private", async () => {
    const owner = await makeUser();
    const other = await makeUser();
    await addToCart(owner.bearer, await makeProduct());
    const { body } = await startPayment(owner.bearer, { purpose: 'order', method: 'MOCK_CARD' });
    expect((await api().get(`/api/payments/${body.data._id}`).set('Authorization', other.bearer)).status).toBe(404);
    expect((await step(other.bearer, body.data._id, 'card', card('4111111111111111'))).status).toBe(404);
  });
});

describe('UPI payments', () => {
  it('approves a collect request a few seconds after it is sent', async () => {
    const { bearer } = await makeUser();
    await addToCart(bearer, await makeProduct());
    const { body } = await startPayment(bearer, { purpose: 'order', method: 'MOCK_UPI' });
    const sent = await step(bearer, body.data._id, 'upi', { upiId: 'Student@OkBank' });
    expect(sent.body.data).toMatchObject({ status: 'Awaiting approval', upiId: 'student@okbank' });
    const waiting = await api().get(`/api/payments/${body.data._id}`).set('Authorization', bearer);
    expect(waiting.body.data.status).toBe('Awaiting approval');
    await letUpiAppAnswer(body.data._id);
    const done = await api().get(`/api/payments/${body.data._id}`).set('Authorization', bearer);
    expect(done.body.data.status).toBe('Succeeded');
  });

  it('has failure@ IDs declined, and checks the UPI ID format', async () => {
    const { bearer } = await makeUser();
    await addToCart(bearer, await makeProduct());
    const { body } = await startPayment(bearer, { purpose: 'order', method: 'MOCK_UPI' });
    expect((await step(bearer, body.data._id, 'upi', { upiId: 'not-a-upi-id' })).status).toBe(400);
    await step(bearer, body.data._id, 'upi', { upiId: 'failure@campus' });
    await letUpiAppAnswer(body.data._id);
    const done = await api().get(`/api/payments/${body.data._id}`).set('Authorization', bearer);
    expect(done.body.data).toMatchObject({ status: 'Failed', failureReason: 'Declined in the UPI app' });
  });

  it('lets the phone that scanned the QR code approve it with the token, without logging in', async () => {
    const { bearer } = await makeUser();
    await addToCart(bearer, await makeProduct());
    const { body } = await startPayment(bearer, { purpose: 'order', method: 'MOCK_UPI' });
    const { _id: id, approvalToken } = body.data;
    expect(approvalToken).toMatch(/^[a-f\d]{32}$/);
    // The token is handed over only once, when the payment screen opens.
    expect((await api().get(`/api/payments/${id}`).set('Authorization', bearer)).body.data.approvalToken).toBeUndefined();

    const wrong = await api().post(`/api/payments/${id}/approve`).send({ token: 'a'.repeat(32) });
    expect(wrong.status).toBe(404);
    const details = await api().get(`/api/payments/${id}/approval?token=${approvalToken}`);
    expect(details.body.data).toMatchObject({ payee: 'CampusCart', status: 'Created' });
    const approved = await api().post(`/api/payments/${id}/approve`).send({ token: approvalToken });
    expect(approved.body.data.status).toBe('Succeeded');
    expect((await api().post(`/api/payments/${id}/approve`).send({ token: approvalToken })).status).toBe(400);
  });

  it('records a closed payment screen as a failed attempt', async () => {
    const { bearer } = await makeUser();
    await addToCart(bearer, await makeProduct());
    const { body } = await startPayment(bearer, { purpose: 'order', method: 'MOCK_UPI' });
    const res = await step(bearer, body.data._id, 'cancel');
    expect(res.body.data).toMatchObject({ status: 'Failed', failureReason: 'Closed before paying' });
  });
});

describe('placing an order with a gateway payment', () => {
  it('uses a payment once only', async () => {
    const { bearer } = await makeUser();
    await addToCart(bearer, await makeProduct());
    const payment = await payByCard(bearer);
    const first = await order(bearer, { paymentMethod: 'MOCK_CARD', paymentId: payment._id });
    expect(first.status).toBe(201);
    expect((await Payment.findById(payment._id)).orderNumber).toBe(first.body.data.orderNumber);

    await addToCart(bearer, await makeProduct());
    const second = await order(bearer, { paymentMethod: 'MOCK_CARD', paymentId: payment._id });
    expect(second.status).toBe(400);
    expect(second.body.message).toMatch(/already been used/);
  });

  it('refuses an unfinished payment, or one made with another method', async () => {
    const { bearer } = await makeUser();
    await addToCart(bearer, await makeProduct());
    const { body } = await startPayment(bearer, { purpose: 'order', method: 'MOCK_CARD' });
    expect((await order(bearer, { paymentMethod: 'MOCK_CARD', paymentId: body.data._id })).body.message).toMatch(/not gone through/);
    expect((await order(bearer, { paymentMethod: 'MOCK_UPI', paymentId: body.data._id })).body.message).toMatch(/not found/);
  });

  it('refunds the payment if the total changed while paying', async () => {
    const { bearer } = await makeUser();
    const product = await makeProduct({ price: 1200, mrp: 1200 });
    await addToCart(bearer, product);
    const payment = await payByCard(bearer);
    await Product.updateOne({ _id: product._id }, { $set: { price: 1300 } });
    const res = await order(bearer, { paymentMethod: 'MOCK_CARD', paymentId: payment._id });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Your total changed to ₹1,300 while you were paying ₹1,200. Your payment of ₹1,200 has been refunded.');
    expect((await Payment.findById(payment._id)).status).toBe('Refunded');
  });

  it('refunds the payment if an item sells out while paying', async () => {
    const { bearer } = await makeUser();
    const product = await makeProduct({ stock: 2 });
    await addToCart(bearer, product, 2);
    const payment = await payByCard(bearer);
    await Product.updateOne({ _id: product._id }, { $set: { stock: 1 } });
    const res = await order(bearer, { paymentMethod: 'MOCK_CARD', paymentId: payment._id });
    expect(res.body.message).toMatch(/Only 1 left in stock\. Your payment of .* has been refunded\./);
    expect((await Payment.findById(payment._id)).refund).toMatchObject({ to: 'source' });
  });
});

describe('the wallet', () => {
  async function topUp(bearer, amount) {
    const { body } = await startPayment(bearer, { purpose: 'wallet_topup', method: 'MOCK_UPI', amount });
    await api().post(`/api/payments/${body.data._id}/approve`).send({ token: body.data.approvalToken }).expect(200);
    return body.data;
  }

  it('adds money through the payment gateway and keeps a statement', async () => {
    const { bearer, user } = await makeUser();
    await topUp(bearer, 2000);
    const { body } = await api().get('/api/wallet').set('Authorization', bearer);
    expect(body.summary.balance).toBe(2000);
    expect(body.data[0]).toMatchObject({ type: 'credit', kind: 'topup', amount: 2000, balanceAfter: 2000, description: 'Added money by UPI' });
    expect((await User.findById(user._id)).walletBalance).toBe(2000);
  });

  it('limits top-ups to ₹100 to ₹10,000, and a balance of ₹50,000', async () => {
    const { bearer, user } = await makeUser();
    expect((await startPayment(bearer, { purpose: 'wallet_topup', method: 'MOCK_UPI', amount: 50 })).status).toBe(400);
    expect((await startPayment(bearer, { purpose: 'wallet_topup', method: 'MOCK_UPI', amount: 20000 })).status).toBe(400);
    await User.updateOne({ _id: user._id }, { $set: { walletBalance: 45000 } });
    const res = await startPayment(bearer, { purpose: 'wallet_topup', method: 'MOCK_CARD', amount: 6000 });
    expect(res.body.message).toMatch(/up to ₹5,000 more/);
  });

  it('pays for an order from the balance and refunds to it on cancel', async () => {
    const { bearer, user } = await makeUser();
    await topUp(bearer, 1500);
    const { body } = await placeOrder(bearer, [{ product: await makeProduct({ price: 1000, mrp: 1000 }) }], { paymentMethod: 'WALLET' });
    expect(body.data.payment).toMatchObject({ method: 'WALLET', status: 'Paid', detail: 'CampusCart wallet', transactionRef: expect.stringMatching(/^WAL-/) });
    expect((await User.findById(user._id)).walletBalance).toBe(500);

    await api().post(`/api/orders/${body.data._id}/cancel`).set('Authorization', bearer).send({}).expect(200);
    expect((await User.findById(user._id)).walletBalance).toBe(1500);
    const statement = await WalletTransaction.find({ user: user._id }).sort({ createdAt: 1, _id: 1 });
    expect(statement.map((line) => [line.kind, line.amount, line.balanceAfter])).toEqual([
      ['topup', 1500, 1500],
      ['payment', 1000, 500],
      ['refund', 1000, 1500],
    ]);
  });

  it('refuses a wallet order the balance cannot cover, without touching stock', async () => {
    const { bearer } = await makeUser();
    const product = await makeProduct({ price: 1000, mrp: 1000, stock: 3 });
    const res = await placeOrder(bearer, [{ product }], { paymentMethod: 'WALLET' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Your wallet has ₹0, which is less than ₹1,000/);
    expect((await Product.findById(product._id)).stock).toBe(3);
    expect(await Order.countDocuments()).toBe(0);
  });

  it('never takes the balance below zero when two orders race', async () => {
    const { bearer, user } = await makeUser();
    await topUp(bearer, 1000);
    // Two carts cannot exist for one user, so this races two debits directly.
    const { debitWallet } = await import('../src/services/wallet.service.js');
    const results = await Promise.allSettled([
      debitWallet(user._id, 800, { kind: 'payment', description: 'one' }),
      debitWallet(user._id, 800, { kind: 'payment', description: 'two' }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect((await User.findById(user._id)).walletBalance).toBe(200);
  });
});

describe('the admin payments pages', () => {
  it('lists every attempt, including failures, with totals', async () => {
    const { bearer: admin } = await makeAdmin();
    const { bearer } = await makeUser({ name: 'Riya' });
    await addToCart(bearer, await makeProduct({ price: 1200, mrp: 1200 }));
    await payByCard(bearer, { number: '4000000000000002' });
    const good = await payByCard(bearer);
    await order(bearer, { paymentMethod: 'MOCK_CARD', paymentId: good._id }).expect(201);

    const res = await api().get('/api/admin/payments').set('Authorization', admin);
    expect(res.body.meta.total).toBe(2);
    expect(res.body.data.map((p) => p.status)).toEqual(['Succeeded', 'Failed']);
    expect(res.body.data[0].user.name).toBe('Riya');
    expect(res.body.summary).toMatchObject({ collected: 1200, refunded: 0, failed: 1, successRate: 50 });

    const failed = await api().get('/api/admin/payments?status=Failed').set('Authorization', admin);
    expect(failed.body.meta.total).toBe(1);
    const search = await api().get('/api/admin/payments?search=riya').set('Authorization', admin);
    expect(search.body.meta.total).toBe(2);
  });

  it('lists wallet activity for admins only', async () => {
    const { bearer: admin } = await makeAdmin();
    const { bearer } = await makeUser();
    const { body } = await startPayment(bearer, { purpose: 'wallet_topup', method: 'MOCK_UPI', amount: 700 });
    await api().post(`/api/payments/${body.data._id}/approve`).send({ token: body.data.approvalToken });
    const res = await api().get('/api/admin/wallet-transactions').set('Authorization', admin);
    expect(res.body.summary).toMatchObject({ held: 700, wallets: 1, toppedUp: 700 });
    expect((await api().get('/api/admin/wallet-transactions').set('Authorization', bearer)).status).toBe(403);
    expect((await api().get('/api/admin/payments').set('Authorization', bearer)).status).toBe(403);
  });
});
