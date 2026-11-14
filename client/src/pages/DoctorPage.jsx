import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';
import EmptyState from '../components/EmptyState.jsx';
import Icon from '../components/Icon.jsx';
import ReportPanel from '../components/ReportPanel.jsx';
import { formatDayLabel } from '../utils/format.js';

function initials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

export default function DoctorPage() {
  const [patients, setPatients] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [assignError, setAssignError] = useState('');
  const [assigning, setAssigning] = useState(false);

  const loadPatients = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listPatients();
      setPatients(data.patients);
      setError('');
      setSelectedId((current) => current ?? data.patients[0]?.id ?? null);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  async function handleAssign(event) {
    event.preventDefault();
    setAssignError('');

    if (!email.trim()) {
      setAssignError('Please enter the patient email address.');
      return;
    }

    setAssigning(true);
    try {
      const data = await api.assignPatient(email.trim());
      setEmail('');
      await loadPatients();
      setSelectedId(data.patient.id);
    } catch (requestError) {
      setAssignError(requestError.message);
    } finally {
      setAssigning(false);
    }
  }

  const selected = patients.find((patient) => patient.id === selectedId) ?? null;

  const fetchReport = useCallback(
    ({ type, date }) => api.getPatientReport(selectedId, { type, date }),
    [selectedId],
  );

  return (
    <div className="doctor-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">Doctor workspace</span>
          <h1>My patients</h1>
          <p>Open a patient’s daily, month-to-date or monthly report.</p>
        </div>
      </header>

      {error && (
        <div className="alert alert-error" role="alert">
          <p>{error}</p>
          <button type="button" className="button button-small" onClick={loadPatients}>
            Try again
          </button>
        </div>
      )}

      <div className="doctor-grid">
        <aside className="patient-sidebar">
          <div className="card patient-list-card">
            <header className="card-header">
              <div>
                <h2>Assigned patients</h2>
                <p>{patients.length} in your care</p>
              </div>
              <Icon name="users" size={19} />
            </header>

            {loading ? (
              <div className="patient-list">
                <div className="patient-skeleton" />
                <div className="patient-skeleton" />
              </div>
            ) : patients.length === 0 ? (
              <p className="sidebar-empty">
                No patients yet. Assign one with their email below.
              </p>
            ) : (
              <ul className="patient-list">
                {patients.map((patient) => (
                  <li key={patient.id}>
                    <button
                      type="button"
                      className={`patient-button ${patient.id === selectedId ? 'active' : ''}`}
                      onClick={() => setSelectedId(patient.id)}
                    >
                      <span className="avatar avatar-soft">{initials(patient.name)}</span>
                      <span className="patient-meta">
                        <strong>{patient.name}</strong>
                        <small>
                          {patient.readingCount} readings
                          {patient.lastReadingDate
                            ? ` · last ${formatDayLabel(patient.lastReadingDate)}`
                            : ' · no readings yet'}
                        </small>
                      </span>
                      <Icon name="chevronRight" size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <form className="card assign-card" onSubmit={handleAssign} noValidate>
            <header className="card-header">
              <div>
                <h2>Assign a patient</h2>
                <p>Add a patient account by email.</p>
              </div>
            </header>

            <div className="field">
              <label htmlFor="assign-email">Patient email</label>
              <div className="input-with-icon">
                <Icon name="mail" size={17} />
                <input
                  id="assign-email"
                  type="email"
                  placeholder="patient@example.com"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (assignError) setAssignError('');
                  }}
                />
              </div>
            </div>

            {assignError && (
              <p className="form-error" role="alert">
                <Icon name="alert" size={16} />
                {assignError}
              </p>
            )}

            <button type="submit" className="button button-primary button-block" disabled={assigning}>
              {assigning ? 'Assigning…' : 'Assign patient'}
            </button>
            <p className="field-hint">Try priya@sweety.app on the seeded database.</p>
          </form>
        </aside>

        <div className="doctor-report">
          {selected ? (
            <ReportPanel
              key={selected.id}
              fetchReport={fetchReport}
              heading={`${selected.name}’s reports`}
              subtitle={selected.email}
            />
          ) : (
            !loading && (
              <EmptyState
                icon="users"
                title="Choose a patient"
                description="Once a patient is assigned, their reports will appear here."
              />
            )
          )}
        </div>
      </div>
    </div>
  );
}
