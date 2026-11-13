import jwt from 'jsonwebtoken';
import env from '../../config/env.js';
import ApiError from '../../lib/ApiError.js';
import { query } from '../../db/pool.js';
import { hashPassword, verifyPassword } from '../../lib/passwords.js';
import { validateLoginInput, validateRegisterInput } from './auth.validation.js';

// A real bcrypt hash used only to keep the unknown-email and wrong-password
// paths roughly the same speed, so login timing does not reveal accounts.
const DUMMY_PASSWORD_HASH = '$2b$10$qnAqir4whjD54IOWtN73xeKOIw11JpoGCgwvwZmtZMlLaaceW.tBS';

/** Never return the password hash to a client. */
export function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

function signToken(user) {
  return jwt.sign({ role: user.role }, env.jwtSecret, {
    subject: user.id,
    expiresIn: env.jwtExpiresIn,
  });
}

export async function registerUser(body) {
  const { name, email, password } = validateRegisterInput(body);
  const passwordHash = await hashPassword(password);

  try {
    const { rows } = await query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'patient')
       RETURNING id, name, email, role`,
      [name, email, passwordHash],
    );

    const user = rows[0];
    return { user: publicUser(user), token: signToken(user) };
  } catch (error) {
    if (error.code === '23505') {
      throw ApiError.conflict('An account with this email already exists.', 'email_taken');
    }
    throw error;
  }
}

export async function loginUser(body) {
  const { email, password } = validateLoginInput(body);

  const { rows } = await query(
    'SELECT id, name, email, role, password_hash FROM users WHERE LOWER(email) = $1',
    [email],
  );

  const user = rows[0];
  const passwordMatches = await verifyPassword(password, user?.password_hash ?? DUMMY_PASSWORD_HASH);

  // Same error for unknown email and wrong password (no account enumeration).
  if (!user || !passwordMatches) {
    throw ApiError.unauthorized('Invalid email or password.', 'invalid_credentials');
  }

  return { user: publicUser(user), token: signToken(user) };
}

export async function findUserById(id) {
  const { rows } = await query(
    'SELECT id, name, email, role FROM users WHERE id = $1',
    [id],
  );
  return rows[0] ?? null;
}
