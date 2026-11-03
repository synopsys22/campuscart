import mongoose from 'mongoose';
import {
  Cart,
  Category,
  Counter,
  Coupon,
  Kit,
  Order,
  Payment,
  Product,
  Review,
  Setup,
  User,
  WalletTransaction,
} from '../src/models/index.js';
import { hashPassword } from '../src/services/auth.service.js';
import {
  addWorkingDays,
  courierFor,
  estimateForPincode,
  PICKUP_POINTS,
  PICKUP_SLOTS,
} from '../src/services/delivery.service.js';
import { nextOrderNumber } from '../src/services/order.service.js';
import { calculateTotals } from '../src/services/pricing.service.js';
import { refreshProductRating } from '../src/services/review.service.js';
import { slugify } from '../src/utils/http.js';
import { categories, coupons, kits, products } from './data/catalog.js';
import { DEMO_ADMIN, DEMO_STUDENT, OTHER_STUDENTS } from './data/people.js';
import { reviewTextByCategory } from './data/reviewText.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const OTHER_ORDER_COUNT = 72;
const HISTORY_DAYS = 90;
const GATEWAY = ['MOCK_UPI', 'MOCK_CARD'];
const ALL_MODELS = [Review, Payment, WalletTransaction, Order, Cart, Setup, Kit, Coupon, Product, Category, User, Counter];

// Where each step happens, as a share of the time between ordering and the expected date.
const STEP_SHARE = { Confirmed: 0.1, Shipped: 0.4, 'Out for Delivery': 0.85, Delivered: 0.95 };
const FLOW = ['Confirmed', 'Shipped', 'Out for Delivery', 'Delivered'];

const TEST_CARDS = [
  { brand: 'Visa', last4: '1111' },
  { brand: 'Mastercard', last4: '4444' },
  { brand: 'RuPay', last4: '0006' },
];

const RETURN_STORIES = [
  ['Damaged or not working', 'Stopped working after two days.'],
  ['Damaged or not working', 'Arrived with a cracked corner.'],
  ['Wrong item sent', 'I received a different model from the one I ordered.'],
  ['Not as described', 'Much smaller than the photos suggest.'],
  ['No longer needed', 'My project group already had one.'],
];

const FAILED_ATTEMPTS = {
  MOCK_CARD: [
    ['Failed', 'Declined by the bank'],
    ['Failed', 'Not enough balance on the card'],
    ['Failed', 'Wrong OTP entered 3 times'],
    ['Expired', 'The payment screen timed out'],
  ],
  MOCK_UPI: [
    ['Failed', 'Declined in the UPI app'],
    ['Failed', 'Closed before paying'],
    ['Expired', 'The payment screen timed out'],
  ],
};

/** A small seeded random generator, so every reset gives the same demo data. */
function createRandom(seed) {
  let state = seed;
  const next = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    pick: (list) => list[Math.floor(next() * list.length)],
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    hex: (length) => Array.from({ length }, () => Math.floor(next() * 16).toString(16)).join('').toUpperCase(),
  };
}

const daysAgo = (days) => new Date(Date.now() - days * DAY_MS);
const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS);

/** The date an order is expected, using the same rules as a real checkout. */
function expectedDate(createdAt, method, pincode) {
  if (method === 'pickup') return addWorkingDays(createdAt, 1);
  return estimateForPincode(pincode, createdAt)[method].date;
}

/** How far through its journey an order of this age is, where 1 is the expected date. */
function journeyShare(createdAt, expected, now = Date.now()) {
  return (now - createdAt.getTime()) / (expected.getTime() - createdAt.getTime());
}

function statusForShare(share) {
  if (share < STEP_SHARE.Confirmed) return 'Pending';
  if (share < STEP_SHARE.Shipped) return 'Confirmed';
  if (share < STEP_SHARE['Out for Delivery']) return 'Shipped';
  if (share < STEP_SHARE.Delivered) return 'Out for Delivery';
  return 'Delivered';
}

