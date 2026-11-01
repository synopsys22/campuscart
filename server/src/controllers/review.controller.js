import { Product, Review } from '../models/index.js';
import {
  findDeliveredOrder,
  ratingDistribution,
  refreshProductRating,
} from '../services/review.service.js';
import { ApiError } from '../utils/ApiError.js';
import { ok, paginate } from '../utils/http.js';

const AUTHOR_FIELDS = 'name branch semester';
const NOT_ELIGIBLE = 'You can review this after your order is delivered.';

export async function listProductReviews(req, res) {
  const { id } = req.validated.params;
  const { skip, limit, meta } = paginate(req.validated.query);
  const [reviews, total, distribution] = await Promise.all([
    Review.find({ product: id })
      .populate('user', AUTHOR_FIELDS)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit),
    Review.countDocuments({ product: id }),
    ratingDistribution(id),
  ]);
  ok(res, reviews, { meta: meta(total), summary: { distribution } });
}

export async function reviewEligibility(req, res) {
  const { id } = req.validated.params;
  const existingReview = await Review.findOne({ user: req.user._id, product: id });
  if (existingReview) {
    ok(res, { canReview: false, reason: 'You have already reviewed this product.', existingReview });
    return;
  }
  const order = await findDeliveredOrder(req.user._id, id);
  ok(res, {
    canReview: Boolean(order),
    reason: order ? null : NOT_ELIGIBLE,
    existingReview: null,
    orderId: order?._id ?? null,
  });
}

export async function createReview(req, res) {
  const { id } = req.validated.params;
  if (!(await Product.exists({ _id: id }))) throw ApiError.notFound('That product was not found.');

  const order = await findDeliveredOrder(req.user._id, id);
  if (!order) throw ApiError.forbidden(NOT_ELIGIBLE);
  if (await Review.exists({ user: req.user._id, product: id })) {
    throw ApiError.conflict('You have already reviewed this product.');
  }

  const review = await Review.create({
    ...req.validated.body,
    user: req.user._id,
    product: id,
    order: order._id,
  });
  await refreshProductRating(id);
  ok(res, review, { status: 201 });
}

async function requireReview(id) {
  const review = await Review.findById(id);
  if (!review) throw ApiError.notFound('That review was not found.');
  return review;
}

export async function updateReview(req, res) {
  const review = await requireReview(req.validated.params.id);
  if (!review.user.equals(req.user._id)) throw ApiError.forbidden('You can only edit your own review.');
  review.set(req.validated.body);
  await review.save();
  await refreshProductRating(review.product);
  ok(res, review);
}

export async function deleteReview(req, res) {
  const review = await requireReview(req.validated.params.id);
  if (!review.user.equals(req.user._id) && req.user.role !== 'admin') {
    throw ApiError.forbidden('You can only delete your own review.');
  }
  await review.deleteOne();
  await refreshProductRating(review.product);
  ok(res, { deleted: true });
}

export async function myReviews(req, res) {
  const reviews = await Review.find({ user: req.user._id })
    .populate('product', 'name slug images')
    .sort({ createdAt: -1 });
  ok(res, reviews);
}

export async function listAllReviews(req, res) {
  const { skip, limit, meta } = paginate(req.validated.query);
  const [reviews, total] = await Promise.all([
    Review.find()
      .populate('user', 'name email')
      .populate('product', 'name slug')
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit),
    Review.countDocuments(),
  ]);
  ok(res, reviews, { meta: meta(total) });
}
