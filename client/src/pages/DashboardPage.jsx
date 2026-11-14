import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Icon from '../components/Icon.jsx';
import Modal from '../components/Modal.jsx';
import ReadingForm from '../components/ReadingForm.jsx';
import Toast from '../components/Toast.jsx';
import {
  SLOTS,
  SLOT_LABELS,
  addDays,
  formatWeekday,
  todayISO,
  valueTone,
} from '../utils/format.js';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardPage() {
  const { user } = useAuth();
  const today = todayISO();

  const [date, setDate] = useState(today);
  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);

  const loadReadings = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoading(true);
      try {
        const data = await api.listReadings({ date });
        setReadings(data.readings);
        setLoadError('');
      } catch (error) {
        setLoadError(error.message);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [date],
  );

  useEffect(() => {
    loadReadings();
  }, [loadReadings]);

  const bySlot = useMemo(() => {
    const map = {};
    readings.forEach((reading) => {
      map[reading.slot] = reading;
    });
    return map;
  }, [readings]);

  const complete = readings.length >= 4;
  const nextFreeSlot = SLOTS.find((slot) => !bySlot[slot]) ?? SLOTS[0];
  const firstName = user.name.split(' ')[0];

  function openCreate() {
    if (complete) {
      setToast({ tone: 'error', message: 'You can add only 4 readings per day.' });
      return;
    }
    setModal({ mode: 'create', slot: nextFreeSlot });
  }

  function openEdit(reading) {
    setModal({ mode: 'edit', reading });
  }

  async function handleSubmit(values) {
    if (modal.mode === 'edit') {
      await api.updateReading(modal.reading.id, values);
      setToast({ tone: 'success', message: 'Reading updated.' });
    } else {
      await api.createReading(values);
      setToast({ tone: 'success', message: 'Reading added.' });
    }

    setModal(null);
    await loadReadings({ silent: true });
  }

  async function handleDelete(reading) {
    const confirmed = window.confirm(
      `Delete your ${SLOT_LABELS[reading.slot]} reading of ${reading.value} mg/dl?`,
    );
    if (!confirmed) return;

    try {
      await api.deleteReading(reading.id);
      setToast({ tone: 'success', message: 'Reading deleted.' });
      await loadReadings({ silent: true });
    } catch (error) {
      setToast({ tone: 'error', message: error.message });
    }
  }

  function changeDate(days) {
    setDate((current) => {
      const next = addDays(current, days);
      return next > today ? current : next;
    });
  }

  const usedSlots = modal?.mode === 'edit'
    ? readings.filter((reading) => reading.id !== modal.reading.id).map((reading) => reading.slot)
    : readings.map((reading) => reading.slot);

  return (
    <div className="dashboard">
      <header className="page-heading">
        <div>
          <span className="eyebrow">Your day</span>
          <h1>
            {greeting()}, {firstName}.
          </h1>
          <p>{formatWeekday(date)} · four readings, one gentle routine.</p>
        </div>

        <div className="date-nav">
          <button
            type="button"
            className="icon-button"
            onClick={() => changeDate(-1)}
            aria-label="Previous day"
          >
            <Icon name="chevronLeft" size={18} />
          </button>
          <input
            type="date"
            aria-label="Select date"
            max={today}
            value={date}
            onChange={(event) => setDate(event.target.value || today)}
          />
          <button
            type="button"
            className="icon-button"
            onClick={() => changeDate(1)}
            aria-label="Next day"
            disabled={date >= today}
          >
            <Icon name="chevronRight" size={18} />
          </button>
          {date !== today && (
            <button type="button" className="button button-ghost button-small" onClick={() => setDate(today)}>
              Today
            </button>
          )}
        </div>
      </header>

      <section className="day-progress">
        <div className="day-progress-copy">
          <div className="progress-ring" aria-hidden="true">
            <svg viewBox="0 0 44 44">
              <circle cx="22" cy="22" r="18" className="ring-track" />
              <circle
                cx="22"
                cy="22"
                r="18"
                className="ring-value"
                strokeDasharray={`${(readings.length / 4) * 113.1} 113.1`}
              />
            </svg>
            <span>{readings.length}/4</span>
          </div>
          <div>
            <h2>{complete ? 'All four readings logged' : 'Today’s readings'}</h2>
            <p>
              {complete
                ? 'Lovely work. Your daily report is ready when you are.'
                : `${4 - readings.length} ${4 - readings.length === 1 ? 'slot' : 'slots'} still open for ${formatWeekday(date)}.`}
            </p>
          </div>
        </div>

        <button
          type="button"
          className="button button-primary"
          onClick={openCreate}
          disabled={complete}
          title={complete ? 'You can add only 4 readings per day.' : 'Add a reading'}
        >
          <Icon name="plus" size={18} />
          Add reading
        </button>
      </section>

      {loadError && (
        <div className="alert alert-error" role="alert">
          <p>{loadError}</p>
          <button type="button" className="button button-small" onClick={() => loadReadings()}>
            Try again
          </button>
        </div>
      )}

      {loading ? (
        <div className="slot-grid" aria-hidden="true">
          {SLOTS.map((slot) => (
            <div key={slot} className="slot-card skeleton-card" />
          ))}
        </div>
      ) : (
        <section className="slot-grid" aria-label="Readings for the selected day">
          {SLOTS.map((slot, index) => {
            const reading = bySlot[slot];
            const tone = reading ? valueTone(reading.value) : null;

            return (
              <article key={slot} className={`slot-card ${reading ? 'has-reading' : 'is-empty'}`}>
                <header className="slot-head">
                  <span className="slot-index">{String(index + 1).padStart(2, '0')}</span>
                  <span className="slot-name">{SLOT_LABELS[slot]}</span>
                  {reading ? (
                    <span className={`tone-chip tone-${tone}`}>
                      {tone === 'low' ? 'Low' : tone === 'high' ? 'High' : 'In range'}
                    </span>
                  ) : (
                    <span className="tone-chip tone-empty">Empty</span>
                  )}
                </header>

                {reading ? (
                  <>
                    <p className={`slot-value tone-${tone}`}>
                      {reading.value}
                      <small>mg/dl</small>
                    </p>
                    <div className="slot-actions">
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => openEdit(reading)}
                      >
                        <Icon name="pencil" size={15} /> Edit
                      </button>
                      <button
                        type="button"
                        className="text-button text-danger"
                        onClick={() => handleDelete(reading)}
                      >
                        <Icon name="trash" size={15} /> Delete
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="slot-empty-text">Not logged yet</p>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setModal({ mode: 'create', slot })}
                    >
                      <Icon name="plus" size={15} /> Add reading
                    </button>
                  </>
                )}
              </article>
            );
          })}
        </section>
      )}

      {!loading && !loadError && readings.length === 0 && (
        <EmptyState
          icon="droplet"
          title="A fresh page for this day"
          description="Start with your morning fasting reading. One number is enough to begin."
          action={
            <button type="button" className="button button-primary" onClick={() => setModal({ mode: 'create', slot: 'morning' })}>
              <Icon name="plus" size={17} /> Add your first reading
            </button>
          }
        />
      )}

      {modal && (
        <Modal
          title={modal.mode === 'edit' ? 'Edit reading' : 'Add a reading'}
          subtitle={modal.mode === 'edit' ? 'Correct the value, date or slot.' : `Logging for ${formatWeekday(date)}.`}
          onClose={() => setModal(null)}
        >
          <ReadingForm
            initialReading={modal.reading}
            date={date}
            initialSlot={modal.slot}
            usedSlots={usedSlots}
            onSubmit={handleSubmit}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}

      <Toast
        message={toast?.message}
        tone={toast?.tone}
        onClose={() => setToast(null)}
      />
    </div>
  );
}
