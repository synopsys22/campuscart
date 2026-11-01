import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useLocation, useNavigate } from 'react-router-dom';
import { cartApi, wishlistApi } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';

export function useDebounce(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} | CampusCart` : 'CampusCart: gear up for your CS degree';
  }, [title]);
}

/** Sends a guest to the login page, and back to the same page afterwards. */
export function useRequireLogin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback(
    (message) => {
      if (user) return true;
      toast(message);
      navigate('/login', { state: { from: location.pathname + location.search } });
      return false;
    },
    [user, navigate, location],
  );
}

export function useCart() {
  const { user } = useAuth();
  return useQuery({ queryKey: ['cart'], queryFn: cartApi.get, enabled: Boolean(user) });
}

/** Wraps a cart API call so that the cached cart updates and errors show as toasts. */
export function useCartMutation(mutationFn, { success, onSuccess, quietErrors = false } = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (cart, variables) => {
      queryClient.setQueryData(['cart'], cart);
      if (success) toast.success(typeof success === 'function' ? success(variables) : success);
      onSuccess?.(cart, variables);
    },
    onError: (error) => {
      if (!quietErrors) toast.error(error.message);
    },
  });
}

export function useAddToCart() {
  const requireLogin = useRequireLogin();
  const [addedId, setAddedId] = useState(null);
  const mutation = useCartMutation(({ product, qty }) => cartApi.add(product._id, qty), {
    success: ({ product }) => `Added ${product.name} to your cart`,
    onSuccess: (_cart, { product }) => setAddedId(product._id),
  });

  // The button shows a tick for a moment after adding.
  useEffect(() => {
    if (!addedId) return undefined;
    const timer = setTimeout(() => setAddedId(null), 1400);
    return () => clearTimeout(timer);
  }, [addedId]);

  return {
    addedId,
    add: (product, qty = 1) => {
      if (requireLogin('Log in to add items to your cart.')) mutation.mutate({ product, qty });
    },
    isPending: mutation.isPending,
    pendingId: mutation.isPending ? mutation.variables?.product._id : null,
  };
}

/** Reports the result of adding a kit or setup: what went in, and what could not. */
export function announceBulkAdd({ added, skipped }) {
  if (added.length > 0) toast.success(`Added ${added.length} item${added.length === 1 ? '' : 's'} to your cart`);
  for (const item of skipped) toast.error(`${item.name}: ${item.reason}`);
  if (added.length === 0 && skipped.length === 0) toast('Nothing to add.');
}

export function useWishlist() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const requireLogin = useRequireLogin();
  const query = useQuery({ queryKey: ['wishlist'], queryFn: wishlistApi.get, enabled: Boolean(user) });
  const items = query.data ?? [];

  const mutation = useMutation({
    mutationFn: ({ product, saved }) =>
      saved ? wishlistApi.remove(product._id) : wishlistApi.add(product._id),
    onSuccess: (list, { product, saved }) => {
      queryClient.setQueryData(['wishlist'], list);
      toast.success(saved ? `Removed ${product.name} from your wishlist` : `Saved ${product.name} to your wishlist`);
    },
    onError: (error) => toast.error(error.message),
  });

  const has = (id) => items.some((item) => item._id === id);
  return {
    ...query,
    items,
    has,
    toggle: (product) => {
      if (requireLogin('Log in to save items to your wishlist.')) {
        mutation.mutate({ product, saved: has(product._id) });
      }
    },
  };
}
