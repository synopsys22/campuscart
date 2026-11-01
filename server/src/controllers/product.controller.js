import { Category, Product } from '../models/index.js';
import { buildProductFilter, searchFilter } from '../services/product.service.js';
import { ApiError } from '../utils/ApiError.js';
import { ok, paginate, uniqueSlug } from '../utils/http.js';
import { PRODUCT_SORTS } from '../validators/catalog.validators.js';

const CATEGORY_FIELDS = 'name slug icon';
const isAdmin = (req) => req.user?.role === 'admin';

export async function listProducts(req, res) {
  const { page, limit, sort } = req.validated.query;
  const { skip, meta } = paginate({ page, limit });
  const filter = await buildProductFilter(req.validated.query, { isAdmin: isAdmin(req) });
  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate('category', CATEGORY_FIELDS)
      .sort(PRODUCT_SORTS[sort])
      .skip(skip)
      .limit(limit),
    Product.countDocuments(filter),
  ]);
  ok(res, products, { meta: meta(total) });
}

export async function filterOptions(req, res) {
  const active = { isActive: true };
  const [brands, semesters, [price], counts, categories] = await Promise.all([
    Product.distinct('brand', active),
    Product.distinct('semesters', active),
    Product.aggregate([
      { $match: active },
      { $group: { _id: null, min: { $min: '$price' }, max: { $max: '$price' } } },
      { $project: { _id: 0 } },
    ]),
    Product.aggregate([
      { $match: active },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]),
    Category.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }),
  ]);

  const countByCategory = new Map(counts.map((row) => [row._id.toString(), row.count]));
  ok(res, {
    brands: brands.sort((a, b) => a.localeCompare(b)),
    semesters: semesters.sort((a, b) => a - b),
    price: price ?? { min: 0, max: 0 },
    categories: categories.map((category) => ({
      _id: category._id,
      name: category.name,
      slug: category.slug,
      icon: category.icon,
      count: countByCategory.get(category._id.toString()) ?? 0,
    })),
  });
}

export async function suggestProducts(req, res) {
  const { q } = req.validated.query;
  if (!q) {
    ok(res, []);
    return;
  }
  const products = await Product.find({ isActive: true, $and: searchFilter(q) })
    .select('name slug brand price images')
    .sort({ soldCount: -1, _id: 1 })
    .limit(6);
  ok(res, products);
}

export async function compareProducts(req, res) {
  const { ids } = req.validated.query;
  const products = await Product.find({ _id: { $in: ids }, isActive: true }).populate(
    'category',
    CATEGORY_FIELDS,
  );
  const byId = new Map(products.map((product) => [product._id.toString(), product]));
  ok(res, ids.map((id) => byId.get(id)).filter(Boolean));
}

async function findBySlug(req) {
  const filter = { slug: req.params.slug };
  if (!isAdmin(req)) filter.isActive = true;
  const product = await Product.findOne(filter).populate('category', CATEGORY_FIELDS);
  if (!product) throw ApiError.notFound('That product was not found.');
  return product;
}

export async function getProduct(req, res) {
  ok(res, await findBySlug(req));
}

export async function relatedProducts(req, res) {
  const product = await findBySlug(req);
  const related = await Product.find({
    category: product.category._id,
    isActive: true,
    _id: { $ne: product._id },
  })
    .populate('category', CATEGORY_FIELDS)
    .sort({ soldCount: -1, _id: 1 })
    .limit(4);
  ok(res, related);
}

async function assertCategoryExists(categoryId) {
  if (!(await Category.exists({ _id: categoryId }))) {
    throw ApiError.badRequest('Please check the highlighted fields.', {
      category: 'That category does not exist.',
    });
  }
}

function assertPriceWithinMrp(price, mrp) {
  if (price > mrp) {
    throw ApiError.badRequest('Please check the highlighted fields.', {
      price: 'The selling price cannot be above the MRP.',
    });
  }
}

export async function createProduct(req, res) {
  const body = req.validated.body;
  assertPriceWithinMrp(body.price, body.mrp);
  await assertCategoryExists(body.category);
  const product = await Product.create({ ...body, slug: await uniqueSlug(Product, body.name) });
  ok(res, product, { status: 201 });
}

async function requireProduct(id) {
  const product = await Product.findById(id);
  if (!product) throw ApiError.notFound('That product was not found.');
  return product;
}

export async function updateProduct(req, res) {
  const product = await requireProduct(req.validated.params.id);
  const body = req.validated.body;
  assertPriceWithinMrp(body.price ?? product.price, body.mrp ?? product.mrp);
  if (body.category) await assertCategoryExists(body.category);
  product.set(body);
  await product.save();
  ok(res, product);
}

// A soft delete: the product disappears from the store, but past orders stay intact.
export async function deleteProduct(req, res) {
  const product = await requireProduct(req.validated.params.id);
  product.isActive = false;
  await product.save();
  ok(res, { deleted: true });
}

export async function updateStock(req, res) {
  const product = await requireProduct(req.validated.params.id);
  product.stock = req.validated.body.stock;
  await product.save();
  ok(res, product);
}
