# Sweety: engineering guide

How the project works and why it is built this way. Setup lives in the [README](../README.md).

## 1. Overview

Sweety is a small full-stack app. A patient registers, logs up to four glucose readings a day in
four fixed slots, edits or deletes them, and reads three reports: today, the month so far, and the
previous month. A doctor account can read the reports of assigned patients.

The assignment specified MERN with PostgreSQL. This is the same shape with PostgreSQL as the only
database: reports are aggregates (`MIN`, `MAX`, `AVG`, `COUNT`) over a date range, which is what
SQL is good at. React, Express and the REST layer are unchanged.

| Layer | Technology |
|---|---|
| Client | React 18, React Router 6, Vite, Recharts, hand-written CSS |
| API | Node.js, Express 4, JWT, bcrypt |
| Data | PostgreSQL 16, `pg` with parameterised SQL |
| Cache | Redis 7 through `ioredis` (optional) |
| Jobs | BullMQ 5, separate worker process |
| Tests | Vitest, Supertest, React Testing Library |
| Delivery | npm workspaces, Docker Compose, nginx |

## 2. Architecture

```
Browser (React SPA)
   |  /api/* , Authorization: Bearer <jwt>
   v
nginx (Docker) or the Vite proxy
   |
   v
Express API :4000
   |-- helmet -> CORS -> JSON -> routes -> controllers -> services
   |-- requireAuth loads the user from PostgreSQL on every request
   |
   |-- pg pool ----------> PostgreSQL 16        users, readings,
   |                                            doctor_patients, reminder_logs
   |-- ioredis ----------> Redis 7              report cache, BullMQ queue
   `-- BullMQ queue -----> worker process       reminder scan
```

Four principles:

1. **Thin controllers, real services.** Controllers translate HTTP. Services hold the rules and
   the SQL, so tests can call them without going through Express.
2. **Rules at two levels.** Service checks produce the assignment's exact messages. Database
   constraints guarantee the same rules when two requests race.
3. **Optional infrastructure.** Redis and BullMQ are additive. With only PostgreSQL the required
   features all work; the cache is disabled and the worker is not started.
4. **One report shape.** Daily, month-to-date and monthly return the same object, so the client has
   one panel, one empty state and one chart.

### Middleware order

`helmet` (security headers, no Express fingerprint) → CORS allow-list → `express.json` with a
100 kb limit → routes → 404 handler → error handler. `requireAuth` runs per router, verifies the
JWT with HS256, then loads the current user row so role changes take effect immediately.

### Error model

One `ApiError` class carries `status`, `code` and optional `details`. Every failure is rendered by
one handler as `{ message, code, details? }`. Database errors are translated centrally: `23505`
becomes a conflict, `23514` a validation error, `22P02` a 404 for malformed UUIDs. Unexpected
errors are logged and returned as a generic 500.

## 3. Data model

```
users
  id uuid pk, name, email, password_hash, role patient|doctor, created_at
  unique index on lower(email)

readings
  id uuid pk, user_id -> users on delete cascade
  reading_date date, slot text, value integer
  unique (user_id, reading_date, slot)
  check value between 40 and 600
  trigger: at most four readings per user per day

doctor_patients
  doctor_id -> users, patient_id -> users, primary key (doctor_id, patient_id)
  check doctor_id <> patient_id

reminder_logs
  user_id -> users, log_date date, reading_count, message
  unique (user_id, log_date)
