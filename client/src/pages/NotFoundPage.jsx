import { Link } from 'react-router-dom';
import EmptyState from '../components/EmptyState.jsx';
import Logo from '../components/Logo.jsx';

export default function NotFoundPage() {
  return (
    <div className="standalone-page">
      <Logo />
      <EmptyState
        icon="info"
        title="This page has wandered off"
        description="The link may be old, or the page may never have existed."
        action={
          <Link className="button button-primary" to="/">
            Back to the dashboard
          </Link>
        }
      />
    </div>
  );
}
