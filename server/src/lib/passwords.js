import bcrypt from 'bcrypt';
import env from '../config/env.js';

/** Hash a plain-text password with bcrypt. Never store the input itself. */
export function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, env.bcryptRounds);
}

/** Compare a plain-text password against a bcrypt hash. */
export function verifyPassword(plainPassword, passwordHash) {
  return bcrypt.compare(plainPassword, passwordHash);
}

export default { hashPassword, verifyPassword };
