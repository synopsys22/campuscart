import mongoose from 'mongoose';
import { Order, Product, Review } from '../models/index.js';

/** Recalculates a product's rating from its reviews, rounded to one decimal place. */
export async function refreshProductRating(productId) {
  const [stats] = await Review.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(productId) } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  await Product.updateOne(
    { _id: productId },
    {
      ratingAvg: stats ? Math.round(stats.avg * 10) / 10 : 0,
      ratingCount: stats?.count ?? 0,
    },
  );
}

/** The user's delivered order containing this product, if there is one. */
export function findDeliveredOrder(userId, productId) {
  return Order.findOne({ user: userId, status: 'Delivered', 'items.product': productId })
    .sort({ createdAt: -1 })
    .select('_id');
}

/** How many reviews a product has at each star level, for the rating breakdown. */
export async function ratingDistribution(productId) {
  const rows = await Review.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(productId) } },
    { $group: { _id: '$rating', count: { $sum: 1 } } },
  ]);
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const row of rows) distribution[row._id] = row.count;
  return distribution;
}