/**
 * Works out when to place a demo order so it is a set share of the way to its expected
 * date. The date itself depends on when the order was placed, so this settles in a few rounds.
 */
function placedAtForShare(share, method, pincode) {
  let createdAt = daysAgo(share * 3);
  for (let round = 0; round < 6; round += 1) {
    const span = expectedDate(createdAt, method, pincode).getTime() - createdAt.getTime();
    createdAt = new Date(Date.now() - share * span);
  }
  return createdAt;
}

function stepNotes(delivery, city) {
  const pickup = delivery.method === 'pickup';
  return {
    Confirmed: 'Confirmed and being packed',
    Shipped: pickup ? `Sent to ${delivery.pickupPoint}` : `Handed to ${delivery.courier}`,
    'Out for Delivery': pickup ? `Ready at ${delivery.pickupPoint}, ${delivery.pickupSlot}` : `Out for delivery in ${city}`,
    Delivered: pickup ? 'Collected. Delivery code checked' : 'Delivered. Delivery code checked',
  };
}

function buildHistory({ status, createdAt, expected, userId, adminId, delivery, city, random }) {
  const history = [{ status: 'Pending', at: createdAt, note: 'Order placed', by: userId }];
  if (status === 'Pending') return history;

  if (status === 'Cancelled') {
    history.push({
      status: 'Cancelled',
      at: new Date(createdAt.getTime() + 4 * HOUR_MS),
      note: random.pick(['Changed my mind', 'Ordered by mistake', 'Found it on campus']),
      by: userId,
    });
    return history;
  }

  const span = expected.getTime() - createdAt.getTime();
  const notes = stepNotes(delivery, city);
  for (const step of FLOW) {
    history.push({ status: step, at: new Date(createdAt.getTime() + STEP_SHARE[step] * span), note: notes[step], by: adminId });
    if (step === status) break;
  }
  return history;
}

/** The card or UPI account an order was paid with, as the gateway would have recorded it. */
function instrumentFor(method, user, random) {
  if (method === 'MOCK_CARD') return { card: random.pick(TEST_CARDS) };
  if (method === 'MOCK_UPI') {
    return random.next() < 0.3
      ? { upiFlow: 'qr', upiId: null }
      : { upiFlow: 'collect', upiId: `${user.email.split('@')[0].split('.')[0]}@okbank` };
  }
  return {};
}

function detailFor(method, instrument, delivered) {
  if (instrument.card) return `${instrument.card.brand} ending ${instrument.card.last4}`;
  if (method === 'MOCK_UPI') return instrument.upiFlow === 'qr' ? 'UPI QR code' : instrument.upiId;
  if (method === 'WALLET') return 'CampusCart wallet';
  if (method === 'COD' && delivered) return 'Cash collected on delivery';
  return '';
}

function paymentFor({ method, status, instrument, random }) {
  const delivered = ['Delivered', 'Returned'].includes(status);
  const prefix = { MOCK_CARD: 'MOCK', MOCK_UPI: 'MOCK', WALLET: 'WAL', COD: 'COD' }[method];
  const paid = method !== 'COD' || delivered;
  const payment = {
    method,
    status: paid ? 'Paid' : 'Pending',
    transactionRef: paid ? `${prefix}-${random.hex(12)}` : null,
    detail: detailFor(method, instrument, delivered),
    record: paid ? new mongoose.Types.ObjectId() : null,
    refundedTo: null,
  };
  if (status === 'Cancelled') {
    payment.status = paid ? 'Refunded' : 'Cancelled';
    payment.refundedTo = paid ? (GATEWAY.includes(method) ? 'source' : 'wallet') : null;
  }
  return payment;
}

function deliveryFor(method, random) {
  const delivery = { method, courier: null, trackingNumber: null, code: null, pickupPoint: null, pickupSlot: null };
  if (method === 'pickup') {
    delivery.pickupPoint = random.pick(PICKUP_POINTS).name;
    delivery.pickupSlot = random.pick(PICKUP_SLOTS).label;
  }
  return delivery;
}

