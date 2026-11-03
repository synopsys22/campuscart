import axios from 'axios';

const TOKEN_KEY = 'campuscart-token';

export const tokenStore = {
  get() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      // Without storage, the session simply ends when the page reloads.
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // Nothing to clear.
    }
  },
};

const http = axios.create({ baseURL: '/api' });

const DEACTIVATED_MESSAGE = 'This account has been deactivated.';
const sessionEvents = new EventTarget();

/** Calls the listener when the server stops accepting this session. Returns an unsubscribe function. */
export function onSessionEnded(listener) {
  sessionEvents.addEventListener('ended', listener);
  return () => sessionEvents.removeEventListener('ended', listener);
}

/** Ends the session once if a request shows that the token no longer works. */
function detectEndedSession(error) {
  const { response, config } = error;
  if (!response || !tokenStore.get() || config?.url?.startsWith('/auth/')) return;
  const rejected =
    response.status === 401 ||
    (response.status === 403 && response.data?.message === DEACTIVATED_MESSAGE);
  if (rejected) {
    tokenStore.clear();
    sessionEvents.dispatchEvent(new Event('ended'));
  }
}

http.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** Gives every failed request one readable message, plus any per-field errors. */
http.interceptors.response.use(
  (response) => response,
  (error) => {
    const { response } = error;
    if (!response) {
      error.message = "Can't reach the server. Check that CampusCart is running.";
    } else {
      error.message = response.data?.message || 'Something went wrong. Please try again.';
      error.fieldErrors = response.data?.errors;
      error.status = response.status;
    }
    detectEndedSession(error);
    return Promise.reject(error);
  },
);

const data = (request) => request.then((response) => response.data.data);
const paged = (request) =>
  request.then((response) => ({
    items: response.data.data,
    meta: response.data.meta,
    summary: response.data.summary,
  }));

/** Removes empty values so they don't appear as blank query parameters. */
function clean(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  );
}

const get = (url, params) => http.get(url, { params: clean(params) });

export const authApi = {
  login: (body) => data(http.post('/auth/login', body)),
  register: (body) => data(http.post('/auth/register', body)),
  logout: () => data(http.post('/auth/logout')),
  me: () => data(http.get('/auth/me')),
};

export const profileApi = {
  update: (body) => data(http.patch('/users/me', body)),
  changePassword: (body) => data(http.patch('/users/me/password', body)),
  addAddress: (body) => data(http.post('/users/me/addresses', body)),
  updateAddress: (id, body) => data(http.patch(`/users/me/addresses/${id}`, body)),
  deleteAddress: (id) => data(http.delete(`/users/me/addresses/${id}`)),
};

export const productApi = {
  list: (params) => paged(get('/products', params)),
  filters: () => data(http.get('/products/filters')),
  suggest: (q) => data(get('/products/suggest', { q })),
  compare: (ids) => data(get('/products/compare', { ids: ids.join(',') })),
  get: (slug) => data(http.get(`/products/${encodeURIComponent(slug)}`)),
  related: (slug) => data(http.get(`/products/${encodeURIComponent(slug)}/related`)),
  create: (body) => data(http.post('/products', body)),
  update: (id, body) => data(http.patch(`/products/${id}`, body)),
  remove: (id) => data(http.delete(`/products/${id}`)),
  setStock: (id, stock) => data(http.patch(`/products/${id}/stock`, { stock })),
};

export const categoryApi = {
  list: (params) => data(get('/categories', params)),
  create: (body) => data(http.post('/categories', body)),
  update: (id, body) => data(http.patch(`/categories/${id}`, body)),
  remove: (id) => data(http.delete(`/categories/${id}`)),
};

export const cartApi = {
  get: () => data(http.get('/cart')),
  add: (productId, qty = 1) => data(http.post('/cart/items', { productId, qty })),
  setQty: (productId, qty) => data(http.patch(`/cart/items/${productId}`, { qty })),
  remove: (productId) => data(http.delete(`/cart/items/${productId}`)),
  clear: () => data(http.delete('/cart')),
  applyCoupon: (code) => data(http.post('/cart/coupon', { code })),
  removeCoupon: () => data(http.delete('/cart/coupon')),
};

export const wishlistApi = {
  get: () => data(http.get('/wishlist')),
  add: (productId) => data(http.post(`/wishlist/${productId}`)),
  remove: (productId) => data(http.delete(`/wishlist/${productId}`)),
};

