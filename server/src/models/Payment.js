import mongoose from 'mongoose';

/** Methods that go through the demo payment gateway, with its card and UPI screens. */
export const GATEWAY_METHODS = ['MOCK_CARD', 'MOCK_UPI'];
export const PAYMENT_RECORD_METHODS = [...GATEWAY_METHODS, 'WALLET', 'COD'];
export const PAYMENT_PURPOSES = ['order', 'wallet_topup'];
export const PENDING_PAYMENT_STATUSES = ['Created', 'Awaiting OTP', 'Awaiting approval'];
export const PAYMENT_RECORD_STATUSES = [...PENDING_PAYMENT_STATUSES, 'Succeeded', 'Failed', 'Expired', 'Refunded'];

/**
 * One payment attempt, successful or not. Card and UPI payments start here before the
 * order exists, so a failed payment never leaves a half-made order behind.
 */
const paymentSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    purpose: { type: String, enum: PAYMENT_PURPOSES, required: true },
    method: { type: String, enum: PAYMENT_RECORD_METHODS, required: true },
    amount: { type: Number, required: true, min: 1 },
    status: { type: String, enum: PAYMENT_RECORD_STATUSES, default: 'Created' },
    // The delivery choice the amount was worked out for, checked again when the order is placed.
    deliveryMethod: { type: String, default: null },
    // Only the brand and last four digits are kept. The full number, expiry and CVV never are.
    card: {
      type: new mongoose.Schema({ brand: String, last4: String }, { _id: false }),
      default: null,
    },
    upiId: { type: String, default: null },
    upiFlow: { type: String, enum: ['collect', 'qr', null], default: null },
    // Lets a phone that scanned the QR code approve the payment without logging in.
    approvalToken: { type: String, default: null, select: false },
    otpAttempts: { type: Number, default: 0 },
    requestedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
    completedAt: { type: Date, default: null },
    failureReason: { type: String, default: null },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    orderNumber: { type: String, default: null },
    refund: {
      type: new mongoose.Schema(
        {
          amount: { type: Number, required: true },
          at: { type: Date, required: true },
          reason: { type: String, default: '' },
          to: { type: String, enum: ['source', 'wallet'], required: true },
        },
        { _id: false },
      ),
      default: null,
    },
  },
  { timestamps: true },
);

paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ user: 1, createdAt: -1 });
paymentSchema.index({ status: 1, expiresAt: 1 });
paymentSchema.index({ order: 1 });

export const Payment = mongoose.model('Payment', paymentSchema);
