// The same card checks as server/src/utils/cards.js. Running them here means a real card
// number is stopped in the browser and is never sent anywhere.

export const digitsOnly = (value) => String(value ?? '').replace(/\D/g, '');

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
  return null;
}

/** Groups digits in fours as they are typed: 4111 1111 1111 1111. */
export const formatCardNumber = (value) => digitsOnly(value).slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ');

/** Adds the slash as the expiry is typed: 0429 becomes 04/29. */
export function formatExpiry(value) {
  const digits = digitsOnly(value).slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

export function expiryIsCurrent(expiry, now = new Date()) {
  const match = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(expiry ?? '');
  if (!match) return false;
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  return year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1);
}

/** Checks the card form. Returns an object of field errors, empty when everything is fine. */
export function checkCard({ number, name, expiry, cvv }, testNumbers) {
  const errors = {};
  const digits = digitsOnly(number);
  if (!/^\d{12,19}$/.test(digits)) errors.number = 'Enter the full card number.';
  else if (!passesLuhn(digits)) errors.number = 'This card number is not valid.';
  else if (!testNumbers.includes(digits)) errors.number = 'Use one of the test cards below. Never enter a real card here.';
  if (name.trim().length < 2) errors.name = 'Enter the name on the card.';
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry)) errors.expiry = 'Enter the expiry as MM/YY.';
  else if (!expiryIsCurrent(expiry)) errors.expiry = 'This card has expired.';
  if (!/^\d{3}$/.test(cvv)) errors.cvv = 'Enter the 3-digit CVV.';
  return errors;
}

export const UPI_ID_PATTERN = /^[a-z0-9._-]{2,64}@[a-z][a-z0-9]{1,30}$/;
