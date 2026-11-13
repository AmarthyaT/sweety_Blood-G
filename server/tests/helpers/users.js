import request from 'supertest';
import { randomUUID } from 'node:crypto';

/** Register a user through the real API and return its credentials + token. */
export async function registerUser(app, overrides = {}) {
  const email = overrides.email ?? `user-${randomUUID()}@example.com`;
  const password = overrides.password ?? 'Password123!';

  const response = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Test Patient', email, password, ...overrides });

  return {
    ...response.body,
    email,
    password,
    status: response.status,
    response,
  };
}

export function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}