function buildOrder({ user, status, createdAt, lines, coupon = null, method, deliveryMethod, adminId, random, trackingNumbers }) {
  const items = lines.map(({ product, qty }) => ({
    product: product._id,
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    image: product.images[0],
    price: product.price,
    mrp: product.mrp,
    qty,
    lineTotal: product.price * qty,
  }));
  const address = user.addresses[0].toObject();
  const totals = calculateTotals(items, coupon, deliveryMethod);
  const expected = expectedDate(createdAt, deliveryMethod, address.pincode);
  const delivery = deliveryFor(deliveryMethod, random);

  const shipped = ['Shipped', 'Out for Delivery', 'Delivered'].includes(status);
  if (shipped) {
    delivery.courier = courierFor(deliveryMethod);
    let number;
    do number = `CCT${random.int(1e9, 1e10 - 1)}`;
    while (trackingNumbers.has(number));
    trackingNumbers.add(number);
    delivery.trackingNumber = number;
  }
  if (status === 'Out for Delivery') delivery.code = String(random.int(1000, 9999));

  const history = buildHistory({
    status,
    createdAt,
    expected,
    userId: user._id,
    adminId,
    delivery,
    city: address.city,
    random,
  });
  const instrument = instrumentFor(method, user, random);

  return {
    user: user._id,
    items,
    delivery,
    shippingAddress: deliveryMethod === 'pickup' ? null : address,
    payment: paymentFor({ method, status, instrument, random }),
    subtotal: totals.subtotal,
    discount: totals.discount,
    couponCode: coupon?.code ?? null,
    shippingFee: totals.shippingFee,
    total: totals.total,
    status,
    statusHistory: history,
    cancelReason: status === 'Cancelled' ? history.at(-1).note : null,
    estimatedDelivery: expected,
    returnRequest: null,
    createdAt,
    updatedAt: history.at(-1).at,
    // Kept only while seeding, to write the matching payment record.
    seedInstrument: instrument,
  };
}

const deliveredAtOf = (draft) => draft.statusHistory.find((event) => event.status === 'Delivered').at;

/** Turns a delivered order into one the store took back and refunded. */
function approveReturn(draft, { requestedAfter, resolvedAfter, adminId, random }) {
  const deliveredAt = deliveredAtOf(draft);
  const [reason, comment] = random.pick(RETURN_STORIES);
  const resolvedAt = new Date(deliveredAt.getTime() + resolvedAfter * DAY_MS);
  draft.status = 'Returned';
  draft.returnRequest = {
    status: 'Approved',
    reason,
    comment,
    requestedAt: new Date(deliveredAt.getTime() + requestedAfter * DAY_MS),
    resolvedAt,
    resolvedBy: adminId,
    resolutionNote: '',
    refundAmount: draft.total,
  };
  draft.statusHistory.push({ status: 'Returned', at: resolvedAt, note: 'Return approved and refund issued', by: adminId });
  draft.payment.status = 'Refunded';
  draft.payment.refundedTo = GATEWAY.includes(draft.payment.method) ? 'source' : 'wallet';
  draft.updatedAt = resolvedAt;
}

