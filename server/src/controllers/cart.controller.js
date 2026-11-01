import * as cartService from '../services/cart.service.js';
import { ok } from '../utils/http.js';

const sendCart = async (req, res, cart) => {
  ok(res, await cartService.buildCartView(cart, req.user._id));
};

export async function getCart(req, res) {
  await sendCart(req, res, await cartService.getOrCreateCart(req.user._id));
}

export async function addItem(req, res) {
  const { productId, qty } = req.validated.body;
  await sendCart(req, res, await cartService.addItem(req.user._id, productId, qty));
}

export async function updateItem(req, res) {
  const { productId } = req.validated.params;
  await sendCart(req, res, await cartService.setItemQuantity(req.user._id, productId, req.validated.body.qty));
}

export async function removeItem(req, res) {
  await sendCart(req, res, await cartService.removeItem(req.user._id, req.validated.params.productId));
}

export async function clearCart(req, res) {
  await sendCart(req, res, await cartService.clearCart(req.user._id));
}

export async function applyCoupon(req, res) {
  await sendCart(req, res, await cartService.applyCoupon(req.user._id, req.validated.body.code));
}

export async function removeCoupon(req, res) {
  await sendCart(req, res, await cartService.removeCoupon(req.user._id));
}
