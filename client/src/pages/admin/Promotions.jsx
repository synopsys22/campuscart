import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { couponApi, kitApi, productApi } from '../../api/index.js';
import {
  ConfirmDialog,
  ErrorState,
  FormError,
  Modal,
  SelectField,
  SkeletonRows,
  TextArea,
  TextField,
} from '../../components/ui.jsx';
import { usePageTitle } from '../../hooks/shop.js';
import { couponSummary, formatDate, formatINR } from '../../utils/format.js';
import { CheckField, useAdminMutation } from './shared.jsx';

/** The local date as a date input expects it. */
function dateInput(value) {
  if (!value) return '';
  const date = new Date(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const orNull = (value) => (value === '' || value === null || value === undefined ? null : value);

/** A coupon runs from the start of its first local day to the end of its last. */
const startOfDay = (date) => (date ? new Date(`${date}T00:00:00`).toISOString() : null);
const endOfDay = (date) => (date ? new Date(`${date}T23:59:59.999`).toISOString() : null);

function couponState(coupon) {
  const now = Date.now();
  if (!coupon.isActive) return ['Off', ''];
  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < now) return ['Expired', 'badge-danger'];
  if (coupon.startsAt && new Date(coupon.startsAt).getTime() > now) return ['Scheduled', 'badge-info'];
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) return ['Used up', 'badge-warning'];
  return ['Live', 'badge-success'];
}

