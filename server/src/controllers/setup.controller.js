import { Product, SETUP_SLOTS, Setup } from '../models/index.js';
import { addManyItems, buildCartView } from '../services/cart.service.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/http.js';

const SLOT_LABELS = {
  laptop: 'Laptop',
  mouse: 'Mouse',
  keyboard: 'Keyboard',
  monitor: 'Monitor',
  headset: 'Headset',
  storage: 'Storage',
  bag: 'Backpack',
};

const PRODUCT_FIELDS = 'name slug brand price mrp stock images isActive setupSlot ratingAvg ratingCount';

function describeSetup(setup) {
  const slots = setup.slots.filter((entry) => entry.product);
  const total = slots.reduce((sum, entry) => sum + entry.product.price, 0);
  return {
    ...setup.toObject(),
    slots,
    total,
    overBudget: setup.budget !== null && setup.budget !== undefined && total > setup.budget,
  };
}

export async function listSlots(req, res) {
  const products = await Product.find({
    isActive: true,
    stock: { $gt: 0 },
    setupSlot: { $ne: null },
  })
    .select(PRODUCT_FIELDS)
    .sort({ price: 1 });

  ok(
    res,
    SETUP_SLOTS.map((slot) => ({
      slot,
      label: SLOT_LABELS[slot],
      products: products.filter((product) => product.setupSlot === slot),
    })),
  );
}

async function assertSlotsMatch(slots) {
  const products = await Product.find({ _id: { $in: slots.map((entry) => entry.product) } });
  const slotById = new Map(products.map((product) => [product._id.toString(), product.setupSlot]));
  for (const entry of slots) {
    if (slotById.get(entry.product) !== entry.slot) {
      throw ApiError.badRequest('Please check the highlighted fields.', {
        slots: `That product can't go in the ${SLOT_LABELS[entry.slot]} slot.`,
      });
    }
  }
}

export async function listSetups(req, res) {
  const setups = await Setup.find({ user: req.user._id })
    .populate('slots.product', PRODUCT_FIELDS)
    .sort({ updatedAt: -1 });
  ok(res, setups.map(describeSetup));
}

export async function createSetup(req, res) {
  const body = req.validated.body;
  await assertSlotsMatch(body.slots);
  const setup = await Setup.create({ ...body, user: req.user._id });
  await setup.populate('slots.product', PRODUCT_FIELDS);
  ok(res, describeSetup(setup), { status: 201 });
}

/** Loads a build owned by the current user. Anyone else's build reads as not found. */
async function requireOwnSetup(req) {
  const setup = await Setup.findOne({ _id: req.validated.params.id, user: req.user._id });
  if (!setup) throw ApiError.notFound('That build was not found.');
  return setup;
}

export async function updateSetup(req, res) {
  const setup = await requireOwnSetup(req);
  const body = req.validated.body;
  if (body.slots) await assertSlotsMatch(body.slots);
  setup.set(body);
  await setup.save();
  await setup.populate('slots.product', PRODUCT_FIELDS);
  ok(res, describeSetup(setup));
}

export async function deleteSetup(req, res) {
  const setup = await requireOwnSetup(req);
  await setup.deleteOne();
  ok(res, { deleted: true });
}

export async function addSetupToCart(req, res) {
  const setup = await requireOwnSetup(req);
  await setup.populate('slots.product');
  const entries = setup.slots.map((entry) => ({ product: entry.product, qty: 1 }));
  const { cart, added, skipped } = await addManyItems(req.user._id, entries);
  ok(res, { cart: await buildCartView(cart, req.user._id), added, skipped });
}
