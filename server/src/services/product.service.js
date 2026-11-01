import { Category } from '../models/index.js';
import { escapeRegex } from '../utils/http.js';

function csv(value) {
  return value.split(',').map((part) => part.trim()).filter(Boolean);
}

/** Every word must match the name, brand or tags. Regex allows partial words like "rasp". */
export function searchFilter(text) {
  const terms = text.split(/\s+/).filter(Boolean);
  return terms.map((term) => {
    const pattern = new RegExp(escapeRegex(term), 'i');
    return { $or: [{ name: pattern }, { brand: pattern }, { tags: pattern }, { sku: pattern }] };
  });
}

/** Builds the MongoDB filter from validated catalog query values. */
export async function buildProductFilter(query, { isAdmin = false } = {}) {
  const filter = {};
  const conditions = [];

  if (!(isAdmin && query.includeInactive)) filter.isActive = true;
  if (query.q) conditions.push(...searchFilter(query.q));

  if (query.category) {
    const categories = await Category.find({ slug: { $in: csv(query.category) } }).select('_id');
    filter.category = { $in: categories.map((category) => category._id) };
  }
  if (query.brand) filter.brand = { $in: csv(query.brand) };
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    filter.price = {
      ...(query.minPrice !== undefined && { $gte: query.minPrice }),
      ...(query.maxPrice !== undefined && { $lte: query.maxPrice }),
    };
  }
  if (query.rating !== undefined) filter.ratingAvg = { $gte: query.rating };
  if (query.inStock) filter.stock = { $gt: 0 };
  if (query.semester) filter.semesters = query.semester;
  if (isAdmin && query.lowStock) {
    conditions.push({ $expr: { $lte: ['$stock', '$lowStockThreshold'] } });
  }
  if (conditions.length > 0) filter.$and = conditions;
  return filter;
}
