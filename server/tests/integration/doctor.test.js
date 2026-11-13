import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { pool } from '../../src/db/pool.js';
import { authHeader, registerUser } from '../helpers/users.js';
import { resetDatabase, setupDatabase, teardownDatabase } from '../helpers/db.js';

const app = createApp();

beforeAll(setupDatabase);
beforeEach(resetDatabase);
afterAll(teardownDatabase);

async function makeDoctor(overrides = {}) {
  const user = await registerUser(app, { ...overrides, name: overrides.name ?? 'Dr. Test' });
  await pool.query(`UPDATE users SET role = 'doctor' WHERE id = $1`, [user.user.id]);
  return user;
}

describe('doctor access control', () => {
  it('blocks patients from doctor routes', async () => {
    const patient = await registerUser(app);
    const response = await request(app)
      .get('/api/doctor/patients')
      .set(authHeader(patient.token));

    expect(response.status).toBe(403);
    expect(response.body.message).toBe('You do not have permission to access this resource.');
  });

  it('requires authentication', async () => {
    const response = await request(app).get('/api/doctor/patients');
    expect(response.status).toBe(401);
  });
});

describe('doctor patient management and reports', () => {
  it('assigns a patient, lists them and opens their daily report', async () => {
    const doctor = await makeDoctor({ name: 'Dr. Maya' });
    const patient = await registerUser(app, { name: 'Ravi Kumar' });
    const date = '2026-10-15';

    await request(app)
      .post('/api/readings')
      .set(authHeader(patient.token))
      .send({ date, slot: 'morning', value: 105 });

    const assignment = await request(app)
      .post('/api/doctor/patients')
      .set(authHeader(doctor.token))
      .send({ email: patient.email });

    expect(assignment.status).toBe(201);
    expect(assignment.body.patient.email).toBe(patient.email);

    const list = await request(app)
      .get('/api/doctor/patients')
      .set(authHeader(doctor.token));

    expect(list.status).toBe(200);
    expect(list.body.patients).toHaveLength(1);
    expect(list.body.patients[0]).toMatchObject({
      name: 'Ravi Kumar',
      readingCount: 1,
      lastReadingDate: date,
    });

    const report = await request(app)
      .get(`/api/doctor/patients/${patient.user.id}/reports?type=daily&date=${date}`)
      .set(authHeader(doctor.token));

    expect(report.status).toBe(200);
    expect(report.body.patient.name).toBe('Ravi Kumar');
    expect(report.body.report.stats).toEqual({
      count: 1,
      highest: 105,
      lowest: 105,
      average: 105,
    });
    expect(report.body.report.readings[0].slot).toBe('morning');
  });

  it('refuses access to an unassigned patient', async () => {
    const doctor = await makeDoctor();
    const stranger = await registerUser(app, { name: 'Unassigned Patient' });

    const report = await request(app)
      .get(`/api/doctor/patients/${stranger.user.id}/reports?type=daily&date=2026-10-15`)
      .set(authHeader(doctor.token));

    expect(report.status).toBe(403);
    expect(report.body.message).toBe('You do not have access to this patient.');
  });

  it('does not reveal another doctor’s patients', async () => {
    const doctorA = await makeDoctor({ email: 'doctor.a@example.com' });
    const doctorB = await makeDoctor({ email: 'doctor.b@example.com' });
    const patient = await registerUser(app, { email: 'shared.patient@example.com' });

    await request(app)
      .post('/api/doctor/patients')
      .set(authHeader(doctorA.token))
      .send({ email: patient.email });

    const listB = await request(app)
      .get('/api/doctor/patients')
      .set(authHeader(doctorB.token));

    expect(listB.body.patients).toHaveLength(0);

    const reportB = await request(app)
      .get(`/api/doctor/patients/${patient.user.id}/reports?type=daily&date=2026-10-15`)
      .set(authHeader(doctorB.token));
    expect(reportB.status).toBe(403);
  });

  it('rejects unknown patient emails and empty input', async () => {
    const doctor = await makeDoctor();

    const unknown = await request(app)
      .post('/api/doctor/patients')
      .set(authHeader(doctor.token))
      .send({ email: 'nobody@example.com' });
    expect(unknown.status).toBe(404);
    expect(unknown.body.message).toBe('No patient account found with this email.');

    const empty = await request(app)
      .post('/api/doctor/patients')
      .set(authHeader(doctor.token))
      .send({});
    expect(empty.status).toBe(400);
    expect(empty.body.message).toBe('Please enter the patient email address.');
  });

  it('is idempotent when the same patient is assigned twice', async () => {
    const doctor = await makeDoctor();
    const patient = await registerUser(app, { email: 'repeat@example.com' });

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await request(app)
        .post('/api/doctor/patients')
        .set(authHeader(doctor.token))
        .send({ email: patient.email });
      expect(response.status).toBe(201);
    }

    const list = await request(app)
      .get('/api/doctor/patients')
      .set(authHeader(doctor.token));
    expect(list.body.patients).toHaveLength(1);
  });

  it('returns 404 for a malformed patient id', async () => {
    const doctor = await makeDoctor();

    const response = await request(app)
      .get('/api/doctor/patients/not-a-uuid/reports?type=daily&date=2026-10-15')
      .set(authHeader(doctor.token));

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('Patient not found.');
  });

  it('serves month-to-date and previous-month reports for an assigned patient', async () => {
    const doctor = await makeDoctor();
    const patient = await registerUser(app, { name: 'Meera Nair' });

    for (const [date, value] of [
      ['2026-09-20', 90],
      ['2026-10-02', 120],
      ['2026-10-10', 150],
    ]) {
      await request(app)
        .post('/api/readings')
        .set(authHeader(patient.token))
        .send({ date, slot: 'morning', value })
        .expect(201);
    }

    await request(app)
      .post('/api/doctor/patients')
      .set(authHeader(doctor.token))
      .send({ email: patient.email })
      .expect(201);

    const mtd = await request(app)
      .get(`/api/doctor/patients/${patient.user.id}/reports?type=mtd&date=2026-10-15`)
      .set(authHeader(doctor.token));

    expect(mtd.status).toBe(200);
    expect(mtd.body.report.stats).toMatchObject({ count: 2, highest: 150, lowest: 120 });

    const monthly = await request(app)
      .get(`/api/doctor/patients/${patient.user.id}/reports?type=monthly&date=2026-10-15`)
      .set(authHeader(doctor.token));

    expect(monthly.status).toBe(200);
    expect(monthly.body.report.stats.count).toBe(1);
    expect(monthly.body.report.readings[0].date).toBe('2026-09-20');
  });
});
