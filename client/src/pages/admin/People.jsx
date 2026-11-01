import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { reviewApi, userApi } from '../../api/index.js';
import {
  ConfirmDialog,
  ErrorState,
  Pagination,
  SkeletonRows,
  Stars,
} from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useDebounce, usePageTitle } from '../../hooks/shop.js';
import { formatDate } from '../../utils/format.js';
import { useAdminMutation } from './shared.jsx';

export function AdminUsers() {
  usePageTitle('Manage users');
  const { user: me } = useAuth();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState(null);
  const term = useDebounce(search);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-users', term, role, page],
    queryFn: () => userApi.list({ search: term, role, page, limit: 15 }),
    placeholderData: keepPreviousData,
  });

  const update = useAdminMutation(({ id, body }) => userApi.update(id, body), {
    success: (updated) => `Updated ${updated.name}`,
    invalidate: ['admin-users'],
    onDone: () => setPending(null),
  });

  return (
    <div className="stack">
      <h1>Users</h1>
      <div className="toolbar">
        <label className="visually-hidden" htmlFor="user-search">Search users</label>
        <input
          id="user-search"
          className="input"
          placeholder="Search by name, email or college"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <label className="visually-hidden" htmlFor="user-role">Filter by role</label>
        <select
          id="user-role"
          className="input input-auto"
          value={role}
          onChange={(event) => {
            setRole(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All roles</option>
          <option value="student">Students</option>
          <option value="admin">Admins</option>
        </select>
        {data && <span className="small muted">{data.meta.total} users</span>}
      </div>
      {isLoading && <SkeletonRows />}
      {isError && <ErrorState error={error} onRetry={refetch} />}
      {data && (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr><th>Name</th><th>College</th><th>Joined</th><th>Role</th><th>Status</th><th><span className="visually-hidden">Actions</span></th></tr>
            </thead>
            <tbody>
              {data.items.map((user) => {
                const isMe = user._id === me._id;
                return (
                  <tr key={user._id}>
                    <td>
                      {user.name} {isMe && <span className="small muted">(you)</span>}
                      <div className="small muted">{user.email}</div>
                    </td>
                    <td>{user.college || <span className="muted">Not set</span>}</td>
                    <td>{formatDate(user.createdAt)}</td>
                    <td><span className={`badge ${user.role === 'admin' ? 'badge-info' : ''}`}>{user.role === 'admin' ? 'Admin' : 'Student'}</span></td>
                    <td><span className={`badge ${user.isActive ? 'badge-success' : 'badge-danger'}`}>{user.isActive ? 'Active' : 'Deactivated'}</span></td>
                    <td>
                      {!isMe && (
                        <div className="table-actions">
                          <button
                            type="button"
                            className="text-link small"
                            onClick={() =>
                              setPending({
                                user,
                                body: { role: user.role === 'admin' ? 'student' : 'admin' },
                                title: user.role === 'admin' ? `Remove admin access from ${user.name}?` : `Make ${user.name} an admin?`,
                                confirmLabel: user.role === 'admin' ? 'Remove admin access' : 'Make admin',
                                detail: user.role === 'admin' ? 'They keep their account and orders.' : 'They will be able to manage products, orders and users.',
                              })
                            }
                          >
                            {user.role === 'admin' ? 'Remove admin' : 'Make admin'}
                          </button>
                          <button
                            type="button"
                            className="text-link small"
                            onClick={() =>
                              setPending({
                                user,
                                body: { isActive: !user.isActive },
                                title: user.isActive ? `Deactivate ${user.name}?` : `Reactivate ${user.name}?`,
                                confirmLabel: user.isActive ? 'Deactivate account' : 'Reactivate account',
                                danger: user.isActive,
                                detail: user.isActive ? "They won't be able to log in. Their orders stay on record." : 'They will be able to log in again.',
                              })
                            }
                          >
                            {user.isActive ? 'Deactivate' : 'Reactivate'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination meta={data?.meta} onPage={setPage} />
      {pending && (
        <ConfirmDialog
          title={pending.title}
          confirmLabel={pending.confirmLabel}
          danger={pending.danger}
          isPending={update.isPending}
          onConfirm={() => update.mutate({ id: pending.user._id, body: pending.body })}
          onClose={() => setPending(null)}
        >
          {pending.detail}
        </ConfirmDialog>
      )}
    </div>
  );
}

export function AdminReviews() {
  usePageTitle('Moderate reviews');
  const [page, setPage] = useState(1);
  const [removing, setRemoving] = useState(null);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-reviews', page],
    queryFn: () => reviewApi.listAll({ page, limit: 15 }),
    placeholderData: keepPreviousData,
  });
  const remove = useAdminMutation((id) => reviewApi.remove(id), {
    success: 'Review deleted',
    invalidate: ['admin-reviews', 'reviews', 'product', 'products'],
    onDone: () => setRemoving(null),
  });

  return (
    <div className="stack">
      <h1>Reviews</h1>
      {isLoading && <SkeletonRows />}
      {isError && <ErrorState error={error} onRetry={refetch} />}
      {data && (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr><th>Product</th><th>Rating</th><th>Review</th><th>By</th><th>Date</th><th><span className="visually-hidden">Actions</span></th></tr>
            </thead>
            <tbody>
              {data.items.map((review) => (
                <tr key={review._id}>
                  <td><Link to={`/products/${review.product?.slug}`} className="line-name">{review.product?.name}</Link></td>
                  <td><Stars value={review.rating} /></td>
                  <td>
                    <strong>{review.title}</strong>
                    <div className="small muted">{review.body}</div>
                  </td>
                  <td>{review.user?.name}</td>
                  <td>{formatDate(review.createdAt)}</td>
                  <td><button type="button" className="text-link small" onClick={() => setRemoving(review)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination meta={data?.meta} onPage={setPage} />
      {removing && (
        <ConfirmDialog
          title="Delete this review?"
          confirmLabel="Delete review"
          danger
          isPending={remove.isPending}
          onConfirm={() => remove.mutate(removing._id)}
          onClose={() => setRemoving(null)}
        >
          The product's rating updates straight away, and this can't be undone.
        </ConfirmDialog>
      )}
    </div>
  );
}