```

Indexes: `readings(user_id, reading_date desc)` for every read path, `doctor_patients(patient_id)`
for the reverse lookup, `reminder_logs(log_date)` for reviewing a scan.

**UUIDs** because readings appear in URLs (`PUT /readings/:id`). Sequential ids leak volume and
invite enumeration. `gen_random_uuid()` comes from pgcrypto. Malformed ids are rejected before
hitting the database.

**One schema file, not migrations.** For a project this size a single idempotent `schema.sql`
applied by `db/setup.js` is easier to review and safe to re-run. Schema changes after release
would need numbered migrations.

**Seed.** `seed.js` uses a fixed-seed PRNG (mulberry32), so every machine gets similar data:
about 50 days for the first patient, 24 for the second, a doctor assigned to both, and a few
deliberately incomplete days so the reminder job has something to report. Dates are relative to
today, so reports are never empty.

## 4. API

Base URL `/api`. Authenticated routes require `Authorization: Bearer <token>`.

| Method | Endpoint | Returns |
|---|---|---|
| `POST` | `/auth/register` | `201 { user, token }` |
| `POST` | `/auth/login` | `200 { user, token }` |
| `GET` | `/auth/me` | `200 { user }` |
| `GET` | `/readings?date=&page=&limit=` | `200 { readings, pagination }` |
| `POST` | `/readings` | `201 { reading }` |
| `PUT` | `/readings/:id` | `200 { reading }` |
| `DELETE` | `/readings/:id` | `204` |
| `GET` | `/reports?type=&date=` | `200 { report }` |
| `GET` | `/doctor/patients` | `200 { patients }` |
| `POST` | `/doctor/patients` | `201 { patient }` |
| `GET` | `/doctor/patients/:id/reports` | `200 { patient, report }` |
| `GET` | `/health` | `200` or `503 { status, db, cache, uptimeSeconds }` |

### Status codes

`200` ok, `201` created, `204` deleted, `400` validation or bad parameters, `401` missing or
invalid token, `403` authenticated but not allowed, `404` not found, `409` conflict, `413` body
over 100 kb, `500` unexpected, `503` health check with PostgreSQL down.

### Error codes

| Code | Status | Meaning |
|---|---|---|
| `validation_error` | 400 | a field is missing or invalid |
| `invalid_json` | 400 | body is not valid JSON |
| `payload_too_large` | 413 | body over 100 kb |
| `invalid_page` / `invalid_limit` | 400 | pagination outside its range |
| `invalid_date` | 400 | malformed, impossible or future date |
| `invalid_report_type` | 400 | not daily, mtd or monthly |
| `daily_limit_reached` | 400 | four readings already exist that day |
| `slot_already_used` | 409 | one reading per slot per day |
| `email_taken` | 409 | registration email already exists |
| `invalid_credentials` | 401 | wrong email or password |
| `missing_token` / `invalid_token` | 401 | no token, or expired or deleted user |
| `patient_not_assigned` | 403 | doctor has no assignment for this patient |
| `patient_not_found` | 404 | no patient with that email or id |
| `reading_not_found` | 404 | reading does not exist for this user |
| `route_not_found` | 404 | unknown path |
| `server_error` | 500 | unexpected error |

### Reading validation

| Rule | Message | HTTP | Also enforced by |
|---|---|---|---|
| Value present | Please enter a glucose value. | 400 | `NOT NULL` |
| Integer 40–600 | Value must be between 40 and 600 mg/dl. | 400 | `CHECK` |
| One per slot per day | You already have an After lunch reading for this date. | 409 | `UNIQUE` |
| At most four per day | You can add only 4 readings per day. | 400 | trigger |
| Not in the future | Date cannot be in the future. | 400 | — |
| Real date | Please choose a date. | 400 | `DATE` |
| Valid slot | Please choose a valid time slot. | 400 | `CHECK` |

Validation runs value, then date, then slot. Create checks the day's count before the slot, so a
full day returns the four-per-day message and a partly filled day returns the slot message.

## 5. Flows

### Add a reading

```
POST /readings
  validate payload
  BEGIN
    pg_advisory_xact_lock(hashtext("<userId>:<date>"))
    count rows for that user and day; reject at 4
    check the slot is free
    INSERT
  COMMIT
  delete sweety:reports:<userId>:* from Redis
```

The advisory lock is transaction-scoped, so two simultaneous posts for the same patient and day
are serialised and the second one gets a clean 409 instead of a constraint error. Different users,
or different days, do not block each other. A hash collision would only serialise extra work.

Update follows the same pattern, locks the **destination** day, loads the row with `FOR UPDATE`,
and re-checks the slot and the day's capacity if the date moved. Moving a reading out of a day can
never break the limit, which is why only the target day is locked.

### Reports

```
GET /reports?type=mtd&date=2026-10-15
  validate type and date (not future)
  cache key sweety:reports:<userId>:<type>:<date>
  on miss:
    aggregate query: COUNT, MAX, MIN, ROUND(AVG(value)::numeric, 1)
    row query: all readings in range, ordered by date then slot
  cache for REPORT_CACHE_TTL_SECONDS (300)
