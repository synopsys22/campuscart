import { Category, Product } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { ok, uniqueSlug } from '../utils/http.js';

export async function listCategories(req, res) {
  const filter = req.user?.role === 'admin' && req.query.includeInactive === 'true' ? {} : { isActive: true };
  ok(res, await Category.find(filter).sort({ sortOrder: 1, name: 1 }));
}

export async function createCategory(req, res) {
  const body = req.validated.body;
  const category = await Category.create({ ...body, slug: await uniqueSlug(Category, body.name) });
  ok(res, category, { status: 201 });
}

async function requireCategory(id) {
  const category = await Category.findById(id);
  if (!category) throw ApiError.notFound('That category was not found.');
  return category;
}

export async function updateCategory(req, res) {
  const category = await requireCategory(req.validated.params.id);
  category.set(req.validated.body);
  await category.save();
  ok(res, category);
}

export async function deleteCategory(req, res) {
  const category = await requireCategory(req.validated.params.id);
  const productCount = await Product.countDocuments({ category: category._id });
  if (productCount > 0) {
    throw ApiError.conflict(
      `This category still has ${productCount} product${productCount === 1 ? '' : 's'}. Move or remove them first.`,
    );
  }
  await category.deleteOne();
  ok(res, { deleted: true });
}
