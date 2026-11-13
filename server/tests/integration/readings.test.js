import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { addDays, todayISO } from '../../src/utils/dates.js';
import { authHeader, registerUser } from '../helpers/users.js';
import { resetDatabase, setupDatabase, teardownDatabase } from '../helpers/db.js';

const app = createApp();

beforeAll(setupDatabase);
beforeEach(resetDatabase);
afterAll(teardownDatabase);

async function addReading(token, reading) {
  return request(app)
    .post('/api/readings')
    .set(authHeader(token))
    .send(reading);
}

describe('readings CRUD', () => {
  it('creates, lists, updates and deletes a reading', async () => {
    const user = await registerUser(app);
    const date = addDays(todayISO(), -1);

    const created = await addReading(user.token, {
      date,
      slot: 'after_lunch',
      value: 146,
    });

    expect(created.status).toBe(201);
    expect(created.body.reading).toMatchObject({ date, slot: 'after_lunch', value: 146 });

    const list = await request(app)
      .get(`/api/readings?date=${date}`)
      .set(authHeader(user.token));

    expect(list.status).toBe(200);
    expect(list.body.readings).toHaveLength(1);
    expect(list.body.pagination).toMatchObject({ page: 1, limit: 20, total: 1, totalPages: 1 });

    const readingId = created.body.reading.id;
    const updated = await request(app)
      .put(`/api/readings/${readingId}`)
      .set(authHeader(user.token))
      .send({ date, slot: 'after_lunch', value: 121 });

    expect(updated.status).toBe(200);
    expect(updated.body.reading.value).toBe(121);

    const deleted = await request(app)
      .delete(`/api/readings/${readingId}`)
      .set(authHeader(user.token));

    expect(deleted.status).toBe(204);

    const empty = await request(app)
      .get(`/api/readings?date=${date}`)
      .set(authHeader(user.token));
    expect(empty.body.readings).toHaveLength(0);
  });

  it('keeps users isolated from each other', async () => {
    const alice = await registerUser(app, { name: 'Alice' });
    const bob = await registerUser(app, { name: 'Bob' });
    const date = addDays(todayISO(), -2);

    const created = await addReading(alice.token, { date, slot: 'morning', value: 99 });
    const aliceId = created.body.reading.id;

    const bobList = await request(app).get('/api/readings').set(authHeader(bob.token));
    expect(bobList.body.readings).toHaveLength(0);
    expect(bobList.body.pagination.total).toBe(0);

    const bobUpdate = await request(app)
      .put(`/api/readings/${aliceId}`)
      .set(authHeader(bob.token))
      .send({ date, slot: 'morning', value: 100 });
    expect(bobUpdate.status).toBe(404);
    expect(bobUpdate.body.message).toBe('Reading not found.');

    const bobDelete = await request(app)
      .delete(`/api/readings/${aliceId}`)
      .set(authHeader(bob.token));
    expect(bobDelete.status).toBe(404);

    const aliceList = await request(app).get('/api/readings').set(authHeader(alice.token));
    expect(aliceList.body.readings).toHaveLength(1);
  });

  it('requires authentication', async () => {
    const response = await request(app).get('/api/readings');
    expect(response.status).toBe(401);
  });
});

