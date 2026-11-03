import mongoose from 'mongoose';
import { Cart, Counter, GATEWAY_METHODS, Order, Payment, Product } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { formatINR } from '../utils/http.js';
import { stockMessage } from './cart.service.js';
import { releaseCouponUse, requireUsableCoupon, reserveCouponUse } from './coupon.service.js';
import {
  courierFor,
  findPickupPoint,
  findPickupSlot,
  newDeliveryCode,
  newTrackingNumber,
  requireDeliveryDate,
} from './delivery.service.js';
import { describePayment, markRefunded, recordSettledPayment } from './payment.service.js';
import { calculateTotals } from './pricing.service.js';
import { creditWallet, debitWallet } from './wallet.service.js';

const NEXT_STATUS = {
  Pending: 'Confirmed',
  Confirmed: 'Shipped',
  Shipped: 'Out for Delivery',
  'Out for Delivery': 'Delivered',
};
export const CANCELLABLE = ['Pending', 'Confirmed'];
export const RETURN_WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

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

/** A card or UPI payment must have gone through, belong to this user and not be used yet. */
async function requireUsablePayment(userId, paymentId, method) {
  const payment = await Payment.findOne({ _id: paymentId, user: userId, purpose: 'order' });
  if (!payment || payment.method !== method) throw ApiError.badRequest('That payment was not found. Pay again to continue.');
  if (payment.order) throw ApiError.badRequest('This payment has already been used for another order.');
  if (payment.status !== 'Succeeded') throw ApiError.badRequest('This payment has not gone through yet.');
  return payment;
}

function deliveryDetails({ method, pickupPoint, pickupSlot }) {
  if (method !== 'pickup') return { method };
  return { method, pickupPoint: findPickupPoint(pickupPoint).name, pickupSlot: findPickupSlot(pickupSlot).label };
}

/**
 * Turns the user's cart into an order. MongoDB transactions need a replica set and this
 * app runs on a single server, so each step that changes shared data is undone by hand
 * if a later step fails. That includes giving back money already taken.
 */