```

| `type` | Function | Range for 15 Oct 2026 | Label |
|---|---|---|---|
| `daily` | `dailyRange` | 15 Oct → 15 Oct | `15 Oct 2026` |
| `mtd` | `monthToDateRange` | 1 Oct → 15 Oct | `1 Oct – 15 Oct 2026` |
| `monthly` | `previousMonthRange` | 1 Sep → 30 Sep | `1 Sep – 30 Sep 2026` |

The range functions are pure and unit-tested, including leap years and the January case where the
previous month is in the previous year. Monthly is the full previous month, not the last 30 days.

A doctor request uses the patient's id in the cache key, so a doctor and the patient share the
same cached report safely.

### Reminder job

```
worker process
  upsertJobScheduler('daily-reminder-scan', { pattern: '0 8 * * *' })
    -> job 'scan'
       find patients with fewer than 4 readings on the target day (yesterday)
       for each: upsert reminder_logs (user_id, log_date)
       log a summary
```

`LEFT JOIN` keeps patients with zero readings in the result. The unique key on
`(user_id, log_date)` plus `ON CONFLICT DO UPDATE` makes retries and manual reruns produce one row
per patient per day. `npm run job:run` runs the same service once without Redis.

`upsertJobScheduler` is BullMQ 5.16+; the code falls back to `repeat` for older versions.

## 6. Security

- **Passwords:** bcrypt, 10 rounds (4 in tests), never returned. Length 8–72 characters, bcrypt's
  limit.
- **Login:** unknown email and wrong password return the same message, and the comparison runs
  against a dummy hash when the user does not exist, so the two paths take similar time.
- **Sessions:** JWT with `sub` and `role`, HS256, 7 days. The middleware re-reads the user, so the
  token's role is not trusted and a deleted account stops working immediately.
- **Ownership:** every reading query includes `user_id = $2`. Another user's valid id returns 404,
  not 403, so the API does not confirm that the row exists.
- **SQL injection:** all values are parameters. The only interpolated SQL is a constant slot
  ordering expression and generated placeholder numbers.
- **CORS:** explicit origin allow-list. Requests without an `Origin` header (curl, tests) pass.
- **Secrets:** `JWT_SECRET` must differ from the development default in production or the process
  refuses to start. `.env` is git-ignored.
- **Body size:** 100 kb.

Deliberate gaps, listed in the README: token in `localStorage`, no rate limiting, no account
lockout, no email verification or password reset, no CSRF tokens.

## 7. Cache

Redis is optional by design:

- no `REDIS_URL`, or `NODE_ENV=test` → every helper returns a miss;
- connection failure → one warning in the log, then misses;
- success → JSON stored with an expiry.

`cacheDeletePattern` uses `SCAN` with a cursor and `DEL` in batches, not `KEYS`, so clearing a
user's reports does not block Redis. Invalidation is coarse on purpose: any write clears all of
that user's reports, which avoids reasoning about which ranges a single reading affects.

`/api/health` reports `cache: up`, `down` or `disabled`; only the database affects the status code.

## 8. Doctor role

`users.role` is `patient` or `doctor`. `doctor_patients` is the authorisation list: listing returns
only the doctor's assignments, and opening a report first checks for the row, returning 403 if it
is missing. The report itself is fetched through the same `getReport` service, so there is no
second copy of the aggregation logic.

Assignment is by email: `POST /doctor/patients { email }` finds a patient and inserts with
`ON CONFLICT DO NOTHING`. An unknown email returns 404, which does reveal whether an address
belongs to a patient. That is acceptable here and would need an invitation flow in a real product.

## 9. Client

| Path | Access | Page |
|---|---|---|
| `/login`, `/register` | public, redirect if logged in | auth pages |
| `/` | any user | dashboard |
| `/reports` | any user | reports |
| `/patients` | doctor | doctor workspace |
| `*` | public | 404 |

`AuthProvider` holds the only cross-page state, so there is no Redux or Zustand. It restores the
session with `/auth/me` and exposes `login`, `register` and `logout`. `ProtectedRoute` handles the
three states: restoring, redirect to `/login` with the intended location, and optional role check.

`api/client.js` is the only place that knows about tokens, JSON and error shapes. It attaches the
bearer token, turns a network failure into an `ApiError`, and maps API errors to a message the
form can display next to the field.

`ReportPanel` is shared by the patient and doctor views. It owns the type tabs, the date input,
loading, error and empty states, the stat cards and the chart. `ReadingForm` mirrors the server's
value and date checks for instant feedback and shows server messages (duplicate slot, four per
day) in the same place. Filled slots are disabled when adding.

Styling is one stylesheet with CSS variables, no framework, so every rule is readable. Values are
colour-coded low (below 70), in range, and high (above 180). The layout is responsive at 1020, 900
and 640 px.

## 10. Testing

Server, 61 tests:

| File | Focus |
|---|---|
| `unit/dates.test.js` | ranges, labels, leap year, year boundary, ISO validation |
| `unit/readings.validation.test.js` | every message, boundaries, normalisation |
| `integration/auth.test.js` | register, hash storage, duplicate email, login, `/me` |
| `integration/readings.test.js` | CRUD, isolation, the rules, pagination |
| `integration/reports.test.js` | stats, rounding, three ranges, empty period |
| `integration/doctor.test.js` | role guard, assignment, report, cross-doctor isolation |
| `integration/reminder.test.js` | incomplete selection, zero readings, idempotency |

Integration tests use a real `sweety_test` database. `tests/helpers/db.js` applies the schema once
and truncates `users` between tests; the cascade clears dependent tables. Files run sequentially
because they share one database. Redis is disabled so results are deterministic.

Client, 6 tests in `ReadingForm.test.jsx`: inputs render, required value, out-of-range value,
successful submit with a numeric payload, API error shown, filled slots disabled.

## 11. Running

Local:

```
docker compose up -d db redis
npm run db:setup && npm run db:seed
npm run dev            # API :4000, Vite :5173
npm run worker         # optional
```

Docker:

```
client (nginx :8080) -> api (:4000) -> db (5432)
                            `-------> redis (6379) <-- worker
```

