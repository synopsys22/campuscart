import { Order, User } from '../models/index.js';
import { hashPassword, verifyPassword } from '../services/auth.service.js';
import { ApiError } from '../utils/ApiError.js';
import { escapeRegex, ok, paginate } from '../utils/http.js';

export async function updateProfile(req, res) {
  req.user.set(req.validated.body);
  await req.user.save();
  ok(res, req.user);
}

export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.validated.body;
  if (!(await verifyPassword(currentPassword, req.user.passwordHash))) {
    throw ApiError.badRequest('Your current password is incorrect.', {
      currentPassword: 'Your current password is incorrect.',
    });
  }
  req.user.passwordHash = await hashPassword(newPassword);
  await req.user.save();
  ok(res, { changed: true });
}

function makeOnlyDefault(addresses, chosen) {
  for (const address of addresses) address.isDefault = address._id.equals(chosen._id);
}

export async function addAddress(req, res) {
  const { addresses } = req.user;
  const wantsDefault = req.body.isDefault === true || addresses.length === 0;
  addresses.push(req.validated.body);
  const created = addresses[addresses.length - 1];
  if (wantsDefault) makeOnlyDefault(addresses, created);
  await req.user.save();
  ok(res, addresses, { status: 201 });
}

export async function updateAddress(req, res) {
  const { addresses } = req.user;
  const address = addresses.id(req.validated.params.id);
  if (!address) throw ApiError.notFound('That address was not found.');
  address.set(req.validated.body);
  if (req.body.isDefault === true) makeOnlyDefault(addresses, address);
  await req.user.save();
  ok(res, addresses);
}

export async function deleteAddress(req, res) {
  const { addresses } = req.user;
  const address = addresses.id(req.validated.params.id);
  if (!address) throw ApiError.notFound('That address was not found.');
  const wasDefault = address.isDefault;
  address.deleteOne();
  if (wasDefault && addresses.length > 0) addresses[0].isDefault = true;
  await req.user.save();
  ok(res, addresses);
}

export async function listUsers(req, res) {
  const { search, role, ...pageQuery } = req.validated.query;
  const { skip, limit, meta } = paginate(pageQuery);
  const filter = {};
  if (role) filter.role = role;
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: pattern }, { email: pattern }, { college: pattern }];
  }
  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1, _id: 1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);
  ok(res, users, { meta: meta(total) });
}

export async function getUser(req, res) {
  const user = await User.findById(req.validated.params.id);
  if (!user) throw ApiError.notFound('User not found.');
  const orders = await Order.find({ user: user._id })
    .sort({ createdAt: -1 })
    .limit(5)
    .select('orderNumber status total createdAt');
  const orderCount = await Order.countDocuments({ user: user._id });
  ok(res, { ...user.toJSON(), orders, orderCount });
}

export async function adminUpdateUser(req, res) {
  const user = await User.findById(req.validated.params.id);
  if (!user) throw ApiError.notFound('User not found.');
  const { role, isActive } = req.validated.body;

  if (user._id.equals(req.user._id)) {
    if (role && role !== 'admin') throw ApiError.badRequest('You cannot remove your own admin role.');
    if (isActive === false) throw ApiError.badRequest('You cannot deactivate your own account.');
  }

  if (role) user.role = role;
  if (isActive !== undefined) user.isActive = isActive;
  await user.save();
  ok(res, user);
}
