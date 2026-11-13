import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { authHeader, registerUser } from '../helpers/users.js';
import { resetDatabase, setupDatabase, teardownDatabase } from '../helpers/db.js';

const app = createApp();

beforeAll(setupDatabase);
beforeEach(resetDatabase);
afterAll(teardownDatabase);

async function addReading(token, { date, slot, value }) {
  const response = await request(app)
    .post('/api/readings')
    .set(authHeader(token))
    .send({ date, slot, value });
  expect(response.status).toBe(201);
  return response.body.reading;
}

async function getReport(token, query) {
  return request(app)
    .get(`/api/reports?${new URLSearchParams(query).toString()}`)
    .set(authHeader(token));
}

describe('daily report', () => {
  it('returns highest, lowest, average, count and the slot list', async () => {
    const user = await registerUser(app);
    const date = '2026-10-15';

    await addReading(user.token, { date, slot: 'after_dinner', value: 180 });
    await addReading(user.token, { date, slot: 'morning', value: 90 });
    await addReading(user.token, { date, slot: 'after_lunch', value: 150 });

    const response = await getReport(user.token, { type: 'daily', date });

    expect(response.status).toBe(200);
    const { report } = response.body;
    expect(report.label).toBe('15 Oct 2026');
    expect(report.range).toEqual({ start: date, end: date });
    expect(report.stats).toEqual({ count: 3, highest: 180, lowest: 90, average: 140 });
    expect(report.readings.map((reading) => reading.slot)).toEqual([
      'morning',
      'after_lunch',
      'after_dinner',
    ]);
  });

  it('returns an empty report when there are no readings', async () => {
    const user = await registerUser(app);
    const response = await getReport(user.token, { type: 'daily', date: '2026-10-13' });

    expect(response.status).toBe(200);
    expect(response.body.report.stats).toEqual({
      count: 0,
      highest: null,
      lowest: null,
      average: null,
    });
    expect(response.body.report.readings).toEqual([]);
  });

  it('rounds the average to one decimal', async () => {
    const user = await registerUser(app);
    const date = '2026-10-14';

    await addReading(user.token, { date, slot: 'morning', value: 100 });
    await addReading(user.token, { date, slot: 'after_breakfast', value: 101 });
    await addReading(user.token, { date, slot: 'after_lunch', value: 101 });

    const response = await getReport(user.token, { type: 'daily', date });
    expect(response.body.report.stats.average).toBe(100.7);
  });
});

describe('month-to-date report', () => {
  it('covers the 1st of the month through the selected date', async () => {
    const user = await registerUser(app);

    await addReading(user.token, { date: '2026-09-30', slot: 'morning', value: 70 });
    await addReading(user.token, { date: '2026-10-01', slot: 'morning', value: 100 });
    await addReading(user.token, { date: '2026-10-15', slot: 'after_lunch', value: 160 });
    await addReading(user.token, { date: '2026-10-20', slot: 'after_dinner', value: 200 });

    const response = await getReport(user.token, { type: 'mtd', date: '2026-10-15' });

    expect(response.status).toBe(200);
    expect(response.body.report.label).toBe('1 Oct – 15 Oct 2026');
    expect(response.body.report.range).toEqual({ start: '2026-10-01', end: '2026-10-15' });
    expect(response.body.report.stats).toEqual({
      count: 2,
      highest: 160,
      lowest: 100,
      average: 130,
    });
    expect(response.body.report.readings).toHaveLength(2);
  });
});

describe('monthly report', () => {
  it('covers the whole previous month', async () => {
    const user = await registerUser(app);

    await addReading(user.token, { date: '2026-09-30', slot: 'morning', value: 80 });
    await addReading(user.token, { date: '2026-10-01', slot: 'morning', value: 110 });

    const response = await getReport(user.token, { type: 'monthly', date: '2026-10-15' });

    expect(response.status).toBe(200);
    expect(response.body.report.label).toBe('1 Sep – 30 Sep 2026');
    expect(response.body.report.range).toEqual({ start: '2026-09-01', end: '2026-09-30' });
    expect(response.body.report.stats.count).toBe(1);
    expect(response.body.report.stats.highest).toBe(80);
  });

  it('defaults to today and the daily type', async () => {
    const user = await registerUser(app);
    const response = await request(app).get('/api/reports').set(authHeader(user.token));

    expect(response.status).toBe(200);
    expect(response.body.report.type).toBe('daily');
  });
});

describe('report validation', () => {
  it('rejects unknown report types and invalid dates', async () => {
    const user = await registerUser(app);

    const badType = await getReport(user.token, { type: 'weekly', date: '2026-10-15' });
    expect(badType.status).toBe(400);
    expect(badType.body.message).toBe('Unknown report type. Use daily, mtd or monthly.');

    const badDate = await getReport(user.token, { type: 'daily', date: '2026-02-30' });
    expect(badDate.status).toBe(400);
    expect(badDate.body.message).toBe('Please choose a valid date.');

    const futureDate = await getReport(user.token, { type: 'daily', date: '2099-01-01' });
    expect(futureDate.status).toBe(400);
    expect(futureDate.body.message).toBe('Date cannot be in the future.');
  });

  it('requires authentication', async () => {
    const response = await request(app).get('/api/reports?type=daily');
    expect(response.status).toBe(401);
  });
});
