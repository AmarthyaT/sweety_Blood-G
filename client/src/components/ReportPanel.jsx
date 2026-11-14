import { useCallback, useEffect, useState } from 'react';
import { formatDayLabel, slotLabel, todayISO, valueTone } from '../utils/format.js';
import EmptyState from './EmptyState.jsx';
import MonthChart from './MonthChart.jsx';
import StatCards from './StatCards.jsx';

const TABS = [
  { id: 'daily', label: 'Daily' },
  { id: 'mtd', label: 'Month to date' },
  { id: 'monthly', label: 'Monthly' },
];

const HINTS = {
  daily: 'Readings recorded on the selected day.',
  mtd: 'From the 1st of the month through the selected day.',
  monthly: 'The whole month before the selected day.',
};

/**
 * Reports view shared by patients and doctors.
 * `fetchReport` must be a stable (useCallback) function returning
 * `{ report }` or a report object.
 */
export default function ReportPanel({
  fetchReport,
  heading = 'Reports',
  subtitle,
  emptyHint = 'Log a reading from the dashboard and it will appear here.',
}) {
  const [type, setType] = useState('daily');
  const [date, setDate] = useState(todayISO());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    fetchReport({ type, date })
      .then((data) => {
        if (active) setReport(data?.report ?? data);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [fetchReport, type, date, reloadKey]);

  const isEmpty = report && report.stats.count === 0;

  return (
    <section className="report-panel">
      <header className="page-heading">
        <div>
          <span className="eyebrow">Glucose insights</span>
          <h1>{heading}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>

        <div className="report-date">
          <label htmlFor="report-date">Reporting date</label>
          <input
            id="report-date"
            type="date"
            max={todayISO()}
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>
      </header>

      <div className="segmented" role="tablist" aria-label="Report type">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={type === tab.id}
            className={type === tab.id ? 'active' : ''}
            onClick={() => setType(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <p className="report-hint">{HINTS[type]}</p>

      {loading && (
        <div className="report-loading" role="status">
          <span className="spinner" />
          Building your report…
        </div>
      )}

      {!loading && error && (
        <div className="alert alert-error" role="alert">
          <p>{error}</p>
          <button type="button" className="button button-small" onClick={load}>
            Try again
          </button>
        </div>
      )}

      {!loading && !error && report && (
        <>
          <div className="report-range">
            <div>
              <span className="range-label">{report.label}</span>
              <span className="range-sub">
                {report.stats.count} {report.stats.count === 1 ? 'reading' : 'readings'}
              </span>
            </div>
            <span className="range-type">{TABS.find((tab) => tab.id === type)?.label}</span>
          </div>

          {isEmpty ? (
            <EmptyState
              icon="chart"
              title="No readings for this period"
              description={`There is nothing logged between ${formatDayLabel(
                report.range.start,
              )} and ${formatDayLabel(report.range.end)}. ${emptyHint}`}
            />
          ) : (
            <>
              <StatCards stats={report.stats} />

              {type !== 'daily' &&
                (report.readings.length > 1 ? (
                  <article className="card chart-card">
                    <header className="card-header">
                      <div>
                        <h2>Readings over this period</h2>
                        <p>Each dot is one reading. Dashed lines mark 70 and 180 mg/dl.</p>
                      </div>
                    </header>
                    <MonthChart readings={report.readings} />
                  </article>
                ) : (
                  <p className="chart-single-note">
                    Add one more reading in this period to see the trend line.
                  </p>
                ))}

              {type === 'daily' && report.readings.length > 0 && (
                <article className="card">
                  <header className="card-header">
                    <div>
                      <h2>Readings on {report.label}</h2>
                      <p>Every slot you logged that day.</p>
                    </div>
                  </header>
                  <ul className="report-readings">
                    {report.readings.map((reading) => {
                      const tone = valueTone(reading.value);
                      return (
                        <li key={reading.id}>
                          <span className={`slot-dot tone-${tone}`} aria-hidden="true" />
                          <span className="report-slot">{slotLabel(reading.slot)}</span>
                          <span className={`report-value tone-${tone}`}>
                            {reading.value}
                            <small>mg/dl</small>
                          </span>
                          <span className={`tone-chip tone-${tone}`}>
                            {tone === 'low' ? 'Low' : tone === 'high' ? 'High' : 'In range'}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </article>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
