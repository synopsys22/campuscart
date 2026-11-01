import { randomBytes } from 'node:crypto';
import { Cart, Counter, Order, Product } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { stockMessage } from './cart.service.js';
import { releaseCouponUse, requireUsableCoupon, reserveCouponUse } from './coupon.service.js';
import { calculateTotals } from './pricing.service.js';

const DELIVERY_DAYS = 5;
const NEXT_STATUS = { Pending: 'Confirmed', Confirmed: 'Shipped', Shipped: 'Delivered' };
const CANCELLABLE = ['Pending', 'Confirmed'];

export async function nextOrderNumber(date = new Date()) {
  const year = date.getFullYear();
  const counter = await Counter.findOneAndUpdate(
    { _id: `order-${year}` },
    { $inc: { value: 1 } },
    { upsert: true, returnDocument: 'after' },
  );
  return `CC-${year}-${String(counter.value).padStart(6, '0')}`;
}

/** Takes stock only if enough remains, so two buyers can never both get the last unit. */
async function reserveStock(line) {
  const updated = await Product.findOneAndUpdate(
    { _id: line.product, isActive: true, stock: { $gte: line.qty } },
    { $inc: { stock: -line.qty, soldCount: line.qty } },
  );
  if (updated) return;

  const current = await Product.findById(line.product);
  const reason = current?.isActive ? `${stockMessage(current.stock)}.` : 'It is no longer available.';
  throw ApiError.badRequest(`${line.name}: ${reason}`);
}

async function releaseStock(line) {
  await Product.updateOne(
    { _id: line.product },
    { $inc: { stock: line.qty, soldCount: -line.qty } },
  );
}

function initialPayment(method) {
  if (method === 'COD') return { method, status: 'Pending', transactionRef: null };
  const reference = `MOCK-${randomBytes(6).toString('hex').toUpperCase()}`;
  return { method, status: 'Paid', transactionRef: reference };
}

/**
 * Turns the user's cart into an order. MongoDB transactions need a replica set and this
 * app runs on a single server, so each step that changes shared data is undone by hand
 * if a later step fails.
 */
export async function placeOrder(userId, { address, paymentMethod }) {
  // Emptying the cart first means a double-clicked "Place order" cannot create two orders.
  const claimed = await Cart.findOneAndUpdate(
    { user: userId, 'items.0': { $exists: true } },
    { $set: { items: [], couponCode: null } },
  );
  if (!claimed) throw ApiError.badRequest('Your cart is empty.');

  const reservedLines = [];
  let couponReserved = false;

  try {
    const originalItems = claimed.toObject().items;
    await claimed.populate('items.product');

    const lines = claimed.items.map(({ product, qty }, index) => {
      if (!product) throw ApiError.badRequest('An item in your cart is no longer available.');
      return {
        product: originalItems[index].product,
        name: product.name,
        slug: product.slug,
        sku: product.sku,
        image: product.images[0] ?? '',
        price: product.price,
        mrp: product.mrp,
        qty,
        lineTotal: product.price * qty,
      };
    });

    const { subtotal } = calculateTotals(lines);
    const coupon = claimed.couponCode
      ? await requireUsableCoupon(claimed.couponCode, subtotal, userId)
      : null;
    const totals = calculateTotals(lines, coupon);

    for (const line of lines) {
      await reserveStock(line);
      reservedLines.push(line);
    }
    if (coupon) {
      await reserveCouponUse(coupon.code);
      couponReserved = true;
    }

    const now = new Date();
    return await Order.create({
      orderNumber: await nextOrderNumber(now),
      user: userId,
      items: lines,
      shippingAddress: address,
      payment: initialPayment(paymentMethod),
      subtotal: totals.subtotal,
      discount: totals.discount,
      couponCode: coupon?.code ?? null,
      shippingFee: totals.shippingFee,
      total: totals.total,
      status: 'Pending',
      statusHistory: [{ status: 'Pending', at: now, note: 'Order placed', by: userId }],
      estimatedDelivery: new Date(now.getTime() + DELIVERY_DAYS * 24 * 60 * 60 * 1000),
    });
  } catch (error) {
    await Promise.all(reservedLines.map(releaseStock));
    if (couponReserved) await releaseCouponUse(claimed.couponCode);
    await Cart.updateOne(
      { user: userId },
      {
        $set: {
          items: claimed.toObject({ depopulate: true }).items,
          couponCode: claimed.couponCode,
        },
      },
    );
    throw error;
  }
}

/** Moves an order to its next status. Only one step forward is allowed. */
export async function advanceOrder(order, status, { by, note = '' }) {
  const expected = NEXT_STATUS[order.status];
  if (status !== expected) {
    const message = expected
      ? `An order that is ${order.status} can only move to ${expected}.`
      : `An order that is ${order.status} cannot change status.`;
    throw ApiError.badRequest(message);
  }

  const update = {
    $set: { status },
    $push: { statusHistory: { status, at: new Date(), note, by } },
  };
  if (status === 'Delivered' && order.payment.method === 'COD') {
    update.$set['payment.status'] = 'Paid';
  }

  // Matching the current status means a stale admin screen cannot apply a change twice.
  const updated = await Order.findOneAndUpdate({ _id: order._id, status: order.status }, update, {
    returnDocument: 'after',
  });
  if (!updated) throw ApiError.conflict('This order was just updated. Refresh and try again.');
  return updated;
}

/** Cancels an order and gives back its stock and coupon use. */
export async function cancelOrder(order, { by, reason }) {
  const note = reason || 'Cancelled';
  const paymentStatus = order.payment.status === 'Paid' ? 'Refunded' : 'Cancelled';

  // Only one request can win this update, so stock is never restored twice.
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, status: { $in: CANCELLABLE } },
    {
      $set: { status: 'Cancelled', cancelReason: note, 'payment.status': paymentStatus },
      $push: { statusHistory: { status: 'Cancelled', at: new Date(), note, by } },
    },
    { returnDocument: 'after' },
  );
  if (!updated) throw ApiError.badRequest('This order can no longer be cancelled.');

  await Promise.all(updated.items.map(releaseStock));
  if (updated.couponCode) await releaseCouponUse(updated.couponCode);
  return updated;
}