export const orderApi = {
  place: (body) => data(http.post('/orders', body)),
  mine: (params) => paged(get('/orders/my', params)),
  get: (id) => data(http.get(`/orders/${id}`)),
  cancel: (id, reason) => data(http.post(`/orders/${id}/cancel`, { reason })),
  requestReturn: (id, body) => data(http.post(`/orders/${id}/return`, body)),
  listAll: (params) => paged(get('/orders', params)),
  setStatus: (id, body) => data(http.patch(`/orders/${id}/status`, body)),
  decideReturn: (id, body) => data(http.patch(`/orders/${id}/return`, body)),
};

export const deliveryApi = {
  options: () => data(http.get('/delivery/options')),
  estimate: (pincode) => data(get('/delivery/estimate', { pincode })),
  track: (trackingNumber) => data(http.get(`/track/${encodeURIComponent(trackingNumber)}`)),
};

export const paymentApi = {
  testDetails: () => data(http.get('/payments/test-details')),
  create: (body) => data(http.post('/payments', body)),
  get: (id) => data(http.get(`/payments/${id}`)),
  card: (id, body) => data(http.post(`/payments/${id}/card`, body)),
  otp: (id, otp) => data(http.post(`/payments/${id}/otp`, { otp })),
  upi: (id, upiId) => data(http.post(`/payments/${id}/upi`, { upiId })),
  cancel: (id) => data(http.post(`/payments/${id}/cancel`)),
  approval: (id, token) => data(get(`/payments/${id}/approval`, { token })),
  approve: (id, token) => data(http.post(`/payments/${id}/approve`, { token })),
  listAll: (params) => paged(get('/admin/payments', params)),
  walletActivity: (params) => paged(get('/admin/wallet-transactions', params)),
};

export const walletApi = {
  get: (params) => paged(get('/wallet', params)),
};

export const reviewApi = {
  forProduct: (productId, params) => paged(get(`/products/${productId}/reviews`, params)),
  eligibility: (productId) => data(http.get(`/products/${productId}/reviews/eligibility`)),
  create: (productId, body) => data(http.post(`/products/${productId}/reviews`, body)),
  update: (id, body) => data(http.patch(`/reviews/${id}`, body)),
  remove: (id) => data(http.delete(`/reviews/${id}`)),
  mine: () => data(http.get('/reviews/my')),
  listAll: (params) => paged(get('/reviews', params)),
};

export const kitApi = {
  list: (params) => data(get('/kits', params)),
  get: (slug) => data(http.get(`/kits/${encodeURIComponent(slug)}`)),
  addToCart: (id) => data(http.post(`/kits/${id}/add-to-cart`)),
  create: (body) => data(http.post('/kits', body)),
  update: (id, body) => data(http.patch(`/kits/${id}`, body)),
  remove: (id) => data(http.delete(`/kits/${id}`)),
};

export const setupApi = {
  slots: () => data(http.get('/setups/slots')),
  mine: () => data(http.get('/setups')),
  create: (body) => data(http.post('/setups', body)),
  update: (id, body) => data(http.patch(`/setups/${id}`, body)),
  remove: (id) => data(http.delete(`/setups/${id}`)),
  addToCart: (id) => data(http.post(`/setups/${id}/add-to-cart`)),
};

export const couponApi = {
  available: () => data(http.get('/coupons/available')),
  list: () => data(http.get('/coupons')),
  create: (body) => data(http.post('/coupons', body)),
  update: (id, body) => data(http.patch(`/coupons/${id}`, body)),
  remove: (id) => data(http.delete(`/coupons/${id}`)),
};

export const userApi = {
  list: (params) => paged(get('/users', params)),
  get: (id) => data(http.get(`/users/${id}`)),
  update: (id, body) => data(http.patch(`/users/${id}`, body)),
};

export const analyticsApi = {
  summary: () => data(http.get('/admin/analytics/summary')),
  revenue: (range) => data(get('/admin/analytics/revenue', { range })),
  categorySales: () => data(http.get('/admin/analytics/category-sales')),
  topProducts: () => data(http.get('/admin/analytics/top-products')),
  orderStatus: () => data(http.get('/admin/analytics/order-status')),
  lowStock: () => data(http.get('/admin/analytics/low-stock')),
};

export function uploadImage(file) {
  const form = new FormData();
  form.append('image', file);
  return data(http.post('/uploads', form));
}
