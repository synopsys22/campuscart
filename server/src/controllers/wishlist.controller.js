import { Product, User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/http.js';

async function wishlistFor(userId) {
  const user = await User.findById(userId).populate({
    path: 'wishlist',
    match: { isActive: true },
    populate: { path: 'category', select: 'name slug icon' },
  });
  return user.wishlist.filter(Boolean);
}

export async function getWishlist(req, res) {
  ok(res, await wishlistFor(req.user._id));
}

export async function addToWishlist(req, res) {
  const { productId } = req.validated.params;
  if (!(await Product.exists({ _id: productId, isActive: true }))) {
    throw ApiError.notFound('That product was not found.');
  }
  await User.updateOne({ _id: req.user._id }, { $addToSet: { wishlist: productId } });
  ok(res, await wishlistFor(req.user._id));
}

export async function removeFromWishlist(req, res) {
  await User.updateOne({ _id: req.user._id }, { $pull: { wishlist: req.validated.params.productId } });
  ok(res, await wishlistFor(req.user._id));
}