/** Some delivered orders from other students are returned, refused or waiting for a decision. */
function addReturns(drafts, { adminId, random }) {
  const now = Date.now();
  const delivered = drafts.filter((draft) => draft.status === 'Delivered');
  const age = (draft) => (now - deliveredAtOf(draft).getTime()) / DAY_MS;

  // Waiting for the admin: delivered recently enough that the return window is still open.
  const waiting = delivered.filter((draft) => age(draft) > 0.5 && age(draft) < 5).slice(0, 2);
  for (const draft of waiting) {
    const [reason, comment] = random.pick(RETURN_STORIES);
    draft.returnRequest = {
      status: 'Requested',
      reason,
      comment,
      requestedAt: new Date(deliveredAtOf(draft).getTime() + 0.4 * DAY_MS),
    };
  }

  const older = delivered.filter((draft) => age(draft) > 12 && !waiting.includes(draft));
  for (const draft of older.slice(0, 4)) {
    approveReturn(draft, { requestedAfter: 1, resolvedAfter: 2.5, adminId, random });
  }
  const refused = older[4];
  if (refused) {
    const deliveredAt = deliveredAtOf(refused);
    refused.returnRequest = {
      status: 'Rejected',
      reason: 'No longer needed',
      comment: 'Bought a different one.',
      requestedAt: new Date(deliveredAt.getTime() + 6 * DAY_MS),
      resolvedAt: new Date(deliveredAt.getTime() + 6.5 * DAY_MS),
      resolvedBy: adminId,
      resolutionNote: 'The box was opened and parts were missing, so this one cannot be taken back.',
    };
  }
}

async function seedCatalog() {
  const categoryDocs = await Category.insertMany(
    categories.map(({ key, ...fields }, index) => ({ ...fields, slug: key, sortOrder: index })),
  );
  const categoryByKey = new Map(categoryDocs.map((doc) => [doc.slug, doc]));

  const productDocs = await Product.insertMany(
    products.map((product, index) => {
      const slug = slugify(product.name);
      return {
        name: product.name,
        slug,
        sku: `CC-${String(index + 1).padStart(4, '0')}`,
        brand: product.brand,
        description: product.description,
        highlights: product.highlights,
        category: categoryByKey.get(product.category)._id,
        tags: product.tags ?? [],
        price: product.price,
        mrp: product.mrp,
        stock: product.stock,
        lowStockThreshold: product.threshold ?? 5,
        images: [`/img/products/${slug}.svg`],
        specs: product.specs.map(([group, key, value]) => ({ group, key, value })),
        setupSlot: product.slot ?? null,
        semesters: product.semesters ?? [],
        isFeatured: Boolean(product.featured),
      };
    }),
  );
  return { categoryDocs, productDocs };
}

async function seedUsers() {
  const [adminHash, studentHash] = await Promise.all([
    hashPassword(DEMO_ADMIN.password),
    hashPassword(DEMO_STUDENT.password),
  ]);
  const strip = ({ password, ...fields }) => fields;
  const admin = await User.create({ ...strip(DEMO_ADMIN), role: 'admin', passwordHash: adminHash });
  const student = await User.create({ ...strip(DEMO_STUDENT), passwordHash: studentHash });
  const others = await User.create(OTHER_STUDENTS.map((fields) => ({ ...fields, passwordHash: studentHash })));
  return { admin, student, others };
}

async function seedCoupons() {
  return Coupon.insertMany(
    coupons.map(({ expired, ...fields }) => ({
      ...fields,
      ...(expired && { startsAt: daysAgo(60), expiresAt: daysAgo(30) }),
    })),
  );
}

async function seedKits(productByName) {
  await Kit.insertMany(
    kits.map(({ art, featured, items, ...fields }) => {
      const slug = slugify(fields.name);
      return {
        ...fields,
        slug,
        image: `/img/kits/${slug}.svg`,
        isFeatured: featured,
        items: items.map(([name, qty]) => ({ product: productByName(name)._id, qty })),
      };
    }),
  );
}

async function seedSetups(student, productByName) {
  const entry = (slot, name) => ({ slot, product: productByName(name)._id });
  await Setup.create([
    {
      user: student._id,
      name: 'Hostel desk upgrade',
      budget: 25000,
      slots: [
        entry('keyboard', 'TVS Gold Bharat Mechanical Keyboard'),
        entry('mouse', 'Logitech M331 Silent Mouse'),
        entry('monitor', 'LG 24 Inch IPS Monitor'),
        entry('headset', 'boAt Rockerz 450 Headphones'),
      ],
    },
    {
      user: student._id,
      name: 'Dream setup',
      budget: 100000,
      slots: [
        entry('laptop', 'MacBook Air 13 (M3)'),
        entry('keyboard', 'Keychron K2 Mechanical Keyboard'),
        entry('mouse', 'Logitech MX Master 3S'),
        entry('monitor', 'Dell S2722QC 27 Inch 4K Monitor'),
      ],
    },
  ]);
}

