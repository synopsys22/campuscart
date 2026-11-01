import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, MessageSquare, Wrench } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { profileApi, reviewApi, setupApi } from '../../api/index.js';
import { AddressForm } from '../../components/AddressForm.jsx';
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FormError,
  Modal,
  SelectField,
  SkeletonRows,
  Stars,
  TextField,
} from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePageTitle } from '../../hooks/shop.js';
import { formatDate, formatINR } from '../../utils/format.js';
import { ReviewForm } from '../store/ProductDetail.jsx';

const LINKS = [
  { to: '/account', label: 'Profile', end: true },
  { to: '/account/orders', label: 'Orders' },
  { to: '/account/addresses', label: 'Addresses' },
  { to: '/account/reviews', label: 'Reviews' },
  { to: '/account/setups', label: 'Saved builds' },
  { to: '/account/password', label: 'Password' },
];

export function AccountLayout() {
  return (
    <div className="container page side-layout">
      <nav className="side-nav" aria-label="Account">
        {LINKS.map((link) => (
          <NavLink key={link.to} to={link.to} end={link.end}>{link.label}</NavLink>
        ))}
      </nav>
      <div className="side-main">
        <Outlet />
      </div>
    </div>
  );
}

export function Profile() {
  usePageTitle('My profile');
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({
    name: user.name,
    phone: user.phone ?? '',
    college: user.college ?? '',
    branch: user.branch ?? '',
    semester: user.semester ?? '',
  });
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const save = useMutation({
    mutationFn: () => profileApi.update({ ...form, semester: form.semester === '' ? null : Number(form.semester) }),
    onSuccess: (account) => {
      setUser(account);
      toast.success('Profile saved');
    },
  });
  const errors = save.error?.fieldErrors ?? {};

  return (
    <div className="stack narrow">
      <h1>My profile</h1>
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <TextField label="Full name" value={form.name} error={errors.name} onChange={set('name')} />
        <TextField label="Email" value={user.email} disabled hint="Your email is your login, so it can't be changed here." />
        <TextField label="Phone" inputMode="tel" value={form.phone} error={errors.phone} onChange={set('phone')} />
        <TextField label="College" value={form.college} error={errors.college} onChange={set('college')} />
        <div className="form-row">
          <TextField label="Branch" value={form.branch} error={errors.branch} onChange={set('branch')} />
          <SelectField label="Semester" value={form.semester} error={errors.semester} onChange={set('semester')}>
            <option value="">Not set</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{n}</option>)}
          </SelectField>
        </div>
        {!save.error?.fieldErrors && <FormError error={save.error} />}
        <div>
          <button type="submit" className="btn btn-primary" disabled={save.isPending}>
            {save.isPending ? 'Saving...' : 'Save profile'}
          </button>
        </div>
      </form>
    </div>
  );
}

export function ChangePassword() {
  usePageTitle('Change password');
  const [form, setForm] = useState({ currentPassword: '', newPassword: '' });
  const save = useMutation({
    mutationFn: () => profileApi.changePassword(form),
    onSuccess: () => {
      toast.success('Password changed');
      setForm({ currentPassword: '', newPassword: '' });
    },
  });
  const errors = save.error?.fieldErrors ?? {};
  return (
    <div className="stack narrow">
      <h1>Change password</h1>
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <TextField label="Current password" type="password" autoComplete="current-password" value={form.currentPassword} error={errors.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} />
        <TextField label="New password" type="password" autoComplete="new-password" hint="Use at least 8 characters." value={form.newPassword} error={errors.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} />
        {!save.error?.fieldErrors && <FormError error={save.error} />}
        <div>
          <button type="submit" className="btn btn-primary" disabled={save.isPending}>
            {save.isPending ? 'Changing...' : 'Change password'}
          </button>
        </div>
      </form>
    </div>
  );
}

