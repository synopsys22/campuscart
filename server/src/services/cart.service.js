import { Cart, Product } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { requireUsableCoupon } from './coupon.service.js';
import { calculateTotals } from './pricing.service.js';

const PRODUCT_FIELDS = 'name slug sku brand price mrp stock images isActive';

export function stockMessage(stock) {
  return stock === 0 ? 'Out of stock' : `Only ${stock} left in stock`;
}

export async function getOrCreateCart(userId) {
  return Cart.findOneAndUpdate(
    { user: userId },
    { $setOnInsert: { user: userId, items: [], couponCode: null } },
    { upsert: true, returnDocument: 'after' },
  );
}

function describeItem({ product, qty }) {
  let issue = null;
  if (!product.isActive) issue = 'No longer available';
  else if (product.stock < qty) issue = stockMessage(product.stock);

  return {
    product,
    qty,
    lineTotal: product.price * qty,
    available: issue === null,
    issue,
  };
}

/** Builds what the client sees: live prices, stock warnings and totals. */
export async function buildCartView(cart, userId) {
  await cart.populate('items.product', PRODUCT_FIELDS);
  const items = cart.items.filter((item) => item.product).map(describeItem);
  const lines = items.map(({ product, qty }) => ({ price: product.price, mrp: product.mrp, qty }));

  let coupon = null;
  let couponError = null;
  if (cart.couponCode) {
    const { subtotal } = calculateTotals(lines);
    try {
      coupon = await requireUsableCoupon(cart.couponCode, subtotal, userId);
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      couponError = error.message;
    }
  }

  return {
    items,
    couponCode: cart.couponCode,
    couponError,
    coupon: coupon && { code: coupon.code, description: coupon.description },
    pricing: calculateTotals(lines, coupon),
    // A coupon that no longer applies would be refused when the order is placed.
    canCheckout: items.length > 0 && items.every((item) => item.available) && !couponError,
  };
}

async function requireSellableProduct(productId) {
  const product = await Product.findOne({ _id: productId, isActive: true });
  if (!product) throw ApiError.notFound('That product is no longer available.');
  return product;
}

function assertInStock(product, qty) {
  if (product.stock < qty) throw ApiError.badRequest(`${stockMessage(product.stock)}.`);
}

export async function addItem(userId, productId, qty) {
  const product = await requireSellableProduct(productId);
  const cart = await getOrCreateCart(userId);
  const existing = cart.items.find((item) => item.product.equals(product._id));
  const newQty = (existing?.qty ?? 0) + qty;
  assertInStock(product, newQty);

  if (existing) existing.qty = newQty;
  else cart.items.push({ product: product._id, qty });
  await cart.save();
  return cart;
}

export async function setItemQuantity(userId, productId, qty) {
  const product = await requireSellableProduct(productId);
  const cart = await getOrCreateCart(userId);
  const existing = cart.items.find((item) => item.product.equals(product._id));
  if (!existing) throw ApiError.notFound('That item is not in your cart.');
  assertInStock(product, qty);

  existing.qty = qty;
  await cart.save();
  return cart;
}

export async function removeItem(userId, productId) {
  const cart = await getOrCreateCart(userId);
  cart.items = cart.items.filter((item) => !item.product.equals(productId));
  await cart.save();
  return cart;
}

export async function clearCart(userId) {
  const cart = await getOrCreateCart(userId);
  cart.items = [];
  cart.couponCode = null;
  await cart.save();
  return cart;
}

export async function applyCoupon(userId, code) {
  const cart = await getOrCreateCart(userId);
  if (cart.items.length === 0) throw ApiError.badRequest('Add something to your cart first.');

  await cart.populate('items.product', PRODUCT_FIELDS);
  const lines = cart.items
    .filter((item) => item.product)
    .map(({ product, qty }) => ({ price: product.price, qty }));
  const { subtotal } = calculateTotals(lines);
  await requireUsableCoupon(code, subtotal, userId);

  cart.couponCode = code;
  await cart.save();
  return cart;
}

export async function removeCoupon(userId) {
  const cart = await getOrCreateCart(userId);
  cart.couponCode = null;
  await cart.save();
  return cart;
}

/**
 * Adds several products at once (for kits and saved setups). Items that cannot be
 * added are reported instead of failing the whole action.
 */
export async function addManyItems(userId, entries) {
  const cart = await getOrCreateCart(userId);
  const added = [];
  const skipped = [];

  for (const { product, qty } of entries) {
    if (!product || !product.isActive) {
      skipped.push({ name: product?.name ?? 'Unavailable item', reason: 'No longer available' });
      continue;
    }
    const existing = cart.items.find((item) => item.product.equals(product._id));
    const newQty = (existing?.qty ?? 0) + qty;
    if (product.stock < newQty) {
      skipped.push({ name: product.name, reason: stockMessage(product.stock) });
      continue;
    }
    if (existing) existing.qty = newQty;
    else cart.items.push({ product: product._id, qty });
    added.push({ name: product.name, qty });
  }

  await cart.save();
  return { cart, added, skipped };
}