export async function placeOrder(userId, { delivery, address, paymentMethod, paymentId }) {
  const now = new Date();
  // Checked before the cart is touched, so a bad choice changes nothing.
  const estimatedDelivery = requireDeliveryDate({ method: delivery.method, pincode: address?.pincode }, now);
  const gatewayPayment = GATEWAY_METHODS.includes(paymentMethod)
    ? await requireUsablePayment(userId, paymentId, paymentMethod)
    : null;

  // Emptying the cart first means a double-clicked "Place order" cannot create two orders.
  const claimed = await Cart.findOneAndUpdate(
    { user: userId, 'items.0': { $exists: true } },
    { $set: { items: [], couponCode: null } },
  );
  if (!claimed) throw ApiError.badRequest('Your cart is empty.');

  const orderId = new mongoose.Types.ObjectId();
  const reservedLines = [];
  let couponReserved = false;
  let walletPayment = null;

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
    const totals = calculateTotals(lines, coupon, delivery.method);

    // A price or coupon can change while the payment screen is open.
    if (gatewayPayment && gatewayPayment.amount !== totals.total) {
      throw ApiError.badRequest(
        `Your total changed to ${formatINR(totals.total)} while you were paying ${formatINR(gatewayPayment.amount)}.`,
      );
    }

    for (const line of lines) {
      await reserveStock(line);
      reservedLines.push(line);
    }
    if (coupon) {
      await reserveCouponUse(coupon.code);
      couponReserved = true;
    }

    const orderNumber = await nextOrderNumber(now);
    const payment = { method: paymentMethod, status: 'Pending', transactionRef: null, detail: '', record: null };

    if (gatewayPayment) {
      // Only one order can claim a payment.
      const used = await Payment.findOneAndUpdate(
        { _id: gatewayPayment._id, status: 'Succeeded', order: null },
        { $set: { order: orderId, orderNumber } },
        { returnDocument: 'after' },
      );
      if (!used) throw ApiError.badRequest('This payment has already been used for another order.');
      Object.assign(payment, {
        status: 'Paid',
        transactionRef: used.reference,
        detail: describePayment(used),
        record: used._id,
      });
    } else if (paymentMethod === 'WALLET') {
      await debitWallet(userId, totals.total, {
        kind: 'payment',
        description: `Paid for order ${orderNumber}`,
        order: orderId,
        orderNumber,
      });
      walletPayment = await recordSettledPayment({
        user: userId,
        method: 'WALLET',
        amount: totals.total,
        order: orderId,
        orderNumber,
        prefix: 'WAL',
      });
      Object.assign(payment, {
        status: 'Paid',
        transactionRef: walletPayment.reference,
        detail: 'CampusCart wallet',
        record: walletPayment._id,
      });
    }

    return await Order.create({
      _id: orderId,
      orderNumber,
      user: userId,
      items: lines,
      delivery: deliveryDetails(delivery),
      shippingAddress: delivery.method === 'pickup' ? null : address,
      payment,
      subtotal: totals.subtotal,
      discount: totals.discount,
      couponCode: coupon?.code ?? null,
      shippingFee: totals.shippingFee,
      total: totals.total,
      status: 'Pending',
      statusHistory: [{ status: 'Pending', at: now, note: 'Order placed', by: userId }],
      estimatedDelivery,
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
    if (walletPayment) {
      await creditWallet(userId, walletPayment.amount, {
        kind: 'reversal',
        description: `Returned because order ${walletPayment.orderNumber} could not be placed`,
      });
      await markRefunded(walletPayment._id, { amount: walletPayment.amount, reason: 'The order could not be placed', to: 'wallet' });
    }
    if (gatewayPayment) {
      // The money was taken, so it goes straight back, unless another order owns this payment.
      const refunded = await markRefunded(
        gatewayPayment._id,
        { amount: gatewayPayment.amount, reason: 'The order could not be placed', to: 'source' },
        { order: { $in: [null, orderId] } },
      );
      if (refunded && error instanceof ApiError) {
        error.message = `${error.message} Your payment of ${formatINR(gatewayPayment.amount)} has been refunded.`;
      }
    }
    throw error;
  }
}

/** Where a refund goes: card and UPI money goes back to its source, everything else to the wallet. */
function refundDestination(method) {
  return GATEWAY_METHODS.includes(method) ? 'source' : 'wallet';
}

async function issueRefund(order, reason) {
  const to = order.payment.refundedTo;
  if (to === 'wallet') {
    await creditWallet(order.user?._id ?? order.user, order.total, {
      kind: 'refund',
      description: `Refund for order ${order.orderNumber}`,
      order: order._id,
      orderNumber: order.orderNumber,
    });
  }
  if (order.payment.record) await markRefunded(order.payment.record, { amount: order.total, reason, to });
}

function defaultNote(order, status) {
  const { delivery } = order;
  const pickup = delivery.method === 'pickup';
  switch (status) {
    case 'Confirmed':
      return 'Confirmed and being packed';
    case 'Shipped':
      return pickup ? `Sent to ${delivery.pickupPoint}` : `Handed to ${delivery.courier}`;
    case 'Out for Delivery':
      return pickup
        ? `Ready at ${delivery.pickupPoint}, ${delivery.pickupSlot}`
        : `Out for delivery in ${order.shippingAddress?.city ?? 'your city'}`;
    case 'Delivered':
      return pickup ? 'Collected. Delivery code checked' : 'Delivered. Delivery code checked';
    default:
      return '';
  }
}

/** Moves an order to its next status. Only one step forward is allowed. */
export async function advanceOrder(order, status, { by, note = '', code }) {
  const expected = NEXT_STATUS[order.status];
  if (status !== expected) {
    const message = expected
      ? `An order that is ${order.status} can only move to ${expected}.`
      : `An order that is ${order.status} cannot change status.`;
    throw ApiError.badRequest(message);
  }

  const set = { status };
  const delivery = order.delivery.toObject();
  // Orders that shipped before tracking existed get a tracking number at their next step.
  if (status === 'Shipped' || (status === 'Out for Delivery' && !delivery.trackingNumber)) {
    delivery.courier ??= courierFor(delivery.method);
    delivery.trackingNumber ??= newTrackingNumber();
    set['delivery.courier'] = delivery.courier;
    set['delivery.trackingNumber'] = delivery.trackingNumber;
  }
  if (status === 'Out for Delivery') set['delivery.code'] = newDeliveryCode();
  if (status === 'Delivered') {
    if (!code) throw ApiError.badRequest('Enter the 4-digit delivery code the customer gives you.');
    const stored = await Order.findById(order._id).select('+delivery.code');
    if (stored.delivery.code !== code) {
      throw ApiError.badRequest("That delivery code doesn't match. Ask the customer to read it from their order page.");
    }
    set['delivery.code'] = null;
    if (order.payment.method === 'COD') set['payment.status'] = 'Paid';
  }

  const event = { status, at: new Date(), note: note || defaultNote({ ...order.toObject(), delivery }, status), by };
  // Matching the current status means a stale admin screen cannot apply a change twice.
  let updated = await Order.findOneAndUpdate(
    { _id: order._id, status: order.status },
    { $set: set, $push: { statusHistory: event } },
    { returnDocument: 'after' },
  );
  if (!updated) throw ApiError.conflict('This order was just updated. Refresh and try again.');

  // Cash collected on delivery becomes a payment record, like any other payment.
  if (status === 'Delivered' && order.payment.method === 'COD') {
    const record = await recordSettledPayment({
      user: updated.user,
      method: 'COD',
      amount: updated.total,
      order: updated._id,
      orderNumber: updated.orderNumber,
      prefix: 'COD',
    });
    updated = await Order.findByIdAndUpdate(
      updated._id,
      { $set: { 'payment.record': record._id, 'payment.transactionRef': record.reference, 'payment.detail': 'Cash collected on delivery' } },
      { returnDocument: 'after' },
    );
  }
  return updated;
}

/** Cancels an order and gives back its stock, coupon use and any money paid. */
export async function cancelOrder(order, { by, reason }) {
  const note = reason || 'Cancelled';
  const paid = order.payment.status === 'Paid';

  // Only one request can win this update, so stock and money are never returned twice.
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, status: { $in: CANCELLABLE } },
    {
      $set: {
        status: 'Cancelled',
        cancelReason: note,
        'payment.status': paid ? 'Refunded' : 'Cancelled',
        'payment.refundedTo': paid ? refundDestination(order.payment.method) : null,
      },
      $push: { statusHistory: { status: 'Cancelled', at: new Date(), note, by } },
    },
    { returnDocument: 'after' },
  );
  if (!updated) throw ApiError.badRequest('This order can no longer be cancelled.');

  await Promise.all(updated.items.map(releaseStock));
  if (updated.couponCode) await releaseCouponUse(updated.couponCode);
  if (paid) await issueRefund(updated, `Order cancelled: ${note}`);
  return updated;
}