function CouponForm({ coupon, onClose }) {
  const [form, setForm] = useState({
    code: coupon?.code ?? '',
    description: coupon?.description ?? '',
    type: coupon?.type ?? 'percent',
    value: coupon?.value ?? '',
    minOrder: coupon?.minOrder ?? 0,
    maxDiscount: coupon?.maxDiscount ?? '',
    startsAt: dateInput(coupon?.startsAt),
    expiresAt: dateInput(coupon?.expiresAt),
    usageLimit: coupon?.usageLimit ?? '',
    perUserLimit: coupon?.perUserLimit ?? '',
    isActive: coupon?.isActive ?? true,
  });
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const save = useAdminMutation(
    (body) => (coupon ? couponApi.update(coupon._id, body) : couponApi.create(body)),
    {
      quietErrors: true,
      success: coupon ? 'Coupon saved' : 'Coupon created',
      invalidate: ['admin-coupons', 'coupons-available', 'cart'],
      onDone: onClose,
    },
  );
  const errors = save.error?.fieldErrors ?? {};

  const submit = (event) => {
    event.preventDefault();
    save.mutate({
      ...form,
      maxDiscount: orNull(form.maxDiscount),
      usageLimit: orNull(form.usageLimit),
      perUserLimit: orNull(form.perUserLimit),
      startsAt: startOfDay(form.startsAt),
      expiresAt: endOfDay(form.expiresAt),
    });
  };

  return (
    <Modal title={coupon ? `Edit ${coupon.code}` : 'Add a coupon'} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <TextField label="Code" className="input mono" value={form.code} error={errors.code} onChange={set('code')} />
        <TextField label="Description" value={form.description} error={errors.description} onChange={set('description')} />
        <div className="form-row">
          <SelectField label="Type" value={form.type} error={errors.type} onChange={set('type')}>
            <option value="percent">Percent off</option>
            <option value="flat">Flat rupees off</option>
          </SelectField>
          <TextField label="Value" inputMode="numeric" value={form.value} error={errors.value} onChange={set('value')} />
        </div>
        <div className="form-row">
          <TextField label="Minimum order (₹)" inputMode="numeric" value={form.minOrder} error={errors.minOrder} onChange={set('minOrder')} />
          <TextField label="Largest discount (₹, optional)" inputMode="numeric" value={form.maxDiscount} error={errors.maxDiscount} onChange={set('maxDiscount')} />
        </div>
        <div className="form-row">
          <TextField label="Starts (optional)" type="date" value={form.startsAt} error={errors.startsAt} onChange={set('startsAt')} />
          <TextField label="Expires (optional)" type="date" value={form.expiresAt} error={errors.expiresAt} onChange={set('expiresAt')} />
        </div>
        <div className="form-row">
          <TextField label="Total uses allowed (optional)" inputMode="numeric" value={form.usageLimit} error={errors.usageLimit} onChange={set('usageLimit')} />
          <TextField label="Uses per student (optional)" inputMode="numeric" value={form.perUserLimit} error={errors.perUserLimit} onChange={set('perUserLimit')} />
        </div>
        <CheckField label="Coupon is on" checked={form.isActive} onChange={(isActive) => setForm({ ...form, isActive })} />
        {!save.error?.fieldErrors && <FormError error={save.error} />}
        <div className="row modal-actions">
          <button type="button" className="btn btn-quiet" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={save.isPending}>
            {save.isPending ? 'Saving...' : coupon ? 'Save coupon' : 'Create coupon'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function AdminCoupons() {
  usePageTitle('Manage coupons');
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['admin-coupons'], queryFn: couponApi.list });
  const remove = useAdminMutation((id) => couponApi.remove(id), {
    success: 'Coupon deleted',
    invalidate: ['admin-coupons', 'coupons-available'],
    onDone: () => setRemoving(null),
  });

  return (
    <div className="stack">
      <div className="row-between">
        <h1>Coupons</h1>
        <button type="button" className="btn btn-primary" onClick={() => setEditing({})}>
          <Plus size={16} aria-hidden="true" /> Add coupon
        </button>
      </div>
      {isLoading && <SkeletonRows />}
      {isError && <ErrorState error={error} onRetry={refetch} />}
      {data && (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr><th>Code</th><th>Discount</th><th className="num">Min order</th><th>Expires</th><th className="num">Used</th><th>State</th><th><span className="visually-hidden">Actions</span></th></tr>
            </thead>
            <tbody>
              {data.map((coupon) => {
                const [label, badge] = couponState(coupon);
                return (
                  <tr key={coupon._id}>
                    <td>
                      <span className="mono">{coupon.code}</span>
                      <div className="small muted">{coupon.description}</div>
                    </td>
                    <td>{couponSummary(coupon)}</td>
                    <td className="num mono">{formatINR(coupon.minOrder)}</td>
                    <td>{coupon.expiresAt ? formatDate(coupon.expiresAt) : <span className="muted">Never</span>}</td>
                    <td className="num mono">{coupon.usedCount}{coupon.usageLimit ? ` of ${coupon.usageLimit}` : ''}</td>
                    <td><span className={`badge ${badge}`}>{label}</span></td>
                    <td>
                      <div className="table-actions">
                        <button type="button" className="text-link small" aria-label={`Edit ${coupon.code}`} onClick={() => setEditing(coupon)}>Edit</button>
                        <button type="button" className="text-link small" aria-label={`Delete ${coupon.code}`} onClick={() => setRemoving(coupon)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {editing && <CouponForm coupon={editing._id ? editing : null} onClose={() => setEditing(null)} />}
      {removing && (
        <ConfirmDialog
          title={`Delete ${removing.code}?`}
          confirmLabel="Delete coupon"
          danger
          isPending={remove.isPending}
          onConfirm={() => remove.mutate(removing._id)}
          onClose={() => setRemoving(null)}
        >
          Past orders keep their discount. Carts using this code lose it.
        </ConfirmDialog>
      )}
    </div>
  );
}

function KitForm({ kit, onClose }) {
  const products = useQuery({
    queryKey: ['admin-all-products'],
    queryFn: () => productApi.list({ limit: 100, sort: 'price_asc' }),
  });
  const options = [...(products.data?.items ?? [])].sort((a, b) => a.name.localeCompare(b.name));

  const [form, setForm] = useState({
    name: kit?.name ?? '',
    description: kit?.description ?? '',
    audience: kit?.audience ?? '',
    semester: kit?.semester ?? '',
    isFeatured: kit?.isFeatured ?? false,
    isActive: kit?.isActive ?? true,
    items: (kit?.items ?? []).map((item) => ({ product: item.product._id, qty: item.qty })),
  });
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const setItem = (index, changes) =>
    setForm({ ...form, items: form.items.map((item, i) => (i === index ? { ...item, ...changes } : item)) });

  const save = useAdminMutation(
    (body) => (kit ? kitApi.update(kit._id, body) : kitApi.create(body)),
    {
      quietErrors: true,
      success: kit ? 'Kit saved' : 'Kit created',
      invalidate: ['kits', 'kit'],
      onDone: onClose,
    },
  );
  const errors = save.error?.fieldErrors ?? {};
  // Errors on a single row arrive under keys such as "items.0.qty".
  const itemsError =
    errors.items ?? Object.entries(errors).find(([field]) => field.startsWith('items.'))?.[1];

  return (
    <Modal title={kit ? `Edit ${kit.name}` : 'Add a kit'} onClose={onClose} wide>
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate({ ...form, semester: orNull(form.semester) });
        }}
      >
        <TextField label="Name" value={form.name} error={errors.name} onChange={set('name')} />
        <TextArea label="Description" rows={3} value={form.description} error={errors.description} onChange={set('description')} />
        <div className="form-row">
          <TextField label="Who it's for" value={form.audience} error={errors.audience} onChange={set('audience')} />
          <SelectField label="Semester" value={form.semester} error={errors.semester} onChange={set('semester')}>
            <option value="">Any</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{n}</option>)}
          </SelectField>
        </div>
        <fieldset className="stack plain-fieldset">
          <legend className="small"><strong>Products in this kit</strong></legend>
          {form.items.map((item, index) => (
            <div className="kit-item-row" key={index}>
              <select className="input" aria-label={`Product ${index + 1}`} value={item.product} onChange={(e) => setItem(index, { product: e.target.value })}>
                {options.map((product) => <option key={product._id} value={product._id}>{product.name}</option>)}
              </select>
              <input className="input mono" aria-label={`Quantity of product ${index + 1}`} inputMode="numeric" value={item.qty} onChange={(e) => setItem(index, { qty: e.target.value.replace(/\D/g, '') })} />
              <button type="button" className="icon-btn" aria-label={`Remove product ${index + 1}`} onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== index) })}>
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </div>
          ))}
          <div>
            <button
              type="button"
              className="btn btn-small"
              disabled={options.length === 0}
              onClick={() => setForm({ ...form, items: [...form.items, { product: options[0]._id, qty: 1 }] })}
            >
              <Plus size={14} aria-hidden="true" /> Add product
            </button>
          </div>
          {itemsError && <p className="field-error">{itemsError}</p>}
        </fieldset>
        <div className="row">
          <CheckField label="Featured on the home page" checked={form.isFeatured} onChange={(isFeatured) => setForm({ ...form, isFeatured })} />
          <CheckField label="Visible in the store" checked={form.isActive} onChange={(isActive) => setForm({ ...form, isActive })} />
        </div>
        {!save.error?.fieldErrors && <FormError error={save.error} />}
        <div className="row modal-actions">
          <button type="button" className="btn btn-quiet" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={save.isPending}>
            {save.isPending ? 'Saving...' : kit ? 'Save kit' : 'Create kit'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function AdminKits() {
  usePageTitle('Manage kits');
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['kits', 'admin'],
    queryFn: () => kitApi.list({ includeInactive: 'true' }),
  });
  const remove = useAdminMutation((id) => kitApi.remove(id), {
    success: 'Kit deleted',
    invalidate: ['kits', 'kit'],
    onDone: () => setRemoving(null),
  });

  return (
    <div className="stack">
      <div className="row-between">
        <h1>Project Kits</h1>
        <button type="button" className="btn btn-primary" onClick={() => setEditing({})}>
          <Plus size={16} aria-hidden="true" /> Add kit
        </button>
      </div>
      {isLoading && <SkeletonRows />}
      {isError && <ErrorState error={error} onRetry={refetch} />}
      {data && (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr><th>Name</th><th className="num">Items</th><th className="num">Total</th><th>Stock</th><th>Status</th><th><span className="visually-hidden">Actions</span></th></tr>
            </thead>
            <tbody>
              {data.map((kit) => (
                <tr key={kit._id}>
                  <td>
                    {kit.name}
                    <div className="small muted">{kit.audience}</div>
                  </td>
                  <td className="num mono">{kit.itemCount}</td>
                  <td className="num mono">{formatINR(kit.totalPrice)}</td>
                  <td><span className={`badge ${kit.inStock ? 'badge-success' : 'badge-warning'}`}>{kit.inStock ? 'All in stock' : 'Short on stock'}</span></td>
                  <td><span className={`badge ${kit.isActive ? 'badge-success' : ''}`}>{kit.isActive ? 'Visible' : 'Hidden'}</span></td>
                  <td>
                    <div className="table-actions">
                      <button type="button" className="text-link small" aria-label={`Edit ${kit.name}`} onClick={() => setEditing(kit)}>Edit</button>
                      <button type="button" className="text-link small" aria-label={`Delete ${kit.name}`} onClick={() => setRemoving(kit)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <KitForm kit={editing._id ? editing : null} onClose={() => setEditing(null)} />}
      {removing && (
        <ConfirmDialog
          title={`Delete ${removing.name}?`}
          confirmLabel="Delete kit"
          danger
          isPending={remove.isPending}
          onConfirm={() => remove.mutate(removing._id)}
          onClose={() => setRemoving(null)}
        >
          The products themselves stay in the store.
        </ConfirmDialog>
      )}
    </div>
  );
}
