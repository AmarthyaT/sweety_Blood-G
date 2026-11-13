import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import ApiError from '../lib/ApiError.js';
import { query } from '../db/pool.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * Verify `Authorization: Bearer <jwt>`, load the current user from the
 * database (so role changes take effect immediately) and attach it to
 * `req.user`.
 */
export const requireAuth = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw ApiError.unauthorized('Please log in to continue.', 'missing_token');
  }

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
  } catch {
    throw ApiError.unauthorized('Your session has expired. Please log in again.', 'invalid_token');
  }

  const { rows } = await query(
    'SELECT id, name, email, role FROM users WHERE id = $1',
    [payload.sub],
  );

  if (!rows[0]) {
    throw ApiError.unauthorized('Your session has expired. Please log in again.', 'invalid_token');
  }

  req.user = rows[0];
  next();
});

/** Allow only the given roles, e.g. requireRole('doctor'). */
export function requireRole(...roles) {
  return function roleGuard(req, _res, next) {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden('You do not have permission to access this resource.'));
    }
    return next();
  };
}
