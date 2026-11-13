import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import AuthShell from '../components/AuthShell.jsx';
import Icon from '../components/Icon.jsx';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={user.role === 'doctor' ? '/patients' : '/'} replace />;

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    if (error) setError('');
  }

  function validate() {
    if (!form.name.trim()) return 'Please enter your name.';
    if (form.name.trim().length < 2) return 'Name must be at least 2 characters.';
    if (!EMAIL_PATTERN.test(form.email.trim())) return 'Please enter a valid email address.';
    if (form.password.length < 8) return 'Password must be at least 8 characters.';
    if (form.password !== form.confirm) return 'Passwords do not match.';
    return '';
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const message = validate();
    if (message) {
      setError(message);
      return;
    }

    setBusy(true);
    setError('');

    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      navigate('/', { replace: true });
    } catch (registerError) {
      setError(registerError.message);
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <div className="auth-form-head">
        <span className="eyebrow">Start simple</span>
        <h2>Create your account</h2>
        <p>Four readings a day is enough to see a pattern. We will keep them organised.</p>
      </div>

      {error && (
        <p className="form-error" role="alert">
          <Icon name="alert" size={16} />
          {error}
        </p>
      )}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="register-name">Full name</label>
          <div className="input-with-icon">
            <Icon name="user" size={17} />
            <input
              id="register-name"
              type="text"
              autoComplete="name"
              placeholder="Asha Verma"
              value={form.name}
              onChange={(event) => update('name', event.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="register-email">Email address</label>
          <div className="input-with-icon">
            <Icon name="mail" size={17} />
            <input
              id="register-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={(event) => update('email', event.target.value)}
            />
          </div>
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="register-password">Password</label>
            <div className="input-with-icon">
              <Icon name="lock" size={17} />
              <input
                id="register-password"
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={form.password}
                onChange={(event) => update('password', event.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="register-confirm">Confirm password</label>
            <div className="input-with-icon">
              <Icon name="lock" size={17} />
              <input
                id="register-confirm"
                type="password"
                autoComplete="new-password"
                placeholder="Repeat password"
                value={form.confirm}
                onChange={(event) => update('confirm', event.target.value)}
              />
            </div>
          </div>
        </div>

        <button type="submit" className="button button-primary button-block" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
          {!busy && <Icon name="arrowRight" size={17} />}
        </button>
      </form>

      <p className="auth-switch">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </AuthShell>
  );
}
