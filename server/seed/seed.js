import {
  Cart,
  Category,
  Counter,
  Coupon,
  Kit,
  Order,
  Product,
  Review,
  Setup,
  User,
} from '../src/models/index.js';
import { hashPassword } from '../src/services/auth.service.js';
import { nextOrderNumber } from '../src/services/order.service.js';
import { calculateTotals } from '../src/services/pricing.service.js';
import { refreshProductRating } from '../src/services/review.service.js';
import { slugify } from '../src/utils/http.js';
import { categories, coupons, kits, products } from './data/catalog.js';
import { DEMO_ADMIN, DEMO_STUDENT, OTHER_STUDENTS } from './data/people.js';
import { reviewTextByCategory } from './data/reviewText.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const OTHER_ORDER_COUNT = 72;
const HISTORY_DAYS = 90;
const PAYMENT_METHODS = ['COD', 'MOCK_UPI', 'MOCK_CARD'];
const ALL_MODELS = [Review, Order, Cart, Setup, Kit, Coupon, Product, Category, User, Counter];

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
  };
}

const daysAgo = (days) => new Date(Date.now() - days * DAY_MS);
const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS);

function buildHistory(status, createdAt, userId, adminId, random) {
  const history = [{ status: 'Pending', at: createdAt, note: 'Order placed', by: userId }];
  if (status === 'Pending') return history;

  if (status === 'Cancelled') {
    history.push({
      status: 'Cancelled',
      at: addDays(createdAt, 0.2),
      note: random.pick(['Changed my mind', 'Ordered by mistake', 'Found it on campus']),
      by: userId,
    });
    return history;
  }

  const steps = [
    ['Confirmed', 0.3, 'Payment and stock checked'],
    ['Shipped', 1.5, 'Handed to the courier'],
    ['Delivered', 3.5, 'Delivered to the address'],
  ];
  for (const [step, offset, note] of steps) {
    history.push({ status: step, at: addDays(createdAt, offset), note, by: adminId });
    if (step === status) break;
  }
  return history;
}

function paymentFor(method, status, random) {
  const reference =
    method === 'COD' ? null : `MOCK-${Math.floor(random.next() * 0xffffffffff).toString(16).toUpperCase()}`;
  if (status === 'Cancelled') {
    return { method, status: method === 'COD' ? 'Cancelled' : 'Refunded', transactionRef: reference };
  }
  if (method === 'COD') {
    return { method, status: status === 'Delivered' ? 'Paid' : 'Pending', transactionRef: null };
  }
  return { method, status: 'Paid', transactionRef: reference };
}

function buildOrder({ user, status, createdAt, lines, coupon = null, method, adminId, random }) {
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
  const totals = calculateTotals(items, coupon);
  const history = buildHistory(status, createdAt, user._id, adminId, random);

  return {
    user: user._id,
    items,
    shippingAddress: user.addresses[0].toObject(),
    payment: paymentFor(method, status, random),
    subtotal: totals.subtotal,
    discount: totals.discount,
    couponCode: coupon?.code ?? null,
    shippingFee: totals.shippingFee,
    total: totals.total,
    status,
    statusHistory: history,
    cancelReason: status === 'Cancelled' ? history.at(-1).note : null,
    estimatedDelivery: addDays(createdAt, 5),
    createdAt,
    updatedAt: history.at(-1).at,
  };
}

/** Recent orders are still moving through the flow. Older ones are mostly delivered. */
function statusForAge(ageDays, random) {
  if (random.next() < 0.08) return 'Cancelled';
  if (ageDays < 1) return 'Pending';
  if (ageDays < 2) return 'Confirmed';
  if (ageDays < 4) return 'Shipped';
  return 'Delivered';
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

/** The demo student has one order in each status, so every screen has something to show. */
function demoStudentOrders({ student, admin, productByName, random }) {
  const lines = (...names) => names.map((name) => ({ product: productByName(name), qty: 1 }));
  const make = (status, ageDays, method, names) =>
    buildOrder({
      user: student,
      status,
      createdAt: daysAgo(ageDays),
      lines: lines(...names),
      method,
      adminId: admin._id,
      random,
    });
  return [
    make('Delivered', 38, 'MOCK_UPI', ['Clean Code', 'Logitech M331 Silent Mouse']),
    make('Delivered', 12, 'COD', ['Arduino Uno R3', 'Breadboard & Jumper Wire Set']),
    make('Cancelled', 9, 'MOCK_CARD', ['HDMI 2.0 Cable (1.5 m)']),
    make('Shipped', 2.5, 'MOCK_UPI', ['7-in-1 USB-C Hub']),
    make('Confirmed', 1.5, 'COD', ['Operating System Concepts (Galvin)']),
    make('Pending', 0.1, 'MOCK_UPI', ['Null Pointer Coffee Mug', 'Developer Laptop Sticker Pack (50)']),
  ];
}

function otherStudentOrders({ others, admin, productDocs, couponDocs, random }) {
  // Laptops and big-ticket items are bought rarely, which keeps the revenue chart believable.
  const everyday = productDocs.filter((product) => product.price < 15000);
  const expensive = productDocs.filter((product) => product.price >= 15000);
  const usableCoupons = couponDocs.filter((coupon) => coupon.code === 'STUDENT10');
  const orders = [];

  for (let i = 0; i < OTHER_ORDER_COUNT; i += 1) {
    // Squaring the random value places more orders in recent weeks, so sales trend upward.
    const ageDays = random.next() ** 1.6 * (HISTORY_DAYS - 1);
    const user = random.pick(others);
    const chosen = new Map();
    for (let n = random.int(1, 3); n > 0; n -= 1) {
      const pool = random.next() < 0.05 ? expensive : everyday;
      const product = random.pick(pool);
      chosen.set(product.slug, { product, qty: product.price < 800 && random.next() < 0.3 ? 2 : 1 });
    }
    orders.push(
      buildOrder({
        user,
        status: statusForAge(ageDays, random),
        createdAt: daysAgo(ageDays),
        lines: [...chosen.values()],
        coupon: random.next() < 0.15 ? usableCoupons[0] : null,
        method: random.pick(PAYMENT_METHODS),
        adminId: admin._id,
        random,
      }),
    );
  }
  return orders;
}

/** Saves orders oldest first, so order numbers run in date order. */
async function saveOrders(drafts) {
  const sorted = [...drafts].sort((a, b) => a.createdAt - b.createdAt);
  for (const draft of sorted) draft.orderNumber = await nextOrderNumber(draft.createdAt);
  return Order.insertMany(sorted, { timestamps: false });
}

const RATINGS = [5, 5, 5, 5, 4, 4, 4, 4, 4, 3, 3, 2];

async function seedReviews({ orderDocs, student, productDocs, categoryDocs, random }) {
  const categorySlug = new Map(categoryDocs.map((doc) => [doc._id.toString(), doc.slug]));
  const productById = new Map(productDocs.map((doc) => [doc._id.toString(), doc]));
  const seen = new Set();
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
      const [title, body] = random.pick(reviewTextByCategory[categorySlug.get(product.category.toString())]);
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
    if (order.status === 'Cancelled') continue;
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

  const orderDocs = await saveOrders([
    ...demoStudentOrders({ student, admin, productByName, random }),
    ...otherStudentOrders({ others, admin, productDocs, couponDocs, random }),
  ]);

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