/**
 * The demo student has an order in every status, including one returned and one
 * delivered recently enough to return, so every screen has something to show.
 */
function demoStudentOrders({ student, admin, productByName, random, trackingNumbers }) {
  const pincode = student.addresses[0].pincode;
  const make = ({ status, placedAt, method, deliveryMethod = 'standard', names }) =>
    buildOrder({
      user: student,
      status,
      createdAt: placedAt,
      lines: names.map((name) => ({ product: productByName(name), qty: 1 })),
      method,
      deliveryMethod,
      adminId: admin._id,
      random,
      trackingNumbers,
    });
  // In-progress orders are placed a set share of the way to their expected date.
  const inProgress = (share, deliveryMethod = 'standard') => placedAtForShare(share, deliveryMethod, pincode);

  const returned = make({ status: 'Delivered', placedAt: daysAgo(25), method: 'MOCK_UPI', names: ['boAt Rockerz 450 Headphones'] });
  approveReturn(returned, { requestedAfter: 1, resolvedAfter: 2, adminId: admin._id, random });

  return [
    make({ status: 'Delivered', placedAt: daysAgo(38), method: 'MOCK_UPI', names: ['Clean Code', 'Logitech M331 Silent Mouse'] }),
    returned,
    make({ status: 'Delivered', placedAt: daysAgo(12), method: 'COD', names: ['Arduino Uno R3', 'Breadboard & Jumper Wire Set'] }),
    make({ status: 'Cancelled', placedAt: daysAgo(9), method: 'MOCK_CARD', names: ['HDMI 2.0 Cable (1.5 m)'] }),
    make({ status: 'Delivered', placedAt: daysAgo(4.5), method: 'WALLET', deliveryMethod: 'express', names: ['Logitech K380 Wireless Keyboard'] }),
    make({ status: 'Out for Delivery', placedAt: inProgress(0.9), method: 'COD', names: ['7-in-1 USB-C Hub'] }),
    make({ status: 'Shipped', placedAt: inProgress(0.6), method: 'MOCK_CARD', names: ['Aluminium Laptop Stand'] }),
    make({ status: 'Confirmed', placedAt: inProgress(0.25, 'pickup'), method: 'COD', deliveryMethod: 'pickup', names: ['Operating System Concepts (Galvin)'] }),
    make({ status: 'Pending', placedAt: inProgress(0.05), method: 'MOCK_UPI', names: ['Null Pointer Coffee Mug', 'Developer Laptop Sticker Pack (50)'] }),
  ];
}

function pickPaymentMethod(random) {
  const roll = random.next();
  if (roll < 0.32) return 'COD';
  if (roll < 0.64) return 'MOCK_UPI';
  if (roll < 0.88) return 'MOCK_CARD';
  return 'WALLET';
}

function pickDeliveryMethod(random) {
  const roll = random.next();
  if (roll < 0.7) return 'standard';
  if (roll < 0.85) return 'express';
  return 'pickup';
}

