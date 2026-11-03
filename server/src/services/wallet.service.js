import { User, WalletTransaction } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { formatINR } from '../utils/http.js';

export const TOPUP_MIN = 100;
export const TOPUP_MAX = 10000;
export const BALANCE_MAX = 50000;

/** Adds money to a wallet and records it. The balance changes in one atomic step. */
export async function creditWallet(userId, amount, { kind, description, order = null, orderNumber = null, payment = null }) {
  const user = await User.findByIdAndUpdate(
    userId,
    { $inc: { walletBalance: amount } },
    { returnDocument: 'after' },
  );
  if (!user) throw ApiError.notFound('That account was not found.');
  return WalletTransaction.create({
    user: userId,
    type: 'credit',
    kind,
    amount,
    balanceAfter: user.walletBalance,
    description,
    order,
    orderNumber,
    payment,
  });
}

/**
 * Takes money from a wallet only if the balance covers it, so two payments at once can
 * never push the balance below zero.
 */
export async function debitWallet(userId, amount, { kind, description, order = null, orderNumber = null, payment = null }) {
  const user = await User.findOneAndUpdate(
    { _id: userId, walletBalance: { $gte: amount } },
    { $inc: { walletBalance: -amount } },
    { returnDocument: 'after' },
  );
  if (!user) {
    const current = await User.findById(userId).select('walletBalance');
    throw ApiError.badRequest(
      `Your wallet has ${formatINR(current?.walletBalance ?? 0)}, which is less than ${formatINR(amount)}. Add money or choose another way to pay.`,
    );
  }
  return WalletTransaction.create({
    user: userId,
    type: 'debit',
    kind,
    amount,
    balanceAfter: user.walletBalance,
    description,
    order,
    orderNumber,
    payment,
  });
}

/** Checks a top-up before the payment screen opens. */
export async function requireAllowedTopup(userId, amount) {
  const user = await User.findById(userId).select('walletBalance');
  if (user.walletBalance + amount > BALANCE_MAX) {
    throw ApiError.badRequest(
      `A wallet can hold up to ${formatINR(BALANCE_MAX)}. You can add up to ${formatINR(Math.max(BALANCE_MAX - user.walletBalance, 0))} more.`,
    );
  }
}
