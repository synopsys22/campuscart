import { User, WalletTransaction } from '../models/index.js';
import {
  approveByQr,
  cancelPayment,
  createPayment,
  getPayment,
  getPaymentForApproval,
  listPayments,
  requestUpiCollect,
  submitCard,
  verifyCardOtp,
} from '../services/payment.service.js';
import { BALANCE_MAX, TOPUP_MAX, TOPUP_MIN } from '../services/wallet.service.js';
import { TEST_CARDS, DEMO_CARD_OTP } from '../utils/cards.js';
import { escapeRegex, ok, paginate } from '../utils/http.js';

// The payment gateway

export async function create(req, res) {
  ok(res, await createPayment(req.user._id, req.validated.body), { status: 201 });
}

export async function show(req, res) {
  ok(res, await getPayment(req.user._id, req.validated.params.id));
}

export async function card(req, res) {
  ok(res, await submitCard(req.user._id, req.validated.params.id, req.validated.body));
}

export async function otp(req, res) {
  ok(res, await verifyCardOtp(req.user._id, req.validated.params.id, req.validated.body.otp));
}

export async function upi(req, res) {
  ok(res, await requestUpiCollect(req.user._id, req.validated.params.id, req.validated.body.upiId));
}

export async function cancel(req, res) {
  ok(res, await cancelPayment(req.user._id, req.validated.params.id));
}

/** Public: the details a phone sees after scanning the UPI QR code. */
export async function approvalDetails(req, res) {
  ok(res, await getPaymentForApproval(req.validated.params.id, req.validated.query.token));
}

/** Public: the phone approves the payment. */
export async function approve(req, res) {
  ok(res, await approveByQr(req.validated.params.id, req.validated.body.token));
}

/** The test cards and OTP the payment screen lists, so the demo is easy to run. */
export function testDetails(req, res) {
  ok(res, {
    cards: TEST_CARDS,
    otp: DEMO_CARD_OTP,
    upi: { approves: 'success@campus', declines: 'failure@campus' },
  });
}

// The wallet

export async function myWallet(req, res) {
  const { skip, limit, meta } = paginate(req.validated.query);
  const filter = { user: req.user._id };
  const [user, transactions, total] = await Promise.all([
    User.findById(req.user._id).select('walletBalance'),
    WalletTransaction.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit),
    WalletTransaction.countDocuments(filter),
  ]);
  ok(res, transactions, {
    meta: meta(total),
    summary: { balance: user.walletBalance, topupMin: TOPUP_MIN, topupMax: TOPUP_MAX, balanceMax: BALANCE_MAX },
  });
}

// Admin

export async function adminList(req, res) {
  const { items, meta, summary } = await listPayments(req.validated.query);
  ok(res, items, { meta, summary });
}

export async function adminWallet(req, res) {
  const { type, search, ...pageQuery } = req.validated.query;
  const { skip, limit, meta } = paginate(pageQuery);
  const filter = {};
  if (type) filter.type = type;
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    const users = await User.find({ $or: [{ name: pattern }, { email: pattern }] }).select('_id');
    filter.$or = [{ orderNumber: pattern }, { user: { $in: users.map((user) => user._id) } }];
  }
  const [transactions, total, [totals], [held]] = await Promise.all([
    WalletTransaction.find(filter).populate('user', 'name email').sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit),
    WalletTransaction.countDocuments(filter),
    WalletTransaction.aggregate([
      {
        $group: {
          _id: null,
          toppedUp: { $sum: { $cond: [{ $eq: ['$kind', 'topup'] }, '$amount', 0] } },
          spent: { $sum: { $cond: [{ $eq: ['$kind', 'payment'] }, '$amount', 0] } },
          refunded: { $sum: { $cond: [{ $eq: ['$kind', 'refund'] }, '$amount', 0] } },
        },
      },
    ]),
    User.aggregate([{ $group: { _id: null, balance: { $sum: '$walletBalance' }, wallets: { $sum: { $cond: [{ $gt: ['$walletBalance', 0] }, 1, 0] } } } }]),
  ]);
  ok(res, transactions, {
    meta: meta(total),
    summary: {
      held: held?.balance ?? 0,
      wallets: held?.wallets ?? 0,
      toppedUp: totals?.toppedUp ?? 0,
      spent: totals?.spent ?? 0,
      refunded: totals?.refunded ?? 0,
    },
  });
}