function otherStudentOrders({ others, admin, productDocs, couponDocs, random, trackingNumbers }) {
  // Laptops and big-ticket items are bought rarely, which keeps the revenue chart believable.
  const everyday = productDocs.filter((product) => product.price < 15000);
  const expensive = productDocs.filter((product) => product.price >= 15000);
  const usableCoupons = couponDocs.filter((coupon) => coupon.code === 'STUDENT10');
  const orders = [];

  for (let i = 0; i < OTHER_ORDER_COUNT; i += 1) {
    // Raising the random value to a power places more orders in recent weeks, so sales trend upward.
    const createdAt = daysAgo(random.next() ** 1.6 * (HISTORY_DAYS - 1));
    const user = random.pick(others);
    const chosen = new Map();
    for (let n = random.int(1, 3); n > 0; n -= 1) {
      const pool = random.next() < 0.05 ? expensive : everyday;
      const product = random.pick(pool);
      chosen.set(product.slug, { product, qty: product.price < 800 && random.next() < 0.3 ? 2 : 1 });
    }
    const lines = [...chosen.values()];
    const deliveryMethod = pickDeliveryMethod(random);
    let method = pickPaymentMethod(random);
    // Wallets are topped up ₹10,000 at a time at most, so large orders use UPI instead.
    if (method === 'WALLET' && lines.reduce((sum, { product, qty }) => sum + product.price * qty, 0) > 9000) method = 'MOCK_UPI';

    const expected = expectedDate(createdAt, deliveryMethod, user.addresses[0].pincode);
    const status = random.next() < 0.08 ? 'Cancelled' : statusForShare(journeyShare(createdAt, expected));
    orders.push(
      buildOrder({
        user,
        status,
        createdAt,
        lines,
        coupon: random.next() < 0.15 ? usableCoupons[0] : null,
        method,
        deliveryMethod,
        adminId: admin._id,
        random,
        trackingNumbers,
      }),
    );
  }
  addReturns(orders, { adminId: admin._id, random });
  return orders;
}

/** Saves orders oldest first, so order numbers run in date order. */
async function saveOrders(drafts) {
  const sorted = [...drafts].sort((a, b) => a.createdAt - b.createdAt);
  for (const draft of sorted) draft.orderNumber = await nextOrderNumber(draft.createdAt);
  const instruments = sorted.map(({ seedInstrument }) => seedInstrument);
  const orderDocs = await Order.insertMany(
    sorted.map(({ seedInstrument, ...order }) => order),
    { timestamps: false },
  );
  return orderDocs.map((order, index) => ({ order, instrument: instruments[index] }));
}

function refundTime(order) {
  if (order.status === 'Cancelled') return order.statusHistory.at(-1).at;
  return order.returnRequest?.resolvedAt ?? null;
}

/**
 * Writes the payment record behind every paid order, a few failed attempts, and wallet
 * statements whose balances add up: each wallet is topped up before it is spent.
 */
