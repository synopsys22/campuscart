import { Coupon, Order } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { formatINR } from '../utils/http.js';

/** Returns the coupon if it can be used on this subtotal, otherwise throws the reason why not. */
export async function requireUsableCoupon(code, subtotal, userId) {
  const coupon = await Coupon.findOne({ code: code.toUpperCase() });
  if (!coupon || !coupon.isActive) throw ApiError.badRequest("That coupon code isn't valid.");

  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) throw ApiError.badRequest("This coupon isn't active yet.");
  if (coupon.expiresAt && coupon.expiresAt < now) throw ApiError.badRequest('This coupon has expired.');
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    throw ApiError.badRequest('This coupon has been fully redeemed.');
  }
  if (subtotal < coupon.minOrder) {
    throw ApiError.badRequest(`This coupon needs a minimum order of ${formatINR(coupon.minOrder)}.`);
  }
  if (coupon.perUserLimit !== null) {
    const timesUsed = await Order.countDocuments({
      user: userId,
      couponCode: coupon.code,
      status: { $ne: 'Cancelled' },
    });
    if (timesUsed >= coupon.perUserLimit) throw ApiError.badRequest("You've already used this coupon.");
  }
  return coupon;
}

/** Counts one use, without ever passing the limit even when orders arrive together. */
export async function reserveCouponUse(code) {
  const reserved = await Coupon.findOneAndUpdate(
    {
      code,
      $or: [{ usageLimit: null }, { $expr: { $lt: ['$usedCount', '$usageLimit'] } }],
    },
    { $inc: { usedCount: 1 } },
  );
  if (!reserved) throw ApiError.badRequest('This coupon has been fully redeemed.');
}

export async function releaseCouponUse(code) {
  await Coupon.updateOne({ code, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } });
}

/** Coupons that are live right now, for display at checkout. */
export function findAvailableCoupons() {
  const now = new Date();
  return Coupon.find({
    isActive: true,
    $and: [
      { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
      { $or: [{ expiresAt: null }, { expiresAt: { $gte: now } }] },
      { $or: [{ usageLimit: null }, { $expr: { $lt: ['$usedCount', '$usageLimit'] } }] },
    ],
  })
    .select('code description type value minOrder maxDiscount expiresAt')
    .sort({ value: -1 });
}
