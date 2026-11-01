const rupees = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export const formatINR = (amount) => rupees.format(amount ?? 0);

// The same delivery rules as server/src/services/pricing.service.js, which sets what is actually charged.
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
};

export function couponSummary(coupon) {
  return coupon.type === 'percent' ? `${coupon.value}% off` : `${formatINR(coupon.value)} off`;
}
