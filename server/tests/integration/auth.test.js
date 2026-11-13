import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { pool } from '../../src/db/pool.js';
import { verifyPassword } from '../../src/lib/passwords.js';
import { authHeader, registerUser } from '../helpers/users.js';
import { resetDatabase, setupDatabase, teardownDatabase } from '../helpers/db.js';

const app = createApp();

beforeAll(setupDatabase);
beforeEach(resetDatabase);
afterAll(teardownDatabase);

describe('POST /api/auth/register', () => {
  it('creates a patient and returns a token without the password hash', async () => {
    const result = await registerUser(app, {
      name: 'Asha Verma',
      email: 'Asha@Example.com',
    });

    expect(result.status).toBe(201);
    expect(result.token).toEqual(expect.any(String));
    expect(result.user).toMatchObject({
      name: 'Asha Verma',
      email: 'asha@example.com',
      role: 'patient',
    });
    expect(result.user).not.toHaveProperty('password_hash');
    expect(result.response.body.user).not.toHaveProperty('password');
  });

  it('stores a bcrypt hash, never the plain password', async () => {
    const result = await registerUser(app, { password: 'SuperSecret9!' });
    const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [
      result.user.id,
    ]);

    expect(rows[0].password_hash).not.toBe('SuperSecret9!');
    expect(rows[0].password_hash.startsWith('$2')).toBe(true);
    await expect(verifyPassword('SuperSecret9!', rows[0].password_hash)).resolves.toBe(true);
  });

  it('ignores a role supplied at registration', async () => {
    const response = await request(app).post('/api/auth/register').send({
      name: 'Sneaky Doctor',
      email: 'sneaky@example.com',
      password: 'Password123!',
      role: 'doctor',
    });

    expect(response.status).toBe(201);
    expect(response.body.user.role).toBe('patient');

    const { rows } = await pool.query('SELECT role FROM users WHERE email = $1', [
      'sneaky@example.com',
    ]);
    expect(rows[0].role).toBe('patient');
  });

  it('rejects a duplicate email regardless of casing', async () => {
    const first = await registerUser(app, { email: 'patient@example.com' });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Someone Else', email: 'PATIENT@example.com', password: 'Password123!' });

    expect(second.status).toBe(409);
    expect(second.body.message).toBe('An account with this email already exists.');
    expect(second.body.code).toBe('email_taken');
  });

  it('validates name, email and password', async () => {
    const missingName = await request(app)
      .post('/api/auth/register')
      .send({ name: ' ', email: 'a@b.com', password: 'Password123!' });
    expect(missingName.status).toBe(400);
    expect(missingName.body.message).toBe('Please enter your name.');

    const badEmail = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Asha', email: 'not-an-email', password: 'Password123!' });
    expect(badEmail.status).toBe(400);
    expect(badEmail.body.message).toBe('Please enter a valid email address.');

    const shortPassword = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Asha', email: 'a@b.com', password: 'short' });
    expect(shortPassword.status).toBe(400);
    expect(shortPassword.body.message).toBe('Password must be at least 8 characters.');
  });
});

describe('POST /api/auth/login', () => {
  it('logs in with valid credentials', async () => {
    const registered = await registerUser(app, { email: 'login@example.com' });

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'LOGIN@example.com', password: registered.password });

    expect(response.status).toBe(200);
    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body.user.email).toBe('login@example.com');
  });

  it('returns the same error for a wrong password and an unknown email', async () => {
    const registered = await registerUser(app, { email: 'wrong@example.com' });

    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: registered.email, password: 'NotThePassword1!' });
    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.body.message).toBe('Invalid email or password.');

    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'Password123!' });
    expect(unknownEmail.status).toBe(401);
    expect(unknownEmail.body.message).toBe('Invalid email or password.');
  });

  it('accepts a differently cased email', async () => {
    const registered = await registerUser(app, { email: 'casing@example.com' });

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'CASING@Example.com', password: 'Password123!' });

    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe(registered.email);
  });
});

describe('GET /api/auth/me', () => {
  it('returns the logged-in user', async () => {
    const registered = await registerUser(app);
    const response = await request(app)
      .get('/api/auth/me')
      .set(authHeader(registered.token));

    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe(registered.email);
  });

  it('rejects missing and invalid tokens', async () => {
    const missing = await request(app).get('/api/auth/me');
    expect(missing.status).toBe(401);
    expect(missing.body.message).toBe('Please log in to continue.');

    const invalid = await request(app)
      .get('/api/auth/me')
      .set(authHeader('definitely-not-a-token'));
    expect(invalid.status).toBe(401);
    expect(invalid.body.message).toBe('Your session has expired. Please log in again.');
  });
});
