import { useState } from 'react';
import { SLOTS, SLOT_LABELS, todayISO } from '../utils/format.js';
import Icon from './Icon.jsx';

/**
 * Add / edit form.
 *
 * Client-side validation intentionally repeats the API rules so the user gets
 * an instant message. If the API still rejects the request, its message is
 * shown in the same place.
 */
export default function ReadingForm({
  initialReading = null,
  date: initialDate,
  initialSlot,
  usedSlots = [],
  onSubmit,
  onCancel,
}) {
  const firstFreeSlot = SLOTS.find((slot) => !usedSlots.includes(slot)) ?? SLOTS[0];

  const [form, setForm] = useState({
    value: initialReading ? String(initialReading.value) : '',
    date: initialReading?.date ?? initialDate ?? todayISO(),
    slot: initialReading?.slot ?? initialSlot ?? firstFreeSlot,
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    if (error) setError('');
  }

  function validate() {
    const raw = String(form.value).trim();

    if (raw === '') return 'Please enter a glucose value.';

    const value = Number(raw);
    if (!Number.isInteger(value) || value < 40 || value > 600) {
      return 'Value must be between 40 and 600 mg/dl.';
    }

    if (!form.date) return 'Please choose a date.';
    if (form.date > todayISO()) return 'Date cannot be in the future.';

    if (!SLOTS.includes(form.slot)) return 'Please choose a valid time slot.';

    return '';
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const message = validate();

    if (message) {
      setError(message);
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        date: form.date,
        slot: form.slot,
        value: Number(form.value),
      });
    } catch (submitError) {
      setError(submitError.message || 'Could not save the reading. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="reading-form" onSubmit={handleSubmit} noValidate>
      <div className="field">
        <label htmlFor="reading-value">
          Glucose value <span className="label-unit">mg/dl</span>
        </label>
        <div className={`input-with-icon ${error ? 'input-error' : ''}`}>
          <Icon name="droplet" size={18} />
          <input
            id="reading-value"
            name="value"
            type="number"
            inputMode="numeric"
            min="40"
            max="600"
            step="1"
            placeholder="e.g. 128"
            value={form.value}
            onChange={(event) => update('value', event.target.value)}
            aria-invalid={Boolean(error)}
            autoFocus
          />
        </div>
        <p className="field-hint">A whole number between 40 and 600.</p>
      </div>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="reading-date">Date</label>
          <input
            id="reading-date"
            name="date"
            type="date"
            max={todayISO()}
            value={form.date}
            onChange={(event) => update('date', event.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="reading-slot">Time slot</label>
          <select
            id="reading-slot"
            name="slot"
            value={form.slot}
            onChange={(event) => update('slot', event.target.value)}
          >
            {SLOTS.map((slot) => (
              <option key={slot} value={slot} disabled={usedSlots.includes(slot)}>
                {SLOT_LABELS[slot]}
                {usedSlots.includes(slot) ? ' — already logged' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <p className="form-error" role="alert">
          <Icon name="alert" size={16} />
          {error}
        </p>
      )}

      <div className="modal-actions">
        <button type="button" className="button button-ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="button button-primary" disabled={saving}>
          {saving ? 'Saving…' : initialReading ? 'Save changes' : 'Add reading'}
        </button>
      </div>
    </form>
  );
}
