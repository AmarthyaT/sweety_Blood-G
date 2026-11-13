/**
 * Seed script: creates two demo patients and one demo doctor, then fills the
 * last ~7 weeks with realistic readings. Deterministic so screenshots and
 * reports look the same on every machine.
 *
 * Run with: npm run db:seed
 */
import { withTransaction, closePool } from './pool.js';
import { hashPassword } from '../lib/passwords.js';
import { addDays, todayISO } from '../utils/dates.js';
import { SLOTS } from '../utils/slots.js';

const DEMO_PASSWORD = 'Demo1234!';
const DEMO_DOCTOR_PASSWORD = 'Doctor1234!';

const USERS = [
  { name: 'Demo Patient', email: 'demo@sweety.app', role: 'patient', password: DEMO_PASSWORD },
  { name: 'Priya Sharma', email: 'priya@sweety.app', role: 'patient', password: DEMO_PASSWORD },
  { name: 'Dr. Maya Rao', email: 'doctor@sweety.app', role: 'doctor', password: DEMO_DOCTOR_PASSWORD },
];

/** Small deterministic PRNG (mulberry32) so seeded data is reproducible. */
function createRandom(seed) {
  let state = seed;
  return function random() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildReadings({ userId, seed, days, startWith }) {
  const random = createRandom(seed);
  const today = todayISO();
  const rows = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = addDays(today, -offset);

    // Leave some days deliberately incomplete, and one day completely empty.
    if (offset !== 0 && random() < 0.12) continue;

    const slotsForDay = offset === 0 ? ['morning'] : SLOTS;

    for (const slot of slotsForDay) {
      if (offset !== 0 && random() < 0.16) continue;

      // Fasting values run lower; post-meal values a little higher.
      const base = slot === 'morning' ? 92 : 138;
      const noise = Math.round((random() - 0.42) * 70);
      let value = Math.max(58, Math.min(268, base + noise));

      // A rare high reading makes the reports and chart more interesting.
      if (random() < 0.035) value += 55;

      rows.push({
        userId,
        date,
        slot,
        value: Math.max(40, Math.min(600, value)),
      });
    }
  }

  // Guarantee a useful first value for `startWith` accounts.
  if (startWith) {
    rows.push({ userId, date: today, slot: 'morning', value: 108 });
  }

  return rows;
}

async function main() {
  const emails = USERS.map((user) => user.email);

  await withTransaction(async (client) => {
    // Cascades remove readings and doctor assignments for these demo users.
    await client.query('DELETE FROM users WHERE email = ANY($1::text[])', [emails]);

    const created = {};
    for (const user of USERS) {
      const passwordHash = await hashPassword(user.password);
      const { rows } = await client.query(
        `INSERT INTO users (name, email, password_hash, role, created_at)
         VALUES ($1, $2, $3, $4, now() - INTERVAL '90 days')
         RETURNING id, name, email, role`,
        [user.name, user.email, passwordHash, user.role],
      );
      created[user.email] = rows[0];
    }

    const demo = created['demo@sweety.app'];
    const priya = created['priya@sweety.app'];
    const doctor = created['doctor@sweety.app'];

    const readings = [
      ...buildReadings({ userId: demo.id, seed: 20261015, days: 50, startWith: true }),
      ...buildReadings({ userId: priya.id, seed: 77123, days: 24, startWith: true }),
    ];

    for (const reading of readings) {
      await client.query(
        `INSERT INTO readings (user_id, reading_date, slot, value)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, reading_date, slot) DO NOTHING`,
        [reading.userId, reading.date, reading.slot, reading.value],
      );
    }

    await client.query(
      `INSERT INTO doctor_patients (doctor_id, patient_id)
       VALUES ($1, $2), ($1, $3)
       ON CONFLICT DO NOTHING`,
      [doctor.id, demo.id, priya.id],
    );

    console.log(`\nSeeded ${readings.length} readings.`);
    console.log('\nDemo accounts');
    console.log('  Patient  demo@sweety.app    / Demo1234!');
    console.log('  Patient  priya@sweety.app   / Demo1234!');
    console.log('  Doctor   doctor@sweety.app  / Doctor1234!');
  });

  await closePool();
}

main().catch(async (error) => {
  console.error('Seeding failed:', error);
  await closePool().catch(() => {});
  process.exitCode = 1;
});