async function seedPaymentsAndWallets(saved, random) {
  const payments = [];
  const walletEvents = [];

  for (const { order, instrument } of saved) {
    const { payment } = order;
    const isGateway = GATEWAY.includes(payment.method);

    if (isGateway && random.next() < 0.18) {
      const [status, failureReason] = random.pick(FAILED_ATTEMPTS[payment.method]);
      const at = new Date(order.createdAt.getTime() - random.int(3, 20) * 60 * 1000);
      payments.push({
        reference: `MOCK-${random.hex(12)}`,
        user: order.user,
        purpose: 'order',
        method: payment.method,
        amount: order.total,
        status,
        deliveryMethod: order.delivery.method,
        ...instrument,
        failureReason,
        expiresAt: new Date(at.getTime() + 10 * 60 * 1000),
        completedAt: at,
        createdAt: at,
        updatedAt: at,
      });
    }

    if (!payment.record) continue;
    const isCash = payment.method === 'COD';
    const paidAt = isCash ? order.statusHistory.find((event) => event.status === 'Delivered').at : order.createdAt;
    const refundedAt = payment.status === 'Refunded' ? refundTime(order) : null;
    payments.push({
      _id: payment.record,
      reference: payment.transactionRef,
      user: order.user,
      purpose: 'order',
      method: payment.method,
      amount: order.total,
      status: refundedAt ? 'Refunded' : 'Succeeded',
      deliveryMethod: order.delivery.method,
      ...instrument,
      order: order._id,
      orderNumber: order.orderNumber,
      expiresAt: paidAt,
      completedAt: paidAt,
      refund: refundedAt
        ? {
            amount: order.total,
            at: refundedAt,
            reason: order.status === 'Cancelled' ? `Order cancelled: ${order.cancelReason}` : `Returned: ${order.returnRequest.reason}`,
            to: payment.refundedTo,
          }
        : null,
      createdAt: paidAt,
      updatedAt: refundedAt ?? paidAt,
    });

    if (payment.method === 'WALLET') {
      walletEvents.push({ user: order.user, at: order.createdAt, kind: 'payment', amount: order.total, order });
    }
    if (refundedAt && payment.refundedTo === 'wallet') {
      walletEvents.push({ user: order.user, at: refundedAt, kind: 'refund', amount: order.total, order });
    }
  }

  // Replays each wallet in time order, topping it up whenever a payment needs more.
  walletEvents.sort((a, b) => a.at - b.at);
  const balances = new Map();
  const lines = [];
  for (const event of walletEvents) {
    const key = event.user.toString();
    let balance = balances.get(key) ?? 0;
    if (event.kind === 'payment') {
      let topupAt = new Date(event.at.getTime() - 3 * HOUR_MS);
      while (balance < event.amount) {
        const amount = Math.min(10000, Math.max(2000, Math.ceil((event.amount - balance) / 500) * 500));
        const method = random.next() < 0.6 ? 'MOCK_UPI' : 'MOCK_CARD';
        const _id = new mongoose.Types.ObjectId();
        payments.push({
          _id,
          reference: `MOCK-${random.hex(12)}`,
          user: event.user,
          purpose: 'wallet_topup',
          method,
          amount,
          status: 'Succeeded',
          ...(method === 'MOCK_CARD' ? { card: random.pick(TEST_CARDS) } : { upiFlow: 'qr' }),
          expiresAt: topupAt,
          completedAt: topupAt,
          createdAt: topupAt,
          updatedAt: topupAt,
        });
        balance += amount;
        lines.push({
          user: event.user,
          type: 'credit',
          kind: 'topup',
          amount,
          balanceAfter: balance,
          description: `Added money by ${method === 'MOCK_UPI' ? 'UPI' : 'card'}`,
          payment: _id,
          createdAt: topupAt,
          updatedAt: topupAt,
        });
        topupAt = new Date(topupAt.getTime() + 60 * 1000);
      }
      balance -= event.amount;
      lines.push({
        user: event.user,
        type: 'debit',
        kind: 'payment',
        amount: event.amount,
        balanceAfter: balance,
        description: `Paid for order ${event.order.orderNumber}`,
        order: event.order._id,
        orderNumber: event.order.orderNumber,
        payment: event.order.payment.record,
        createdAt: event.at,
        updatedAt: event.at,
      });
    } else {
      balance += event.amount;
      lines.push({
        user: event.user,
        type: 'credit',
        kind: 'refund',
        amount: event.amount,
        balanceAfter: balance,
        description: `Refund for order ${event.order.orderNumber}`,
        order: event.order._id,
        orderNumber: event.order.orderNumber,
        createdAt: event.at,
        updatedAt: event.at,
      });
    }
    balances.set(key, balance);
  }

  await Payment.insertMany(payments, { timestamps: false });
  await WalletTransaction.insertMany(lines, { timestamps: false });
  if (balances.size > 0) {
    await User.bulkWrite(
      [...balances].map(([id, walletBalance]) => ({ updateOne: { filter: { _id: id }, update: { $set: { walletBalance } } } })),
    );
  }
}

const RATINGS = [5, 5, 5, 5, 4, 4, 4, 4, 4, 3, 3, 2];

