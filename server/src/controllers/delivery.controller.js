import {
  DELIVERY_METHODS,
  EXPRESS_FEE,
  FREE_SHIPPING_MIN,
  PICKUP_POINTS,
  PICKUP_SLOTS,
  STANDARD_FEE,
  estimateForPincode,
  methodLabel,
} from '../services/delivery.service.js';
import { RETURN_REASONS } from '../models/index.js';
import { RETURN_WINDOW_DAYS } from '../services/order.service.js';
import { ok } from '../utils/http.js';

/** Delivery choices for checkout: methods, fees, campus pickup points and time slots. */
export function options(req, res) {
  ok(res, {
    methods: DELIVERY_METHODS.map((id) => ({ id, label: methodLabel(id) })),
    fees: { standard: STANDARD_FEE, express: EXPRESS_FEE, freeShippingMin: FREE_SHIPPING_MIN },
    pickupPoints: PICKUP_POINTS,
    pickupSlots: PICKUP_SLOTS,
    returnReasons: RETURN_REASONS,
    returnWindowDays: RETURN_WINDOW_DAYS,
  });
}

/** Delivery dates for a pincode, for the product page and checkout. */
export function estimate(req, res) {
  ok(res, estimateForPincode(req.validated.query.pincode));
}
