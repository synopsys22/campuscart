import { useState } from 'react';
import { FormError, TextField } from './ui.jsx';

const EMPTY = { label: 'Hostel', line1: '', line2: '', city: '', state: '', pincode: '' };

/** The address fields, shared by checkout and the address book. */
export function AddressForm({ initial, submitLabel, isPending, error, onSubmit, onCancel }) {
  const [form, setForm] = useState({ ...EMPTY, ...initial });
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const errors = error?.fieldErrors ?? {};
  return (
    <form
      className="stack"
      onSubmit={(event) => {
        event.preventDefault();
        const { label, line1, line2, city, state, pincode } = form;
        onSubmit({ label, line1, line2, city, state, pincode });
      }}
    >
      <TextField label="Label" value={form.label} error={errors.label} hint="For example Hostel or Home" onChange={set('label')} />
      <TextField label="Address line 1" autoComplete="address-line1" value={form.line1} error={errors.line1} onChange={set('line1')} />
      <TextField label="Address line 2 (optional)" autoComplete="address-line2" value={form.line2} error={errors.line2} onChange={set('line2')} />
      <div className="form-row">
        <TextField label="City" autoComplete="address-level2" value={form.city} error={errors.city} onChange={set('city')} />
        <TextField label="State" autoComplete="address-level1" value={form.state} error={errors.state} onChange={set('state')} />
      </div>
      <TextField label="Pincode" inputMode="numeric" autoComplete="postal-code" value={form.pincode} error={errors.pincode} onChange={set('pincode')} />
      {!error?.fieldErrors && <FormError error={error} />}
      <div className="row">
        <button type="submit" className="btn btn-primary" disabled={isPending}>
          {isPending ? 'Saving...' : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-quiet" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
