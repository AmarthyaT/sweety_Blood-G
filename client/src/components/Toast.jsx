import { useEffect } from 'react';
import Icon from './Icon.jsx';

/** Toast shown in the bottom-right corner; parent owns the message state. */
export default function Toast({ message, tone = 'success', onClose }) {
  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(onClose, 4200);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div className={`toast toast-${tone}`} role="status" aria-live="polite">
      <Icon name={tone === 'error' ? 'alert' : 'check'} size={18} />
      <span>{message}</span>
      <button type="button" className="toast-close" onClick={onClose} aria-label="Dismiss message">
        <Icon name="close" size={15} />
      </button>
    </div>
  );
}
