export const FREE_SHIPPING_MIN = 999;
export const SHIPPING_FEE = 49;

/** The discount a coupon gives on a subtotal. Never more than the subtotal. */
export function calculateDiscount(coupon, subtotal) {
  if (!coupon) return 0;
  let discount = coupon.type === 'percent' ? Math.floor((subtotal * coupon.value) / 100) : coupon.value;
  if (coupon.maxDiscount !== null && coupon.maxDiscount !== undefined) {
    discount = Math.min(discount, coupon.maxDiscount);
  }
  return Math.min(discount, subtotal);
}

/**
 * The single place order totals are calculated, used by both the cart and checkout.
 * Lines are { price, mrp, qty }. Prices already include tax.
 */
export function calculateTotals(lines, coupon = null) {
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.qty, 0);
  const mrpTotal = lines.reduce((sum, line) => sum + (line.mrp ?? line.price) * line.qty, 0);
  const itemCount = lines.reduce((sum, line) => sum + line.qty, 0);
  const discount = calculateDiscount(coupon, subtotal);
  const qualifiesForFreeShipping = subtotal === 0 || subtotal >= FREE_SHIPPING_MIN;
  const shippingFee = qualifiesForFreeShipping ? 0 : SHIPPING_FEE;

  return {
    subtotal,
    discount,
    shippingFee,
    total: subtotal - discount + shippingFee,
    itemCount,
    savings: mrpTotal - subtotal + discount,
    freeShippingThreshold: FREE_SHIPPING_MIN,
    amountToFreeShipping: qualifiesForFreeShipping ? 0 : FREE_SHIPPING_MIN - subtotal,
  };
}
