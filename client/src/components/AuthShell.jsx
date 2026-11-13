import Icon from './Icon.jsx';
import Logo from './Logo.jsx';

/** Shared split-screen shell for the login and register pages. */
export default function AuthShell({ children }) {
  return (
    <div className="auth-page">
      <aside className="auth-brand">
        <div className="auth-brand-top">
          <Logo />
        </div>

        <div className="auth-brand-copy">
          <span className="eyebrow eyebrow-light">A calmer way to track</span>
          <h1>
            Know your numbers.
            <br />
            Keep your routine.
          </h1>
          <p>
            Four simple readings a day, clear daily reports and a monthly view that shows the
            bigger picture.
          </p>

          <ul className="auth-features">
            <li>
              <span>
                <Icon name="check" size={15} />
              </span>
              Morning to dinner, four gentle slots
            </li>
            <li>
              <span>
                <Icon name="check" size={15} />
              </span>
              Highest, lowest and average at a glance
            </li>
            <li>
              <span>
                <Icon name="check" size={15} />
              </span>
              Private to you, or shared with your doctor
            </li>
          </ul>
        </div>

        <p className="auth-brand-footer">
          <Icon name="droplet" size={16} />
          Sweety is a demo project, not medical advice.
        </p>
      </aside>

      <main className="auth-panel">
        <div className="auth-card">{children}</div>
        <p className="auth-copyright">Sweety · Blood glucose tracker</p>
      </main>
    </div>
  );
}
