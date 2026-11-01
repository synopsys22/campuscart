import { Kit, Product } from '../models/index.js';
import { addManyItems, buildCartView } from '../services/cart.service.js';
import { ApiError } from '../utils/ApiError.js';
import { ok, uniqueSlug } from '../utils/http.js';

const PRODUCT_FIELDS = 'name slug brand price mrp stock images isActive ratingAvg ratingCount';

/** Adds live totals and availability, which are never stored on the kit. */
function describeKit(kit) {
  const items = kit.items.filter((item) => item.product);
  // Hidden products can't be added to the cart, so they don't count towards the total.
  const sellable = items.filter((item) => item.product.isActive);
  const sum = (pick) => sellable.reduce((total, item) => total + pick(item), 0);
  return {
    ...kit.toObject(),
    items,
    totalPrice: sum((item) => item.product.price * item.qty),
    mrpTotal: sum((item) => item.product.mrp * item.qty),
    itemCount: sum((item) => item.qty),
    inStock: items.every((item) => item.product.isActive && item.product.stock >= item.qty),
  };
}

const isAdmin = (req) => req.user?.role === 'admin';

export async function listKits(req, res) {
  const filter = isAdmin(req) && req.query.includeInactive === 'true' ? {} : { isActive: true };
  const kits = await Kit.find(filter)
    .populate('items.product', PRODUCT_FIELDS)
    .sort({ isFeatured: -1, semester: 1, name: 1 });
  ok(res, kits.map(describeKit));
}

export async function getKit(req, res) {
  const filter = { slug: req.params.slug, ...(!isAdmin(req) && { isActive: true }) };
  const kit = await Kit.findOne(filter).populate('items.product', PRODUCT_FIELDS);
  if (!kit) throw ApiError.notFound('That kit was not found.');
  ok(res, describeKit(kit));
}

async function assertProductsExist(items) {
  const ids = [...new Set(items.map((item) => item.product))];
  const found = await Product.countDocuments({ _id: { $in: ids } });
  if (found !== ids.length) {
    throw ApiError.badRequest('Please check the highlighted fields.', {
      items: 'One of these products does not exist.',
    });
  }
}

export async function createKit(req, res) {
  const body = req.validated.body;
  await assertProductsExist(body.items);
  const kit = await Kit.create({ ...body, slug: await uniqueSlug(Kit, body.name) });
  ok(res, kit, { status: 201 });
}

async function requireKit(id) {
  const kit = await Kit.findById(id);
  if (!kit) throw ApiError.notFound('That kit was not found.');
  return kit;
}

export async function updateKit(req, res) {
  const kit = await requireKit(req.validated.params.id);
  if (req.validated.body.items) await assertProductsExist(req.validated.body.items);
  kit.set(req.validated.body);
  await kit.save();
  ok(res, kit);
}

export async function deleteKit(req, res) {
  const kit = await requireKit(req.validated.params.id);
  await kit.deleteOne();
  ok(res, { deleted: true });
}

export async function addKitToCart(req, res) {
  const kit = await Kit.findOne({ _id: req.validated.params.id, isActive: true }).populate('items.product');
  if (!kit) throw ApiError.notFound('That kit was not found.');
  const { cart, added, skipped } = await addManyItems(req.user._id, kit.items);
  ok(res, { cart: await buildCartView(cart, req.user._id), added, skipped });
}
