import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Icon from './Icon.jsx';
import Logo from './Logo.jsx';

function initials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <Logo />

          <nav className="main-nav" aria-label="Main navigation">
            <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon name="droplet" size={17} />
              Dashboard
            </NavLink>
            <NavLink to="/reports" className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon name="chart" size={17} />
              Reports
            </NavLink>
            {user.role === 'doctor' && (
              <NavLink to="/patients" className={({ isActive }) => (isActive ? 'active' : '')}>
                <Icon name="users" size={17} />
                My patients
              </NavLink>
            )}
          </nav>

          <div className="header-user">
            <span className="avatar" aria-hidden="true">
              {initials(user.name)}
            </span>
            <span className="header-user-text">
              <strong>{user.name}</strong>
              <small>{user.role === 'doctor' ? 'Doctor' : 'Patient'}</small>
            </span>
            <button type="button" className="icon-button" onClick={handleLogout} title="Log out">
              <Icon name="logout" size={18} />
              <span className="sr-only">Log out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">
        <Outlet />
      </main>

      <footer className="app-footer">
        <span>Sweety · your readings stay private to your account.</span>
        <span className="footer-dot" aria-hidden="true" />
        <span>Made for calmer mornings.</span>
      </footer>
    </div>
  );
}
