import { User } from '../models/index.js';
import { verifyToken } from '../services/auth.service.js';
import { ApiError } from '../utils/ApiError.js';

function readToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

/** Requires a valid token from an active user, and sets req.user. */
export async function auth(req, res, next) {
  const token = readToken(req);
  if (!token) throw ApiError.unauthorized();

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw ApiError.unauthorized('Your session has expired. Please log in again.');
  }

  const user = await User.findById(payload.sub);
  if (!user) throw ApiError.unauthorized('Your session has expired. Please log in again.');
  if (!user.isActive) throw ApiError.forbidden('This account has been deactivated.');

  req.user = user;
  next();
}

/** Sets req.user when a valid token is present, but never blocks the request. */
export async function optionalAuth(req, res, next) {
  const token = readToken(req);
  if (token) {
    try {
      const user = await User.findById(verifyToken(token).sub);
      if (user?.isActive) req.user = user;
    } catch {
      // A bad token on a public route is treated the same as no token.
    }
  }
  next();
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') throw ApiError.forbidden();
  next();
}
