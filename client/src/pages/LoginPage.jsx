import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import AuthShell from '../components/AuthShell.jsx';
import Icon from '../components/Icon.jsx';

const DEMO_PATIENT = { email: 'demo@sweety.app', password: 'Demo1234!' };
const DEMO_DOCTOR = { email: 'doctor@sweety.app', password: 'Doctor1234!' };

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) {
    return <Navigate to={user.role === 'doctor' ? '/patients' : '/'} replace />;
  }

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    if (error) setError('');
  }

  async function signIn(credentials) {
    setBusy(true);
    setError('');
    try {
      const loggedIn = await login(credentials);
      navigate(loggedIn.role === 'doctor' ? '/patients' : '/', { replace: true });
    } catch (loginError) {
      setError(loginError.message);
      setBusy(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!form.email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (!form.password) {
      setError('Please enter your password.');
      return;
    }
    signIn(form);
  }

  return (
    <AuthShell>
      <div className="auth-form-head">
        <span className="eyebrow">Welcome back</span>
        <h2>Log in to Sweety</h2>
        <p>Pick up where you left off and keep your readings in one calm place.</p>
      </div>

      {error && (
        <p className="form-error" role="alert">
          <Icon name="alert" size={16} />
          {error}
        </p>
      )}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="login-email">Email address</label>
          <div className="input-with-icon">
            <Icon name="mail" size={17} />
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={(event) => update('email', event.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="login-password">Password</label>
          <div className="input-with-icon">
            <Icon name="lock" size={17} />
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              placeholder="Your password"
              value={form.password}
              onChange={(event) => update('password', event.target.value)}
            />
          </div>
        </div>

        <button type="submit" className="button button-primary button-block" disabled={busy}>
          {busy ? 'Logging in…' : 'Log in'}
          {!busy && <Icon name="arrowRight" size={17} />}
        </button>
      </form>

      <div className="demo-box">
        <div className="demo-box-head">
          <span>
            <Icon name="sparkle" size={15} /> Try the demo
          </span>
          <small>Seeded accounts</small>
        </div>
        <div className="demo-actions">
          <button
            type="button"
            className="button button-soft button-small"
            disabled={busy}
            onClick={() => signIn(DEMO_PATIENT)}
          >
            Demo patient
          </button>
          <button
            type="button"
            className="button button-soft button-small"
            disabled={busy}
            onClick={() => signIn(DEMO_DOCTOR)}
          >
            Demo doctor
          </button>
        </div>
        <p className="demo-hint">Patient: demo@sweety.app · Demo1234!</p>
      </div>

      <p className="auth-switch">
        New to Sweety? <Link to="/register">Create an account</Link>
      </p>
    </AuthShell>
  );
}
