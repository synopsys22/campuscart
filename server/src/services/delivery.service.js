import { randomInt } from 'node:crypto';
import { ApiError } from '../utils/ApiError.js';

/**
 * Every delivery rule in one place: methods and fees, which pincodes we reach and how
 * fast, campus pickup points, couriers, tracking numbers and delivery codes.
 */

export const DELIVERY_METHODS = ['standard', 'express', 'pickup'];

export const FREE_SHIPPING_MIN = 999;
export const STANDARD_FEE = 49;
export const EXPRESS_FEE = 99;

const METHOD_LABELS = {
  standard: 'Standard delivery',
  express: 'Express delivery',
  pickup: 'Campus pickup',
};

export const PICKUP_POINTS = [
  { id: 'hostel-desk', name: 'Hostel reception desk', detail: 'Main boys and girls hostel blocks' },
  { id: 'central-library', name: 'Central Library entrance', detail: 'Ground floor, beside the issue counter' },
  { id: 'cs-department', name: 'CS Department office', detail: 'Second floor, room 204' },
  { id: 'main-gate', name: 'Main Gate security office', detail: 'Beside the visitor entrance' },
];

export const PICKUP_SLOTS = [
  { id: '10-12', label: '10 AM to 12 PM' },
  { id: '12-14', label: '12 PM to 2 PM' },
  { id: '14-16', label: '2 PM to 4 PM' },
  { id: '16-18', label: '4 PM to 6 PM' },
];

const COURIERS = {
  standard: 'CampusCart Logistics',
  express: 'SwiftDash Express',
  pickup: 'CampusCart Campus Desk',
};

// Orders leave a warehouse in Chennai, so delivery time depends on how far the pincode is.
const WAREHOUSE_CITY = 'Chennai';
const WAREHOUSE_PREFIX = '600';
const SOUTH_INDIA_DIGITS = ['5', '6'];
const ZONES = {
  local: { region: `${WAREHOUSE_CITY} area`, standard: 2, express: 1 },
  regional: { region: 'South India', standard: 4, express: 2 },
  national: { region: 'the rest of India', standard: 6, express: 3 },
};
const PICKUP_DAYS = 1;

const DAY_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function methodLabel(method) {
  return METHOD_LABELS[method] ?? METHOD_LABELS.standard;
}

export function courierFor(method) {
  return COURIERS[method] ?? COURIERS.standard;
}

/** What delivery costs for an order of this subtotal. */
export function deliveryFee(method, subtotal) {
  if (subtotal === 0 || method === 'pickup') return 0;
  if (method === 'express') return EXPRESS_FEE;
  return subtotal >= FREE_SHIPPING_MIN ? 0 : STANDARD_FEE;
}

/** The options shown at checkout, with what each costs for this subtotal. */
export function deliveryOptions(subtotal) {
  return DELIVERY_METHODS.map((id) => ({ id, label: methodLabel(id), fee: deliveryFee(id, subtotal) }));
}

/**
 * Indian pincodes start 1 to 8 by postal region. 9 is the army postal service, which a
 * courier cannot reach, and 0 is never used.
 */
function zoneOf(pincode) {
  if (!/^[1-8]\d{5}$/.test(pincode ?? '')) return null;
  if (pincode.startsWith(WAREHOUSE_PREFIX)) return 'local';
  if (SOUTH_INDIA_DIGITS.includes(pincode[0])) return 'regional';
  return 'national';
}

/** Adds working days, skipping Sundays in Indian time, when couriers do not deliver. */
export function addWorkingDays(from, days) {
  const date = new Date(from.getTime());
  let added = 0;
  while (added < days) {
    date.setTime(date.getTime() + DAY_MS);
    if (new Date(date.getTime() + IST_OFFSET_MS).getUTCDay() !== 0) added += 1;
  }
  return date;
}

/** Delivery dates for a pincode, as shown on product pages and at checkout. */
export function estimateForPincode(pincode, from = new Date()) {
  const pickup = { days: PICKUP_DAYS, date: addWorkingDays(from, PICKUP_DAYS) };
  const zone = zoneOf(pincode);
  if (!zone) {
    return {
      pincode,
      serviceable: false,
      message: `We don't deliver to ${pincode} yet. Campus pickup is still available.`,
      pickup,
    };
  }
  const { region, standard, express } = ZONES[zone];
  return {
    pincode,
    serviceable: true,
    region,
    standard: { days: standard, date: addWorkingDays(from, standard) },
    express: { days: express, date: addWorkingDays(from, express) },
    pickup,
  };
}

/** Checks the delivery choice and returns the expected delivery date. */
export function requireDeliveryDate({ method, pincode }, from = new Date()) {
  if (method === 'pickup') return addWorkingDays(from, PICKUP_DAYS);
  const estimate = estimateForPincode(pincode, from);
  if (!estimate.serviceable) {
    throw ApiError.badRequest(`We don't deliver to pincode ${pincode} yet. Choose campus pickup or another address.`);
  }
  return estimate[method].date;
}

export function findPickupPoint(id) {
  return PICKUP_POINTS.find((point) => point.id === id) ?? null;
}

export function findPickupSlot(id) {
  return PICKUP_SLOTS.find((slot) => slot.id === id) ?? null;
}

/** A courier tracking number such as CCT4829104731. */
export function newTrackingNumber() {
  return `CCT${randomInt(1e9, 1e10)}`;
}

/** The 4-digit code the customer gives the courier or pickup desk. */
export function newDeliveryCode() {
  return String(randomInt(1000, 10000));
}
