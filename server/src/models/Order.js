import mongoose from 'mongoose';
import { DELIVERY_METHODS } from '../services/delivery.service.js';

/** The forward path of an order. Cancelled and Returned end it early. */
export const ORDER_FLOW = ['Pending', 'Confirmed', 'Shipped', 'Out for Delivery', 'Delivered'];
export const ORDER_STATUSES = [...ORDER_FLOW, 'Cancelled', 'Returned'];
export const PAYMENT_METHODS = ['COD', 'MOCK_UPI', 'MOCK_CARD', 'WALLET'];
export const PAYMENT_STATUSES = ['Pending', 'Paid', 'Refunded', 'Cancelled'];
export const RETURN_STATUSES = ['Requested', 'Approved', 'Rejected'];
export const RETURN_REASONS = [
  'Damaged or not working',
  'Wrong item sent',
  'Not as described',
  'No longer needed',
  'Other',
];

// Items and the address are copied onto the order, so later edits to a product
// or an address book entry never change what an old order shows.
const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    slug: { type: String, default: '' },
    sku: { type: String, required: true },
    image: { type: String, default: '' },
    price: { type: Number, required: true },
    qty: { type: Number, required: true, min: 1 },
    lineTotal: { type: Number, required: true },
  },
  { _id: false },
);

const addressSnapshotSchema = new mongoose.Schema(
  {
    label: { type: String, default: '' },
    line1: { type: String, required: true },
    line2: { type: String, default: '' },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
  },
  { _id: false },
);

const deliverySchema = new mongoose.Schema(
  {
    method: { type: String, enum: DELIVERY_METHODS, default: 'standard' },
    // Pickup orders have a campus pickup point and time slot in place of an address.
    pickupPoint: { type: String, default: null },
    pickupSlot: { type: String, default: null },
    // Set when the order ships.
    courier: { type: String, default: null },
    trackingNumber: { type: String, default: null },
    // Set when the order is out for delivery. Only the customer may read it, so the
    // admin has to ask for it before marking the order delivered.
    code: { type: String, default: null, select: false },
  },
  { _id: false },
);

const statusEventSchema = new mongoose.Schema(
  {
    status: { type: String, enum: ORDER_STATUSES, required: true },
    at: { type: Date, default: Date.now },
    note: { type: String, default: '' },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { _id: false },
);

const returnSchema = new mongoose.Schema(
  {
    status: { type: String, enum: RETURN_STATUSES, required: true },
    reason: { type: String, enum: RETURN_REASONS, required: true },
    comment: { type: String, default: '' },
    requestedAt: { type: Date, required: true },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolutionNote: { type: String, default: '' },
    refundAmount: { type: Number, default: null },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: { type: [orderItemSchema], required: true },
    delivery: { type: deliverySchema, default: () => ({}) },
    shippingAddress: { type: addressSnapshotSchema, default: null },
    payment: {
      method: { type: String, enum: PAYMENT_METHODS, required: true },
      status: { type: String, enum: PAYMENT_STATUSES, default: 'Pending' },
      transactionRef: { type: String, default: null },
      // A short description of what paid, such as "Visa ending 1111". Never a full card number.
      detail: { type: String, default: '' },
      record: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },
      refundedTo: { type: String, enum: ['source', 'wallet', null], default: null },
    },
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    couponCode: { type: String, default: null },
    shippingFee: { type: Number, default: 0 },
    total: { type: Number, required: true },
    status: { type: String, enum: ORDER_STATUSES, default: 'Pending' },
    statusHistory: [statusEventSchema],
    cancelReason: { type: String, default: null },
    estimatedDelivery: { type: Date, default: null },
    returnRequest: { type: returnSchema, default: null },
  },
  { timestamps: true },
);

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ 'items.product': 1 });
orderSchema.index({ 'returnRequest.status': 1 });
orderSchema.index(
  { 'delivery.trackingNumber': 1 },
  { unique: true, partialFilterExpression: { 'delivery.trackingNumber': { $type: 'string' } } },
);

export const Order = mongoose.model('Order', orderSchema);
