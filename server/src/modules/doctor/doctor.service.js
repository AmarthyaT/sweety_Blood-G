import ApiError from '../../lib/ApiError.js';
import { query } from '../../db/pool.js';
import { getReport } from '../reports/reports.service.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Patients assigned to this doctor, with lightweight activity metadata. */
export async function listPatients(doctorId) {
  const { rows } = await query(
    `SELECT
       u.id,
       u.name,
       u.email,
       COUNT(r.id)::int AS reading_count,
       MAX(r.reading_date) AS last_reading_date
     FROM doctor_patients dp
     JOIN users u ON u.id = dp.patient_id
     LEFT JOIN readings r ON r.user_id = u.id
     WHERE dp.doctor_id = $1
     GROUP BY u.id
     ORDER BY u.name ASC`,
    [doctorId],
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    readingCount: row.reading_count,
    lastReadingDate: row.last_reading_date,
  }));
}

async function getAssignedPatient(doctorId, patientId) {
  if (!UUID_PATTERN.test(patientId)) {
    throw ApiError.notFound('Patient not found.', 'patient_not_found');
  }

  const { rows } = await query(
    `SELECT u.id, u.name, u.email
     FROM doctor_patients dp
     JOIN users u ON u.id = dp.patient_id
     WHERE dp.doctor_id = $1 AND dp.patient_id = $2`,
    [doctorId, patientId],
  );

  if (!rows[0]) {
    throw ApiError.forbidden(
      'You do not have access to this patient.',
      'patient_not_assigned',
    );
  }
  return rows[0];
}

/** A doctor's view of one assigned patient's report. */
export async function getPatientReport(doctorId, patientId, { type, date }) {
  const patient = await getAssignedPatient(doctorId, patientId);
  const report = await getReport({ userId: patientId, type, date });
  return { patient, report };
}

/** Assign a patient to the doctor by email. */
export async function assignPatient(doctorId, email) {
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  if (!normalizedEmail) {
    throw ApiError.badRequest('Please enter the patient email address.', 'validation_error');
  }

  const { rows } = await query(
    `SELECT id, name, email FROM users WHERE LOWER(email) = $1 AND role = 'patient'`,
    [normalizedEmail],
  );

  const patient = rows[0];
  if (!patient) {
    throw ApiError.notFound('No patient account found with this email.', 'patient_not_found');
  }

  await query(
    `INSERT INTO doctor_patients (doctor_id, patient_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [doctorId, patient.id],
  );

  return patient;
}
