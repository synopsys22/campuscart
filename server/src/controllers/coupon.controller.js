import { Coupon } from '../models/index.js';
import { findAvailableCoupons } from '../services/coupon.service.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/http.js';

export async function availableCoupons(req, res) {
  ok(res, await findAvailableCoupons());
}

export async function listCoupons(req, res) {
  ok(res, await Coupon.find().sort({ createdAt: -1 }));
}

export async function createCoupon(req, res) {
  ok(res, await Coupon.create(req.validated.body), { status: 201 });
}

async function requireCoupon(id) {
  const coupon = await Coupon.findById(id);
  if (!coupon) throw ApiError.notFound('That coupon was not found.');
  return coupon;
}

export async function updateCoupon(req, res) {
  const coupon = await requireCoupon(req.validated.params.id);
  coupon.set(req.validated.body);
  if (coupon.type === 'percent' && coupon.value > 100) {
    throw ApiError.badRequest('Please check the highlighted fields.', {
      value: 'A percent discount cannot be above 100.',
    });
  }
  await coupon.save();
  ok(res, coupon);
}

export async function deleteCoupon(req, res) {
  const coupon = await requireCoupon(req.validated.params.id);
  await coupon.deleteOne();
  ok(res, { deleted: true });
}
