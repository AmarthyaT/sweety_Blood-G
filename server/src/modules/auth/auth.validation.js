import ApiError from '../../lib/ApiError.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validationError(message, field) {
  return ApiError.badRequest(message, 'validation_error', { field });
}

function trimmed(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function validateRegisterInput(body = {}) {
  const name = trimmed(body.name);
  const email = trimmed(body.email).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';

  if (name.length === 0) throw validationError('Please enter your name.', 'name');
  if (name.length < 2) throw validationError('Name must be at least 2 characters.', 'name');
  if (name.length > 80) throw validationError('Name must be 80 characters or fewer.', 'name');

  if (email.length === 0) throw validationError('Please enter your email address.', 'email');
  if (!EMAIL_PATTERN.test(email)) throw validationError('Please enter a valid email address.', 'email');

  if (password.length === 0) throw validationError('Please enter a password.', 'password');
  if (password.length < 8) throw validationError('Password must be at least 8 characters.', 'password');
  if (password.length > 72) throw validationError('Password must be 72 characters or fewer.', 'password');

  return { name, email, password };
}

export function validateLoginInput(body = {}) {
  const email = trimmed(body.email).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';

  if (email.length === 0) throw validationError('Please enter your email address.', 'email');
  if (!EMAIL_PATTERN.test(email)) throw validationError('Please enter a valid email address.', 'email');
  if (password.length === 0) throw validationError('Please enter your password.', 'password');

  return { email, password };
}
