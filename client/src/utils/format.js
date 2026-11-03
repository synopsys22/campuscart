const rupees = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export const formatINR = (amount) => rupees.format(amount ?? 0);

// The same delivery rules as server/src/services/delivery.service.js, which sets what is actually charged.
const FREE_DELIVERY_FROM = 999;
const DELIVERY_FEE = 49;

/** What delivery costs for one unit, so the cost is clear before anything is added to the cart. */
export function deliveryNote(price) {
  if (price >= FREE_DELIVERY_FROM) return 'Free delivery.';
  return `${formatINR(DELIVERY_FEE)} delivery, free on orders of ${formatINR(FREE_DELIVERY_FROM)} or more.`;
}

export function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** A delivery date as people say it: "Thu, 5 Nov". */
export function formatDay(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function formatDateTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export const discountPercent = (price, mrp) => (mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0);

export const PAYMENT_LABELS = {
  COD: 'Cash on Delivery',
  MOCK_UPI: 'UPI (demo)',
  MOCK_CARD: 'Card (demo)',
  WALLET: 'CampusCart Wallet',
};

export const DELIVERY_LABELS = {
  standard: 'Standard delivery',
  express: 'Express delivery',
  pickup: 'Campus pickup',
};

/** What a status means to the customer. Pickup orders wait at a desk instead of travelling to a door. */
export function statusLabel(status, method = 'standard') {
  if (method === 'pickup') {
    if (status === 'Shipped') return 'On its way to the pickup point';
    if (status === 'Out for Delivery') return 'Ready for pickup';
    if (status === 'Delivered') return 'Collected';
  }
  if (status === 'Pending') return 'Order placed';
  return status;
}

/** Where a refund went, in plain words. */
export function refundNote(order, { forAdmin = false } = {}) {
  if (order.payment.status !== 'Refunded') return null;
  if (order.payment.refundedTo === 'wallet') {
    return `${formatINR(order.total)} refunded to ${forAdmin ? "the customer's" : 'your'} CampusCart wallet.`;
  }
  const { detail } = order.payment;
  const to = !detail || detail === 'UPI QR code' ? 'the account that paid' : detail;
  return `${formatINR(order.total)} refunded to ${to}.`;
}

export function couponSummary(coupon) {
  return coupon.type === 'percent' ? `${coupon.value}% off` : `${formatINR(coupon.value)} off`;
}
