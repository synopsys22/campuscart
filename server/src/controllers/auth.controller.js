import { User } from '../models/index.js';
import { hashPassword, signToken, verifyPassword } from '../services/auth.service.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/http.js';

const session = (user) => ({ token: signToken(user), user });

export async function register(req, res) {
  const { password, ...fields } = req.validated.body;
  if (await User.exists({ email: fields.email })) {
    throw ApiError.conflict('An account with that email already exists.');
  }
  const user = await User.create({ ...fields, passwordHash: await hashPassword(password) });
  ok(res, session(user), { status: 201 });
}

export async function login(req, res) {
  const { email, password } = req.validated.body;
  const user = await User.findOne({ email });
  // The same message for both cases, so the form doesn't reveal which emails exist.
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw ApiError.unauthorized('Incorrect email or password.');
  }
  if (!user.isActive) throw ApiError.forbidden('This account has been deactivated.');
  ok(res, session(user));
}

// Tokens are held by the client, so logging out just means the client discards its token.
export function logout(req, res) {
  ok(res, { loggedOut: true });
}

export function me(req, res) {
  ok(res, req.user);
}
