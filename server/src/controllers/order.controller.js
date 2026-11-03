import { Order, User } from '../models/index.js';
import {
  advanceOrder,
  cancelOrder,
  placeOrder,
  requestReturn,
  resolveReturn,
  returnWindowEnd,
  trackingView,
} from '../services/order.service.js';
import { ApiError } from '../utils/ApiError.js';
import { escapeRegex, ok, paginate } from '../utils/http.js';

/** Adds when returns close, so the client never has to work it out. */
function withReturnWindow(order) {
  const json = order.toJSON();
  json.returnWindowEndsAt = order.status === 'Delivered' ? returnWindowEnd(order) : null;
  return json;
}

export async function createOrder(req, res) {
  const order = await placeOrder(req.user._id, req.validated.body);
  ok(res, order, { status: 201 });
}

export async function myOrders(req, res) {
  const { status, ...pageQuery } = req.validated.query;
  const { skip, limit, meta } = paginate(pageQuery);
  const filter = { user: req.user._id, ...(status && { status }) };
  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit),
    Order.countDocuments(filter),
  ]);
  ok(res, orders, { meta: meta(total) });
}

/**
 * Loads an order the user may see. Others get "not found", so ids can't be probed.
 * Only the customer sees the delivery code, so the store has to ask for it.
 */
async function requireVisibleOrder(req) {
  const order = await Order.findById(req.validated.params.id)
    .select('+delivery.code')
    .populate('user', 'name email phone');
  const isOwner = order?.user?._id.equals(req.user._id);
  if (!order || !(isOwner || req.user.role === 'admin')) {
    throw ApiError.notFound('That order was not found.');
  }
  if (!isOwner) order.delivery.code = undefined;
  return order;
}

export async function getOrder(req, res) {
  ok(res, withReturnWindow(await requireVisibleOrder(req)));
}

export async function cancelMyOrder(req, res) {
  const order = await requireVisibleOrder(req);
  const updated = await cancelOrder(order, {
    by: req.user._id,
    reason: req.validated.body.reason || 'Cancelled by the customer',
  });
  ok(res, updated);
}

export async function requestMyReturn(req, res) {
  const order = await requireVisibleOrder(req);
  if (!order.user._id.equals(req.user._id)) throw ApiError.forbidden('Only the customer can ask to return an order.');
  ok(res, withReturnWindow(await requestReturn(order, req.validated.body)));
}

export async function listOrders(req, res) {
  const { status, returnStatus, search, from, to, ...pageQuery } = req.validated.query;
  const { skip, limit, meta } = paginate(pageQuery);
  const filter = {};
  if (status) filter.status = status;
  if (returnStatus) filter['returnRequest.status'] = returnStatus;
  if (from || to) {
    filter.createdAt = { ...(from && { $gte: from }), ...(to && { $lte: to }) };
  }
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    const users = await User.find({ $or: [{ name: pattern }, { email: pattern }] }).select('_id');
    filter.$or = [
      { orderNumber: pattern },
      { 'delivery.trackingNumber': pattern },
      { user: { $in: users.map((user) => user._id) } },
    ];
  }
  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate('user', 'name email')
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit),
    Order.countDocuments(filter),
  ]);
  ok(res, orders, { meta: meta(total) });
}

export async function updateOrderStatus(req, res) {
  const order = await Order.findById(req.validated.params.id);
  if (!order) throw ApiError.notFound('That order was not found.');
  const { status, note, code } = req.validated.body;
  const updated =
    status === 'Cancelled'
      ? await cancelOrder(order, { by: req.user._id, reason: note || 'Cancelled by the store' })
      : await advanceOrder(order, status, { by: req.user._id, note, code });
  ok(res, updated);
}

export async function decideReturn(req, res) {
  const order = await Order.findById(req.validated.params.id);
  if (!order) throw ApiError.notFound('That order was not found.');
  const updated = await resolveReturn(order, { ...req.validated.body, by: req.user._id });
  ok(res, withReturnWindow(updated));
}

/** Public: anyone with the tracking number can follow the parcel. */
export async function trackShipment(req, res) {
  const order = await Order.findOne({ 'delivery.trackingNumber': req.validated.params.trackingNumber });
  if (!order) throw ApiError.notFound('No shipment has that tracking number. Check it and try again.');
  ok(res, trackingView(order));
}