/** When the return window for a delivered order closes, or null if it was never delivered. */
export function returnWindowEnd(order) {
  const delivered = order.statusHistory.findLast((event) => event.status === 'Delivered');
  return delivered ? new Date(delivered.at.getTime() + RETURN_WINDOW_DAYS * DAY_MS) : null;
}

/** The customer asks to send a delivered order back. */
export async function requestReturn(order, { reason, comment }) {
  if (order.status !== 'Delivered') throw ApiError.badRequest('Only a delivered order can be returned.');
  if (order.returnRequest) throw ApiError.badRequest('A return has already been requested for this order.');
  const closes = returnWindowEnd(order);
  if (!closes || closes < new Date()) {
    throw ApiError.badRequest(`Returns are open for ${RETURN_WINDOW_DAYS} days after delivery, and this order's window has closed.`);
  }

  const updated = await Order.findOneAndUpdate(
    { _id: order._id, status: 'Delivered', returnRequest: null },
    { $set: { returnRequest: { status: 'Requested', reason, comment, requestedAt: new Date() } } },
    { returnDocument: 'after' },
  );
  if (!updated) throw ApiError.conflict('A return has already been requested for this order.');
  return updated;
}

/** The store approves a return, which restocks the items and refunds the order, or rejects it. */
export async function resolveReturn(order, { decision, note = '', by }) {
  if (order.returnRequest?.status !== 'Requested') {
    throw ApiError.badRequest('There is no return waiting for a decision on this order.');
  }
  const now = new Date();
  const resolution = {
    'returnRequest.resolvedAt': now,
    'returnRequest.resolvedBy': by,
    'returnRequest.resolutionNote': note,
  };

  if (decision === 'reject') {
    const updated = await Order.findOneAndUpdate(
      { _id: order._id, 'returnRequest.status': 'Requested' },
      { $set: { ...resolution, 'returnRequest.status': 'Rejected' } },
      { returnDocument: 'after' },
    );
    if (!updated) throw ApiError.conflict('This return was just decided. Refresh to see the result.');
    return updated;
  }

  const paid = order.payment.status === 'Paid';
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, status: 'Delivered', 'returnRequest.status': 'Requested' },
    {
      $set: {
        ...resolution,
        status: 'Returned',
        'returnRequest.status': 'Approved',
        'returnRequest.refundAmount': paid ? order.total : 0,
        ...(paid && {
          'payment.status': 'Refunded',
          'payment.refundedTo': refundDestination(order.payment.method),
        }),
      },
      $push: {
        statusHistory: { status: 'Returned', at: now, note: note || 'Return approved and refund issued', by },
      },
    },
    { returnDocument: 'after' },
  );
  if (!updated) throw ApiError.conflict('This return was just decided. Refresh to see the result.');

  await Promise.all(updated.items.map(releaseStock));
  if (paid) await issueRefund(updated, `Returned: ${order.returnRequest.reason}`);
  return updated;
}

/** What anyone with the tracking number may see. No names, addresses or delivery code. */
export function trackingView(order) {
  const { delivery, shippingAddress: address } = order;
  return {
    trackingNumber: delivery.trackingNumber,
    courier: delivery.courier,
    method: delivery.method,
    status: order.status,
    destination: delivery.method === 'pickup' ? delivery.pickupPoint : `${address?.city}, ${address?.state}`,
    pickupSlot: delivery.pickupSlot,
    itemCount: order.items.reduce((sum, item) => sum + item.qty, 0),
    placedAt: order.createdAt,
    estimatedDelivery: order.estimatedDelivery,
    events: order.statusHistory.map(({ status, at, note }) => ({ status, at, note })),
  };
}
