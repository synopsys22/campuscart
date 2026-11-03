import { useQuery } from '@tanstack/react-query';
import { MapPin, Store, Truck, Zap } from 'lucide-react';
import { useState } from 'react';
import { deliveryApi } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { deliveryNote, formatDay, formatINR } from '../utils/format.js';

const PINCODE_KEY = 'campuscart-pincode';

export const METHOD_ICONS = { standard: Truck, express: Zap, pickup: Store };

function rememberedPincode() {
  try {
    return localStorage.getItem(PINCODE_KEY) ?? '';
  } catch {
    return '';
  }
}

function rememberPincode(pincode) {
  try {
    localStorage.setItem(PINCODE_KEY, pincode);
  } catch {
    // Without storage, the pincode simply isn't remembered.
  }
}

export function useDeliveryOptions() {
  return useQuery({ queryKey: ['delivery-options'], queryFn: deliveryApi.options, staleTime: Infinity });
}

export function useDeliveryEstimate(pincode) {
  return useQuery({
    queryKey: ['delivery-estimate', pincode],
    queryFn: () => deliveryApi.estimate(pincode),
    enabled: /^\d{6}$/.test(pincode ?? ''),
    staleTime: 5 * 60 * 1000,
  });
}

/** Product page: delivery dates for a pincode, starting from the one used last or the default address. */
export function PincodeCheck({ price }) {
  const { user } = useAuth();
  const initial = rememberedPincode() || user?.addresses?.find((address) => address.isDefault)?.pincode || '';
  const [draft, setDraft] = useState(initial);
  const [pincode, setPincode] = useState(initial);
  const estimate = useDeliveryEstimate(pincode);
  const fees = useDeliveryOptions().data?.fees;
  const standardFee = fees && (price >= fees.freeShippingMin ? 'Free' : formatINR(fees.standard));
  const expressFee = fees && formatINR(fees.express);

  return (
    <div className="pincode-check">
      <p className="row small pincode-title">
        <Truck size={16} aria-hidden="true" />
        <span>{deliveryNote(price)}</span>
      </p>
      <form
        className="pincode-form"
        onSubmit={(event) => {
          event.preventDefault();
          setPincode(draft.trim());
          rememberPincode(draft.trim());
        }}
      >
        <label className="visually-hidden" htmlFor="pincode-check">Delivery pincode</label>
        <input
          id="pincode-check"
          className="input mono"
          inputMode="numeric"
          maxLength={6}
          placeholder="Pincode"
          value={draft}
          onChange={(event) => setDraft(event.target.value.replace(/\D/g, ''))}
        />
        <button type="submit" className="btn btn-small" disabled={!/^\d{6}$/.test(draft)}>Check</button>
      </form>
      {estimate.isError && <p className="small field-error">{estimate.error.message}</p>}
      {estimate.data && !estimate.data.serviceable && (
        <p className="small stock-low" role="status">{estimate.data.message}</p>
      )}
      {estimate.data?.serviceable && (
        <ul className="eta-list small" aria-live="polite" aria-label={`Delivery to ${estimate.data.pincode}`}>
          <li><Truck size={14} aria-hidden="true" /> Standard by <strong>{formatDay(estimate.data.standard.date)}</strong> <span className="muted">{standardFee}</span></li>
          <li><Zap size={14} aria-hidden="true" /> Express by <strong>{formatDay(estimate.data.express.date)}</strong> <span className="muted">{expressFee}</span></li>
          <li><Store size={14} aria-hidden="true" /> Campus pickup from <strong>{formatDay(estimate.data.pickup.date)}</strong> <span className="muted">Free</span></li>
        </ul>
      )}
    </div>
  );
}

/** Checkout: the three ways to get an order, each with its fee and date. */
export function DeliveryMethodPicker({ options, estimate, value, onChange }) {
  const dateFor = (id) => {
    if (id === 'pickup') return estimate?.pickup?.date;
    return estimate?.serviceable ? estimate[id].date : null;
  };
  const help = {
    standard: 'Delivered to your door by CampusCart Logistics.',
    express: 'Faster delivery by SwiftDash Express.',
    pickup: 'Collect it on campus at a time that suits you.',
  };
  return (
    <div role="radiogroup" aria-label="Delivery method" className="choice-list delivery-methods">
      {options.map(({ id, label, fee }) => {
        const Icon = METHOD_ICONS[id];
        const date = dateFor(id);
        return (
          <label key={id} className={`choice ${value === id ? 'choice-on' : ''}`}>
            <input type="radio" name="delivery-method" checked={value === id} onChange={() => onChange(id)} />
            <Icon size={20} aria-hidden="true" />
            <span className="choice-grow">
              <strong>{label}</strong>
              <span className="small muted choice-detail">
                {help[id]} {date && <>{id === 'pickup' ? 'Ready from' : 'Arrives by'} <strong>{formatDay(date)}</strong>.</>}
              </span>
            </span>
            <span className="choice-price">{fee === 0 ? 'Free' : formatINR(fee)}</span>
          </label>
        );
      })}
    </div>
  );
}

export function PickupPicker({ points, slots, point, slot, onPoint, onSlot }) {
  return (
    <div className="stack">
      <fieldset className="plain-fieldset">
        <legend><strong>Pickup point</strong></legend>
        <div role="radiogroup" aria-label="Pickup point" className="choice-list">
          {points.map((option) => (
            <label key={option.id} className={`choice ${point === option.id ? 'choice-on' : ''}`}>
              <input type="radio" name="pickup-point" checked={point === option.id} onChange={() => onPoint(option.id)} />
              <MapPin size={18} aria-hidden="true" />
              <span>
                <strong>{option.name}</strong>
                <span className="small muted choice-detail">{option.detail}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="plain-fieldset">
        <legend><strong>Pickup time</strong></legend>
        <div className="chip-row" role="radiogroup" aria-label="Pickup time">
          {slots.map((option) => (
            <label key={option.id} className={`chip ${slot === option.id ? 'chip-on' : ''}`}>
              <input type="radio" className="visually-hidden" name="pickup-slot" checked={slot === option.id} onChange={() => onSlot(option.id)} />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