describe('reading validation messages', () => {
  it('requires a glucose value', async () => {
    const user = await registerUser(app);
    const response = await addReading(user.token, {
      date: addDays(todayISO(), -1),
      slot: 'morning',
      value: '',
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Please enter a glucose value.');
    expect(response.body.details).toEqual({ field: 'value' });
  });

  it('enforces the 40-600 range and whole numbers', async () => {
    const user = await registerUser(app);
    const date = addDays(todayISO(), -1);

    for (const value of [39, 601, 40.5, 'abc']) {
      const response = await addReading(user.token, { date, slot: 'morning', value });
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Value must be between 40 and 600 mg/dl.');
    }
  });

  it('rejects a future date', async () => {
    const user = await registerUser(app);
    const response = await addReading(user.token, {
      date: addDays(todayISO(), 1),
      slot: 'morning',
      value: 100,
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Date cannot be in the future.');
  });

  it('allows only one reading per slot per day', async () => {
    const user = await registerUser(app);
    const date = addDays(todayISO(), -1);

    const first = await addReading(user.token, { date, slot: 'after_lunch', value: 150 });
    expect(first.status).toBe(201);

    const duplicate = await addReading(user.token, { date, slot: 'after_lunch', value: 160 });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.message).toBe(
      'You already have an After lunch reading for this date.',
    );
  });

  it('allows only four readings per day', async () => {
    const user = await registerUser(app);
    const date = addDays(todayISO(), -1);
    const slots = ['morning', 'after_breakfast', 'after_lunch', 'after_dinner'];

    for (const slot of slots) {
      const response = await addReading(user.token, { date, slot, value: 120 });
      expect(response.status).toBe(201);
    }

    const fifth = await addReading(user.token, { date, slot: 'morning', value: 130 });
    expect(fifth.status).toBe(400);
    expect(fifth.body.message).toBe('You can add only 4 readings per day.');
  });
});

describe('pagination', () => {
  it('paginates readings newest first', async () => {
    const user = await registerUser(app);
    const today = todayISO();

    for (let day = 1; day <= 5; day += 1) {
      const response = await addReading(user.token, {
        date: addDays(today, -day),
        slot: 'morning',
        value: 90 + day,
      });
      expect(response.status).toBe(201);
    }

    const pageOne = await request(app)
      .get('/api/readings?page=1&limit=2')
      .set(authHeader(user.token));

    expect(pageOne.status).toBe(200);
    expect(pageOne.body.readings).toHaveLength(2);
    expect(pageOne.body.pagination).toEqual({ page: 1, limit: 2, total: 5, totalPages: 3 });
    // Newest first: yesterday, then two days ago.
    expect(pageOne.body.readings[0].date).toBe(addDays(today, -1));
    expect(pageOne.body.readings[1].date).toBe(addDays(today, -2));

    const pageThree = await request(app)
      .get('/api/readings?page=3&limit=2')
      .set(authHeader(user.token));
    expect(pageThree.body.readings).toHaveLength(1);
    expect(pageThree.body.readings[0].date).toBe(addDays(today, -5));
  });

  it('validates pagination parameters', async () => {
    const user = await registerUser(app);

    const badPage = await request(app)
      .get('/api/readings?page=0')
      .set(authHeader(user.token));
    expect(badPage.status).toBe(400);
    expect(badPage.body.message).toBe('Page must be a positive whole number.');

    const badLimit = await request(app)
      .get('/api/readings?limit=500')
      .set(authHeader(user.token));
    expect(badLimit.status).toBe(400);
    expect(badLimit.body.message).toBe('Limit must be a whole number between 1 and 100.');

    for (const query of ['page=abc', 'page=1.9', 'page=-2', 'limit=abc', 'limit=2.5']) {
      const response = await request(app).get(`/api/readings?${query}`).set(authHeader(user.token));
      expect(response.status, query).toBe(400);
    }
  });
});

describe('updating readings', () => {
  it('moves a reading to a different date and slot', async () => {
    const user = await registerUser(app);
    const dayOne = addDays(todayISO(), -2);
    const dayTwo = addDays(todayISO(), -1);

    const created = await addReading(user.token, {
      date: dayOne,
      slot: 'morning',
      value: 101,
    });

    const moved = await request(app)
      .put(`/api/readings/${created.body.reading.id}`)
      .set(authHeader(user.token))
      .send({ date: dayTwo, slot: 'after_dinner', value: 145 });

    expect(moved.status).toBe(200);
    expect(moved.body.reading).toMatchObject({ date: dayTwo, slot: 'after_dinner', value: 145 });

    const oldDay = await request(app)
      .get(`/api/readings?date=${dayOne}`)
      .set(authHeader(user.token));
    expect(oldDay.body.readings).toHaveLength(0);

    const newDay = await request(app)
      .get(`/api/readings?date=${dayTwo}`)
      .set(authHeader(user.token));
    expect(newDay.body.readings).toHaveLength(1);
  });

  it('rejects moving a reading into a full day or a duplicate slot', async () => {
    const user = await registerUser(app);
    const fullDay = addDays(todayISO(), -1);
    const otherDay = addDays(todayISO(), -2);

    for (const slot of ['morning', 'after_breakfast', 'after_lunch', 'after_dinner']) {
      await addReading(user.token, { date: fullDay, slot, value: 120 });
    }

    const movable = await addReading(user.token, {
      date: otherDay,
      slot: 'morning',
      value: 99,
    });

    const moveIntoFullDay = await request(app)
      .put(`/api/readings/${movable.body.reading.id}`)
      .set(authHeader(user.token))
      .send({ date: fullDay, slot: 'morning', value: 99 });

    // A full day already has a morning reading, so the slot check fires first.
    expect(moveIntoFullDay.status).toBe(409);
    expect(moveIntoFullDay.body.message).toBe(
      'You already have a Morning (fasting) reading for this date.',
    );

    const duplicate = await addReading(user.token, { date: otherDay, slot: 'after_lunch', value: 130 });

    const moveOntoDuplicate = await request(app)
      .put(`/api/readings/${movable.body.reading.id}`)
      .set(authHeader(user.token))
      .send({ date: otherDay, slot: 'after_lunch', value: 110 });

    expect(moveOntoDuplicate.status).toBe(409);
    expect(moveOntoDuplicate.body.message).toBe(
      'You already have an After lunch reading for this date.',
    );
    expect(duplicate.status).toBe(201);
  });

  it('rejects a future date on update', async () => {
    const user = await registerUser(app);
    const created = await addReading(user.token, {
      date: addDays(todayISO(), -1),
      slot: 'morning',
      value: 100,
    });

    const response = await request(app)
      .put(`/api/readings/${created.body.reading.id}`)
      .set(authHeader(user.token))
      .send({ date: addDays(todayISO(), 1), slot: 'morning', value: 100 });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Date cannot be in the future.');
  });
});
