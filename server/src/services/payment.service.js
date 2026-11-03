import { randomBytes, timingSafeEqual } from 'node:crypto';
import { PENDING_PAYMENT_STATUSES, Payment, User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { DEMO_CARD_OTP, cardBrand, findTestCard } from '../utils/cards.js';
import { escapeRegex, paginate } from '../utils/http.js';
import { buildCartView, getOrCreateCart } from './cart.service.js';
import { creditWallet, requireAllowedTopup } from './wallet.service.js';

/**
 * The demo payment gateway. It behaves like a real one (card details, a bank OTP, UPI
 * requests and QR codes, failures and timeouts) but no money ever moves.
 */

const SESSION_MS = 10 * 60 * 1000;
export const UPI_APPROVAL_DELAY_MS = 4000;
export const MAX_OTP_ATTEMPTS = 3;
const SETTLED = ['Succeeded', 'Refunded'];

const CARD_FAILURES = {
  declined: 'Declined by the bank',
  insufficient_funds: 'Not enough balance on the card',
};

const METHOD_NAMES = { MOCK_CARD: 'card', MOCK_UPI: 'UPI', WALLET: 'wallet', COD: 'cash' };

export const newReference = (prefix = 'MOCK') => `${prefix}-${randomBytes(6).toString('hex').toUpperCase()}`;

/** A short line describing what paid, shown on the order. Never a full card number. */
export function describePayment(payment) {
  if (payment.card) return `${payment.card.brand} ending ${payment.card.last4}`;
  if (payment.upiFlow === 'qr') return 'UPI QR code';
  if (payment.upiId) return payment.upiId;
  return '';
}

export function paymentView(payment) {
  const json = payment.toJSON();
  delete json.approvalToken;
  delete json.__v;
  return json;
}

function stoppedMessage(payment) {
  if (SETTLED.includes(payment.status)) return 'This payment has already gone through.';
  if (payment.status === 'Expired') return 'This payment timed out. Start a new one.';
  if (payment.status === 'Failed') return 'This payment did not go through. Start a new one.';
  return 'This payment is already being processed.';
}

/**
 * Moves a payment from one status to the next. The current status is part of the match,
 * so when two requests race, exactly one wins. A top-up credits the wallet only for
 * the request that won.
 */
async function transition(payment, from, set) {
  const updated = await Payment.findOneAndUpdate(
    { _id: payment._id, status: from },
    { $set: set },
    { returnDocument: 'after' },
  );
  if (!updated) return Payment.findById(payment._id);
  if (set.status === 'Succeeded' && updated.purpose === 'wallet_topup') {
    await creditWallet(updated.user, updated.amount, {
      kind: 'topup',
      description: `Added money by ${METHOD_NAMES[updated.method]}`,
      payment: updated._id,
    });
  }
  return updated;
}

const succeed = (payment, from, extra = {}) =>
  transition(payment, from, { status: 'Succeeded', completedAt: new Date(), ...extra });

const fail = (payment, from, reason, extra = {}) =>
  transition(payment, from, { status: 'Failed', failureReason: reason, completedAt: new Date(), ...extra });

/** Applies anything that should have happened by now: a timeout, or a UPI app's answer. */
async function bringUpToDate(payment) {
  if (PENDING_PAYMENT_STATUSES.includes(payment.status) && payment.expiresAt <= new Date()) {
    return transition(payment, payment.status, {
      status: 'Expired',
      failureReason: 'The payment screen timed out',
      completedAt: new Date(),
    });
  }
  const answered =
    payment.status === 'Awaiting approval' &&
    payment.upiFlow === 'collect' &&
    payment.requestedAt.getTime() + UPI_APPROVAL_DELAY_MS <= Date.now();
  if (answered) {
    // A UPI ID starting with "failure@" is declined, so the demo can show a failed payment.
    const declined = payment.upiId.split('@')[0] === 'failure';
    return declined
      ? fail(payment, 'Awaiting approval', 'Declined in the UPI app')
      : succeed(payment, 'Awaiting approval');
  }
  return payment;
}

async function findOwnPayment(userId, id, method) {
  const payment = await Payment.findOne({ _id: id, user: userId });
  if (!payment) throw ApiError.notFound('That payment was not found.');
  if (method && payment.method !== method) throw ApiError.badRequest('This payment uses a different method.');
  return bringUpToDate(payment);
}

/** Opens the payment screen for the current cart, or for a wallet top-up. */
export async function createPayment(userId, { purpose, method, deliveryMethod, amount }) {
  let total = amount;
  if (purpose === 'order') {
    const view = await buildCartView(await getOrCreateCart(userId), userId, deliveryMethod);
    if (!view.canCheckout) {
      throw ApiError.badRequest('Your cart needs attention before you can pay. Go back to the cart to check it.');
    }
    total = view.pricing.total;
    if (total === 0) throw ApiError.badRequest('Nothing to pay on this order. Choose Cash on Delivery to place it.');
  } else {
    await requireAllowedTopup(userId, amount);
  }

  const approvalToken = method === 'MOCK_UPI' ? randomBytes(16).toString('hex') : null;
  const payment = await Payment.create({
    reference: newReference(),
    user: userId,
    purpose,
    method,
    amount: total,
    deliveryMethod: purpose === 'order' ? deliveryMethod : null,
    approvalToken,
    expiresAt: new Date(Date.now() + SESSION_MS),
  });
  // The token goes only to the person paying, who shows it inside the QR code.
  return { ...paymentView(payment), approvalToken };
}

export async function getPayment(userId, id) {
  return paymentView(await findOwnPayment(userId, id));
}

/** Card step 1: the card details. A failing test card fails here, before any OTP. */
export async function submitCard(userId, id, { number }) {
  const payment = await findOwnPayment(userId, id, 'MOCK_CARD');
  if (payment.status !== 'Created') throw ApiError.badRequest(stoppedMessage(payment));

  const testCard = findTestCard(number);
  if (!testCard) {
    throw ApiError.badRequest('This demo accepts only the test cards listed on the payment screen. Never enter a real card here.');
  }
  // Only the brand and last four digits are kept. The expiry and CVV are checked, then dropped.
  const card = { brand: cardBrand(number), last4: number.slice(-4) };
  const updated =
    testCard.outcome === 'success'
      ? await transition(payment, 'Created', { status: 'Awaiting OTP', card })
      : await fail(payment, 'Created', CARD_FAILURES[testCard.outcome], { card });
  return paymentView(updated);
}

/** Card step 2: the one-time password the bank sends. */
export async function verifyCardOtp(userId, id, otp) {
  const payment = await findOwnPayment(userId, id, 'MOCK_CARD');
  if (payment.status !== 'Awaiting OTP') throw ApiError.badRequest(stoppedMessage(payment));

  if (otp === DEMO_CARD_OTP) return paymentView(await succeed(payment, 'Awaiting OTP'));

  const attempts = payment.otpAttempts + 1;
  if (attempts >= MAX_OTP_ATTEMPTS) {
    return paymentView(await fail(payment, 'Awaiting OTP', 'Wrong OTP entered 3 times', { otpAttempts: attempts }));
  }
  await Payment.updateOne({ _id: payment._id, status: 'Awaiting OTP' }, { $set: { otpAttempts: attempts } });
  const left = MAX_OTP_ATTEMPTS - attempts;
  throw ApiError.badRequest(`That OTP is wrong. ${left} ${left === 1 ? 'try' : 'tries'} left.`);
}

/** UPI by ID: sends a collect request that the (simulated) UPI app answers a few seconds later. */
export async function requestUpiCollect(userId, id, upiId) {
  const payment = await findOwnPayment(userId, id, 'MOCK_UPI');
  if (payment.status !== 'Created') throw ApiError.badRequest(stoppedMessage(payment));
  const updated = await transition(payment, 'Created', {
    status: 'Awaiting approval',
    upiFlow: 'collect',
    upiId,
    requestedAt: new Date(),
  });
  return paymentView(updated);
}

async function findByToken(id, token) {
  const payment = await Payment.findById(id).select('+approvalToken');
  const expected = Buffer.from(payment?.approvalToken ?? '');
  const given = Buffer.from(token);
  // A wrong token gets the same answer as a missing payment, so ids can't be probed.
  if (!payment || expected.length !== given.length || !timingSafeEqual(expected, given)) {
    throw ApiError.notFound('This payment link is not valid.');
  }
  return bringUpToDate(payment);
}

/** What the phone that scanned the QR code shows before approving. */
export async function getPaymentForApproval(id, token) {
  const payment = await findByToken(id, token);
  return {
    _id: payment._id,
    reference: payment.reference,
    amount: payment.amount,
    purpose: payment.purpose,
    status: payment.status,
    expiresAt: payment.expiresAt,
    payee: 'CampusCart',
  };
}

/** UPI by QR code: the phone that scanned it approves the payment. */
export async function approveByQr(id, token) {
  const payment = await findByToken(id, token);
  if (!['Created', 'Awaiting approval'].includes(payment.status)) throw ApiError.badRequest(stoppedMessage(payment));
  await succeed(payment, payment.status, { upiFlow: 'qr', upiId: null });
  return getPaymentForApproval(id, token);
}

/** The customer closed the payment screen without paying. */
export async function cancelPayment(userId, id) {
  const payment = await findOwnPayment(userId, id);
  if (!PENDING_PAYMENT_STATUSES.includes(payment.status)) return paymentView(payment);
  return paymentView(await fail(payment, payment.status, 'Closed before paying'));
}

/** Records a payment that needs no gateway: wallet payments, and cash collected on delivery. */
export function recordSettledPayment({ user, method, amount, order, orderNumber, prefix }) {
  const now = new Date();
  return Payment.create({
    reference: newReference(prefix),
    user,
    purpose: 'order',
    method,
    amount,
    status: 'Succeeded',
    order,
    orderNumber,
    expiresAt: now,
    completedAt: now,
  });
}

/** Marks a successful payment as refunded. Returns null if it was already refunded. */
export function markRefunded(paymentId, { amount, reason, to }, filter = {}) {
  return Payment.findOneAndUpdate(
    { ...filter, _id: paymentId, status: 'Succeeded' },
    { $set: { status: 'Refunded', refund: { amount, at: new Date(), reason, to } } },
    { returnDocument: 'after' },
  );
}

/** Pending payments whose screen has timed out are marked so before the admin sees them. */
export async function expireStalePayments() {
  const now = new Date();
  await Payment.updateMany(
    { status: { $in: PENDING_PAYMENT_STATUSES }, expiresAt: { $lte: now } },
    { $set: { status: 'Expired', failureReason: 'The payment screen timed out', completedAt: now } },
  );
}

export async function listPayments({ status, method, purpose, search, ...pageQuery }) {
  await expireStalePayments();
  const { skip, limit, meta } = paginate(pageQuery);
  const filter = {};
  if (status) filter.status = status;
  if (method) filter.method = method;
  if (purpose) filter.purpose = purpose;
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    const users = await User.find({ $or: [{ name: pattern }, { email: pattern }] }).select('_id');
    filter.$or = [{ reference: pattern }, { orderNumber: pattern }, { user: { $in: users.map((user) => user._id) } }];
  }

  const [items, total, [summary]] = await Promise.all([
    Payment.find(filter).populate('user', 'name email').sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit),
    Payment.countDocuments(filter),
    Payment.aggregate([
      {
        $group: {
          _id: null,
          attempts: { $sum: 1 },
          succeeded: { $sum: { $cond: [{ $in: ['$status', SETTLED] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $in: ['$status', ['Failed', 'Expired']] }, 1, 0] } },
          collected: { $sum: { $cond: [{ $in: ['$status', SETTLED] }, '$amount', 0] } },
          refunded: { $sum: { $ifNull: ['$refund.amount', 0] } },
        },
      },
    ]),
  ]);

  const finished = (summary?.succeeded ?? 0) + (summary?.failed ?? 0);
  return {
    items: items.map(paymentView),
    meta: meta(total),
    summary: {
      collected: summary?.collected ?? 0,
      refunded: summary?.refunded ?? 0,
      net: (summary?.collected ?? 0) - (summary?.refunded ?? 0),
      failed: summary?.failed ?? 0,
      successRate: finished ? Math.round(((summary?.succeeded ?? 0) / finished) * 100) : null,
    },
  };
}
