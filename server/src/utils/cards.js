/**
 * Card checks for the demo payment gateway. The client runs the same checks, so a real
 * card number is refused in the browser and never reaches the server.
 */

/** The only cards the demo accepts, each with the result it produces. */
export const TEST_CARDS = [
  { number: '4111111111111111', outcome: 'success', label: 'Visa: payment succeeds' },
  { number: '5555555555554444', outcome: 'success', label: 'Mastercard: payment succeeds' },
  { number: '6522000000000006', outcome: 'success', label: 'RuPay: payment succeeds' },
  { number: '4000000000000002', outcome: 'declined', label: 'Visa: declined by the bank' },
  { number: '4000000000009995', outcome: 'insufficient_funds', label: 'Visa: not enough balance' },
];

export const DEMO_CARD_OTP = '123456';

export const digitsOnly = (value) => String(value ?? '').replace(/\D/g, '');

/** The Luhn checksum every real card number passes, which catches most typing mistakes. */
export function passesLuhn(number) {
  let sum = 0;
  let double = false;
  for (let i = number.length - 1; i >= 0; i -= 1) {
    let digit = Number(number[i]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return number.length > 0 && sum % 10 === 0;
}

export function cardBrand(number) {
  if (/^4/.test(number)) return 'Visa';
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(number)) return 'Mastercard';
  if (/^(60|65|81|82|508)/.test(number)) return 'RuPay';
  if (/^3[47]/.test(number)) return 'Amex';
  return 'Card';
}

/** True when an MM/YY expiry is this month or later. */
export function expiryIsCurrent(expiry, now = new Date()) {
  const match = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(expiry ?? '');
  if (!match) return false;
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  return year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1);
}

export function findTestCard(number) {
  return TEST_CARDS.find((card) => card.number === number) ?? null;
}
