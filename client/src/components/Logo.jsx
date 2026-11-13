import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';

export default function Logo({ to = '/' }) {
  return (
    <Link className="logo" to={to} aria-label="Sweety home">
      <span className="logo-mark">
        <Icon name="droplet" size={22} strokeWidth={1.6} />
      </span>
      <span className="logo-text">
        <strong>Sweety</strong>
        <small>Blood glucose tracker</small>
      </span>
    </Link>
  );
}