export function Addresses() {
  usePageTitle('Addresses');
  const { user, setUser } = useAuth();
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const onSaved = (addresses) => {
    setUser({ ...user, addresses });
    setEditing(null);
    setRemoving(null);
  };

  const save = useMutation({
    mutationFn: ({ id, body }) => (id ? profileApi.updateAddress(id, body) : profileApi.addAddress(body)),
    onSuccess: (addresses) => {
      onSaved(addresses);
      toast.success('Address saved');
    },
  });
  const remove = useMutation({
    mutationFn: (id) => profileApi.deleteAddress(id),
    onSuccess: (addresses) => {
      onSaved(addresses);
      toast.success('Address removed');
    },
    onError: (error) => toast.error(error.message),
  });
  const makeDefault = useMutation({
    mutationFn: (address) => {
      const { label, line1, line2, city, state, pincode } = address;
      return profileApi.updateAddress(address._id, { label, line1, line2, city, state, pincode, isDefault: true });
    },
    onSuccess: (addresses) => setUser({ ...user, addresses }),
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="stack">
      <div className="row-between">
        <h1>Addresses</h1>
        <button
          type="button"
          className="btn"
          onClick={() => {
            save.reset();
            setEditing({});
          }}
        >
          Add address
        </button>
      </div>
      {user.addresses.length === 0 && (
        <EmptyState icon={MapPin} title="No saved addresses">
          Add your hostel or home address to make checkout faster.
        </EmptyState>
      )}
      <ul className="address-list">
        {user.addresses.map((address) => (
          <li key={address._id}>
            <div>
              <p>
                <strong>{address.label}</strong>
                {address.isDefault && <span className="badge badge-success address-default">Default</span>}
              </p>
              <p className="small muted">
                {[address.line1, address.line2, address.city, address.state, address.pincode].filter(Boolean).join(', ')}
              </p>
            </div>
            <div className="row">
              {!address.isDefault && (
                <button type="button" className="text-link small" onClick={() => makeDefault.mutate(address)}>Make default</button>
              )}
              <button
                type="button"
                className="text-link small"
                onClick={() => {
                  save.reset();
                  setEditing(address);
                }}
              >
                Edit
              </button>
              <button type="button" className="text-link small" onClick={() => setRemoving(address)}>Remove</button>
            </div>
          </li>
        ))}
      </ul>
      {editing && (
        <Modal title={editing._id ? 'Edit address' : 'Add address'} onClose={() => setEditing(null)}>
          <AddressForm
            initial={editing}
            submitLabel="Save address"
            isPending={save.isPending}
            error={save.error}
            onSubmit={(body) => save.mutate({ id: editing._id, body })}
            onCancel={() => setEditing(null)}
          />
        </Modal>
      )}
      {removing && (
        <ConfirmDialog
          title={`Remove ${removing.label}?`}
          confirmLabel="Remove address"
          danger
          isPending={remove.isPending}
          onConfirm={() => remove.mutate(removing._id)}
          onClose={() => setRemoving(null)}
        >
          Past orders keep their delivery address.
        </ConfirmDialog>
      )}
    </div>
  );
}

export function MyReviews() {
  usePageTitle('My reviews');
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['my-reviews'], queryFn: reviewApi.mine });
  const remove = useMutation({
    mutationFn: (id) => reviewApi.remove(id),
    onSuccess: () => {
      toast.success('Review deleted');
      queryClient.invalidateQueries({ queryKey: ['my-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      queryClient.invalidateQueries({ queryKey: ['product'] });
      setRemoving(null);
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="stack">
      <h1>My reviews</h1>
      {isLoading && <SkeletonRows />}
      {isError && <ErrorState error={error} onRetry={refetch} />}
      {data?.length === 0 && (
        <EmptyState
          icon={MessageSquare}
          title="No reviews yet"
          action={<Link to="/account/orders" className="btn">See my orders</Link>}
        >
          You can review a product once your order is delivered.
        </EmptyState>
      )}
      {data?.map((review) => (
        <article key={review._id} className="review">
          <div className="row-between">
            <Link to={`/products/${review.product.slug}`} className="line-name">{review.product.name}</Link>
            <span className="small muted">{formatDate(review.createdAt)}</span>
          </div>
          <Stars value={review.rating} />
          <h2 className="review-title">{review.title}</h2>
          <p>{review.body}</p>
          <div className="row">
            <button type="button" className="text-link small" onClick={() => setEditing(review)}>Edit</button>
            <button type="button" className="text-link small" onClick={() => setRemoving(review)}>Delete</button>
          </div>
        </article>
      ))}
      {editing && (
        <Modal title="Edit your review" onClose={() => setEditing(null)}>
          <ReviewForm productId={editing.product._id} existing={editing} onDone={() => setEditing(null)} />
        </Modal>
      )}
      {removing && (
        <ConfirmDialog
          title="Delete this review?"
          confirmLabel="Delete review"
          danger
          isPending={remove.isPending}
          onConfirm={() => remove.mutate(removing._id)}
          onClose={() => setRemoving(null)}
        >
          This updates the product's rating, and it can't be undone.
        </ConfirmDialog>
      )}
    </div>
  );
}

export function MySetups() {
  usePageTitle('Saved builds');
  const queryClient = useQueryClient();
  const [removing, setRemoving] = useState(null);
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['setups'], queryFn: setupApi.mine });
  const remove = useMutation({
    mutationFn: (id) => setupApi.remove(id),
    onSuccess: () => {
      toast.success('Build deleted');
      queryClient.invalidateQueries({ queryKey: ['setups'] });
      setRemoving(null);
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="stack">
      <div className="row-between">
        <h1>Saved builds</h1>
        <Link to="/setup-builder" className="btn">New build</Link>
      </div>
      {isLoading && <SkeletonRows />}
      {isError && <ErrorState error={error} onRetry={refetch} />}
      {data?.length === 0 && (
        <EmptyState icon={Wrench} title="No saved builds" action={<Link to="/setup-builder" className="btn btn-primary">Build your setup</Link>}>
          Save a build to come back to it later.
        </EmptyState>
      )}
      <ul className="address-list">
        {data?.map((setup) => (
          <li key={setup._id}>
            <div>
              <p><strong>{setup.name}</strong></p>
              <p className="small muted">
                {setup.slots.length} item{setup.slots.length === 1 ? '' : 's'}, total <span className="mono">{formatINR(setup.total)}</span>
                {setup.budget ? <>, budget <span className="mono">{formatINR(setup.budget)}</span></> : null}
              </p>
              {setup.overBudget && <p className="small stock-low">Over budget by {formatINR(setup.total - setup.budget)}</p>}
            </div>
            <div className="row">
              <Link to={`/setup-builder?setup=${setup._id}`} className="text-link small">Open</Link>
              <button type="button" className="text-link small" onClick={() => setRemoving(setup)}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
      {removing && (
        <ConfirmDialog
          title={`Delete ${removing.name}?`}
          confirmLabel="Delete build"
          danger
          isPending={remove.isPending}
          onConfirm={() => remove.mutate(removing._id)}
          onClose={() => setRemoving(null)}
        >
          This only removes the saved build. Nothing in your cart changes.
        </ConfirmDialog>
      )}
    </div>
  );
}