`api` waits for healthy `db` and `redis`, runs `db:setup`, then starts. `worker` waits for the same
services and registers the cron. `client` is built with `VITE_API_URL=/api`; nginx proxies `/api`
and falls back to `index.html` for client routes.

| Situation | Behaviour |
|---|---|
| Redis down | one warning, cache becomes a no-op, health shows `cache: down` |
| Database down | health returns 503, requests fail |
| Two API instances | advisory locks are in the database, so the rules still hold |
| Job retry | the reminder upsert is idempotent |
| Browser refresh on `/reports` | nginx `try_files` serves the SPA |
| Missing `JWT_SECRET` in production | the process refuses to start |

### Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `ECONNREFUSED 5432` | database not running | `docker compose up -d db` |
| `database "sweety" does not exist` | setup not run | `npm run db:setup` |
| Tests cannot connect | no test database | `npm run db:setup` |
| "Could not reach the server" | API not running or wrong URL | start the API; use the proxy locally |
| `cache: down` | Redis not running | start Redis or clear `REDIS_URL` |
| Worker exits with a Redis error | `REDIS_URL` missing | start Redis; the worker needs it |
| Docker client returns 502 on `/api` | API still starting | check `docker compose logs api` |

## 12. Decisions

| Decision | Why | Cost |
|---|---|---|
| PostgreSQL with raw SQL | reports are aggregates, and every query is visible | row mapping by hand |
| One idempotent schema file | simple for a reviewer, safe to re-run | no migrations |
| JWT in `localStorage` | simple, survives reload, easy to test | exposed to XSS |
| Service and controller split | rules are testable, HTTP stays thin | more files |
| Advisory lock plus DB trigger | correct under concurrency, friendly messages first | three layers for one rule |
| Stats computed in SQL | exact rounding, smaller payloads | database does the work |
| Readings included in every report | the chart reuses them, one shape | slightly larger responses |
| Redis optional | the app runs with PostgreSQL alone | cache can be silently off |
| Separate worker | cron runs once, not once per API replica | one more process |
| One stylesheet | readable, no build step | no utility classes |
| UTC calendar dates | unambiguous storage | wrong "today" far from UTC |
| Seed relative to today | demos always have data | not reproducible by date |

## 13. Assumptions

1. A reading belongs to a calendar day; no clock time is stored.
2. "Today" is the server's UTC date.
3. Monthly means the full previous month.
4. The four-per-day rule is redundant with four unique slots, but the brief asks for it.
5. A user is a doctor or a patient, not both.
6. Doctors are assigned by email; the seed assigns two patients.
7. Demo values and target bands are illustrative, not medical advice.
8. No email verification or password reset is in scope.

## 14. Future work

- httpOnly cookies with refresh rotation, login rate limiting and lockout.
- TypeScript with a shared Zod contract instead of hand-written request shapes.
- A paginated reading-history screen, using the pagination the API already has.
- Cache tests against a real Redis, with hit and miss counts.
- A small admin view for `reminder_logs`, retries and job metrics.
- Doctor invitations, consent and access revocation.
- Playwright end-to-end tests and CI running tests and builds.
- Per-user timezones and configurable target ranges.
