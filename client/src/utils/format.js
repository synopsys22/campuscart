const rupees = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export const formatINR = (amount) => rupees.format(amount ?? 0);

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
