/** Sends the API's standard success response. */
export function ok(res, data, { meta, status = 200, ...extra } = {}) {
  res.status(status).json({ success: true, data, ...(meta && { meta }), ...extra });
}

export const DEFAULT_PAGE_SIZE = 12;
export const MAX_PAGE_SIZE = 100;

/** Turns page and limit into skip values, plus the metadata sent back to the client. */
export function paginate({ page = 1, limit = DEFAULT_PAGE_SIZE }) {
  return {
    page,
    limit,
    skip: (page - 1) * limit,
    meta: (total) => ({ page, limit, total, pages: Math.ceil(total / limit) }),
  };
}

/** Escapes user text so it is matched literally inside a regular expression. */
export function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Returns a slug not yet used in the model: "name", then "name-2", "name-3" and so on. */
export async function uniqueSlug(Model, text) {
  const base = slugify(text) || 'item';
  let candidate = base;
  let suffix = 2;
  while (await Model.exists({ slug: candidate })) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

export const formatINR = (amount) => `₹${amount.toLocaleString('en-IN')}`;