async function seedReviews({ orderDocs, student, productDocs, categoryDocs, random }) {
  const categorySlug = new Map(categoryDocs.map((doc) => [doc._id.toString(), doc.slug]));
  const productById = new Map(productDocs.map((doc) => [doc._id.toString(), doc]));
  const seen = new Set();
  const reviewTurns = new Map();
  const reviews = [];

  for (const order of orderDocs) {
    if (order.status !== 'Delivered') continue;
    const isDemoStudent = order.user.equals(student._id);

    for (const item of order.items) {
      const key = `${order.user}-${item.product}`;
      if (seen.has(key)) continue;
      seen.add(key);
      // Leaves one delivered item unreviewed, so the demo can show writing a review.
      if (isDemoStudent && item.name === 'Arduino Uno R3') continue;
      if (!isDemoStudent && random.next() > 0.9) continue;

      const product = productById.get(item.product.toString());
      // Walks through the category's text in turn, so one product doesn't repeat a review.
      const pool = reviewTextByCategory[categorySlug.get(product.category.toString())];
      const productKey = item.product.toString();
      const turn = reviewTurns.get(productKey) ?? random.int(0, pool.length - 1);
      reviewTurns.set(productKey, turn + 1);
      const [title, body] = pool[turn % pool.length];
      const at = addDays(order.statusHistory.at(-1).at, random.next() * 3);
      const createdAt = at > new Date() ? new Date() : at;
      reviews.push({
        user: order.user,
        product: item.product,
        order: order._id,
        rating: random.pick(RATINGS),
        title,
        body,
        createdAt,
        updatedAt: createdAt,
      });
    }
  }

  await Review.insertMany(reviews, { timestamps: false });
  const reviewedProducts = [...new Set(reviews.map((review) => review.product.toString()))];
  await Promise.all(reviewedProducts.map(refreshProductRating));
}

async function setSoldCounts(orderDocs) {
  const units = new Map();
  for (const order of orderDocs) {
    // Cancelled and returned items went back into stock.
    if (['Cancelled', 'Returned'].includes(order.status)) continue;
    for (const item of order.items) {
      const key = item.product.toString();
      units.set(key, (units.get(key) ?? 0) + item.qty);
    }
  }
  await Product.bulkWrite(
    [...units].map(([id, soldCount]) => ({
      updateOne: { filter: { _id: id }, update: { $set: { soldCount } } },
    })),
  );
}

async function setCouponUsage(orderDocs) {
  const used = new Map();
  for (const order of orderDocs) {
    if (order.couponCode && order.status !== 'Cancelled') {
      used.set(order.couponCode, (used.get(order.couponCode) ?? 0) + 1);
    }
  }
  await Promise.all(
    [...used].map(([code, usedCount]) => Coupon.updateOne({ code }, { usedCount })),
  );
}

/** Replaces everything in the database with fresh demo data. */
export async function seedDatabase() {
  await Promise.all(ALL_MODELS.map((model) => model.deleteMany({})));

  const random = createRandom(2026);
  const { categoryDocs, productDocs } = await seedCatalog();
  const { admin, student, others } = await seedUsers();
  const couponDocs = await seedCoupons();

  const byName = new Map(productDocs.map((doc) => [doc.name, doc]));
  const productByName = (name) => {
    const product = byName.get(name);
    if (!product) throw new Error(`Seed data refers to an unknown product: ${name}`);
    return product;
  };

  await seedKits(productByName);
  await seedSetups(student, productByName);

  const trackingNumbers = new Set();
  const saved = await saveOrders([
    ...demoStudentOrders({ student, admin, productByName, random, trackingNumbers }),
    ...otherStudentOrders({ others, admin, productDocs, couponDocs, random, trackingNumbers }),
  ]);
  const orderDocs = saved.map(({ order }) => order);

  await seedPaymentsAndWallets(saved, random);
  await seedReviews({ orderDocs, student, productDocs, categoryDocs, random });
  await setSoldCounts(orderDocs);
  await setCouponUsage(orderDocs);
}

/** Seeds only when the database is empty. Returns true if it seeded. */
export async function ensureSeeded() {
  if ((await User.countDocuments()) > 0) return false;
  await seedDatabase();
  return true;
}
