# Sweety

A blood glucose tracker for the Kenpath Junior Full Stack Developer assignment. A patient
registers, records up to four readings a day, and reviews daily, month-to-date and monthly
reports. A doctor account can read the reports of patients assigned to it.

**Stack:** Node.js + Express · PostgreSQL · React (Vite) · Redis · BullMQ · Docker

![Login screen](docs/screenshots/01-login.png)

## Contents

- [Features](#features)
- [Screenshots](#screenshots)
- [Project structure](#project-structure)
- [Quick start](#quick-start)
- [Demo accounts](#demo-accounts)
- [Environment variables](#environment-variables)
- [Database](#database)
- [Tests](#tests)
- [Docker](#docker)
- [API](#api)
- [Reports](#reports)
- [Notes](#notes)

## Features

Required:

- Register with name, email and password; passwords are stored as bcrypt hashes only.
- Log in with a JWT. Every reading query is scoped to the logged-in user.
- Add, view, edit and delete readings in four fixed slots: morning (fasting), after breakfast,
  after lunch, after dinner.
- Validation with the assignment's messages: value required, 40–600 mg/dl, one reading per slot
  per day, maximum four a day, no future dates.
- Daily report with highest, lowest, average (one decimal), count and the day's readings.
- Month-to-date report, from the 1st to the selected day.
- Monthly report for the full previous month.
- Friendly empty states when a period has no readings.
- Seed script with two demo patients, one doctor and several weeks of readings.

Bonus:

- Pagination on `GET /readings` with page/limit metadata.
- Recharts line chart of the month.
- Docker Compose for the whole stack.
- React Testing Library tests for the reading form.
- Redis cache for report responses, cleared when a reading changes.
- BullMQ daily reminder for patients with fewer than four readings.
- Doctor role that can view assigned patients' reports.

## Screenshots

| Dashboard | Monthly report |
|---|---|
| ![Dashboard](docs/screenshots/03-dashboard.png) | ![Monthly report](docs/screenshots/08-reports-monthly.png) |

| Doctor workspace | Mobile |
|---|---|
| ![Doctor workspace](docs/screenshots/09-doctor-patients.png) | ![Mobile dashboard](docs/screenshots/10-dashboard-mobile.png) |

The remaining screenshots, including the validation error and all three report tabs, are in
[`docs/screenshots`](docs/screenshots).

## Project structure

```
server/
  src/
    config/env.js        environment variables, resolved once
    db/                  pool, schema.sql, setup.js, seed.js
    lib/                 ApiError, logger, bcrypt helpers, Redis cache
    middleware/          requireAuth, requireRole, 404 and error handling
    modules/             auth, readings, reports, doctor
    jobs/                BullMQ queue, worker, reminder scan
    app.js               Express app, exported without a port for tests
    server.js            process entry, graceful shutdown
  tests/                 unit and integration tests

client/
  src/
    api/client.js        fetch wrapper, token handling, API errors
    context/             auth state and session restore
    components/          layout, forms, report panel, chart, modal
    pages/               login, register, dashboard, reports, doctor, 404
    styles.css           one stylesheet with CSS variables

docs/                    engineering guide, screenshots, generated PDF
scripts/                 PDF builder, screenshot capture
docker-compose.yml
```

`docs/DOCUMENTATION.md` covers the architecture and the reasoning. This README is the setup guide.

## Quick start

Prerequisites: Node.js 20 or newer, npm 10, and Docker Desktop (for PostgreSQL 16 and Redis 7).
You can also use a local PostgreSQL 16 and Redis 7 instead.

```bash
# 1. dependencies
npm install

# 2. environment
cp .env.example .env            # Windows: Copy-Item .env.example .env
#    change JWT_SECRET before using this anywhere except localhost

# 3. PostgreSQL and Redis
docker compose up -d db redis

# 4. create sweety and sweety_test, apply the schema
npm run db:setup

# 5. demo users and readings
npm run db:seed

# 6. API on :4000, client on :5173
npm run dev
```

- Web app: http://localhost:5173
- API: http://localhost:4000/api
- Health: http://localhost:4000/api/health

Vite proxies `/api` to Express, so there is no CORS setup in development.

The reminder worker is optional:

```bash
npm run worker     # BullMQ worker with the daily cron schedule
npm run job:run    # run one reminder scan now
```

The API runs without Redis or the worker. The report cache is simply disabled.

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Patient | `demo@sweety.app` | `Demo1234!` |
| Patient | `priya@sweety.app` | `Demo1234!` |
| Doctor | `doctor@sweety.app` | `Doctor1234!` |

The seed gives the first patient about 50 days of readings and the second about 24, leaves some
days incomplete so the reminder job has work to do, and assigns both patients to the doctor.
The login page also has demo buttons.

## Environment variables

All variables are listed in [`.env.example`](.env.example).

| Variable | Default | Used by | Meaning |
|---|---|---|---|
| `NODE_ENV` | `development` | server | `production` enables strict secret checks |
| `PORT` | `4000` | server | API port |
| `DATABASE_URL` | `postgres://sweety:sweety@localhost:5432/sweety` | server | application database |
| `TEST_DATABASE_URL` | `postgres://sweety:sweety@localhost:5432/sweety_test` | tests | test database |
| `JWT_SECRET` | development value | server | token signing secret |
| `JWT_EXPIRES_IN` | `7d` | server | token lifetime |
| `BCRYPT_ROUNDS` | `10` (4 in tests) | server | hashing cost |
| `CLIENT_ORIGIN` | `http://localhost:5173` | server | allowed CORS origins, comma separated |
| `REDIS_URL` | `redis://localhost:6379` | cache, worker | leave empty to disable both |
| `REPORT_CACHE_TTL_SECONDS` | `300` | cache | report cache lifetime |
| `ENABLE_REMINDER_JOB` | `false` | worker | register the repeatable cron scan |
| `REMINDER_CRON` | `0 8 * * *` | worker | when the daily scan runs |
| `VITE_API_URL` | empty | client | empty uses the Vite proxy; `/api` in Docker |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | `sweety` | compose | database container defaults |

The server loads `.env` from the repository root first, then `server/.env`, which overrides it.
Tests set `NODE_ENV=test`, use `TEST_DATABASE_URL` and disable Redis.

## Database

Schema: [`server/src/db/schema.sql`](server/src/db/schema.sql).
Seed: [`server/src/db/seed.js`](server/src/db/seed.js).

```
users (id, name, email, password_hash, role, created_at)
  |--< readings (id, user_id, reading_date, slot, value, created_at, updated_at)
  |              UNIQUE (user_id, reading_date, slot)
  |              CHECK value BETWEEN 40 AND 600
  |              trigger: at most four readings per user per day
  |--< doctor_patients (doctor_id, patient_id)
  `--< reminder_logs (user_id, log_date, reading_count, message)
```

Rules are checked twice. The service returns the assignment's messages, and the database
constraints (`UNIQUE`, `CHECK`, and a trigger) make invalid data impossible if a request races
another one.

```bash
npm run db:setup   # create both databases and apply the schema
npm run db:seed    # recreate the demo users and their readings
```

To inspect the database:

```bash
docker exec -it sweety-db psql -U sweety -d sweety
```

## Tests

```bash
npm test             # 61 server tests + 6 client tests
npm run test:server
npm run test:client
```

Run `npm run db:setup` once first; the tests use `sweety_test`, a real PostgreSQL database, not
mocks.

The server suite covers password hashing, duplicate email, login failure, `/me`, reading CRUD,
ownership isolation, every validation message, the four-per-day limit, pagination, all three
report ranges, doctor access, and reminder idempotency. The client suite covers the reading form:
rendering, required value, the 40–600 range, a successful submit, an API error, and disabled
slots.

## Docker

```bash
docker compose up --build
```

Compose needs `JWT_SECRET` in `.env` and stops with a clear message if it is missing.

| Service | Role |
|---|---|
| `client` | http://localhost:8080, nginx serving the SPA and proxying `/api` |
| `api` | http://localhost:4000, runs `db:setup` then the server |
| `worker` | BullMQ reminder worker with the cron enabled |
| `db` | PostgreSQL 16 on 5432 |
| `redis` | Redis 7 on 6379 |

The client is built with `VITE_API_URL=/api`. Data lives in the `sweety_pgdata` volume. Seed data
is not loaded automatically:

```bash
docker compose exec api node src/db/seed.js
```

To run only the support services for local development:

```bash
docker compose up -d db redis
```

To stop:

```bash
docker compose down      # keep the data
docker compose down -v   # delete the volume
```

## API

Base URL `/api`. Authenticated routes need `Authorization: Bearer <token>`.

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/auth/register` | create a patient account, returns `{ user, token }` |
| `POST` | `/auth/login` | log in, returns `{ user, token }` |
| `GET` | `/auth/me` | current user, used to restore a session |
| `GET` | `/readings?date=&page=&limit=` | paginated readings, optional day filter |
| `POST` | `/readings` | create a reading |
| `PUT` | `/readings/:id` | update a reading |
| `DELETE` | `/readings/:id` | delete a reading |
| `GET` | `/reports?type=daily\|mtd\|monthly&date=YYYY-MM-DD` | report with stats and readings |
| `GET` | `/doctor/patients` | assigned patients |
| `POST` | `/doctor/patients` | assign a patient by email |
| `GET` | `/doctor/patients/:id/reports` | a patient's report for the doctor |
| `GET` | `/health` | database and cache status |

Errors always have the same shape. Validation errors add the field:

```json
{
  "message": "Value must be between 40 and 600 mg/dl.",
  "code": "validation_error",
  "details": { "field": "value" }
}
```

[`docs/DOCUMENTATION.md`](docs/DOCUMENTATION.md) lists every endpoint, status code and error code.

## Reports

All three reports return the same shape:

```json
{
  "report": {
    "type": "mtd",
    "label": "1 Oct – 15 Oct 2026",
    "range": { "start": "2026-10-01", "end": "2026-10-15" },
    "stats": { "count": 42, "highest": 179, "lowest": 66, "average": 134.7 },
    "readings": [{ "id": "…", "date": "2026-10-15", "slot": "morning", "value": 105 }]
  }
}
```

For a selected date of 15 Oct 2026:

| `type` | Range | Label |
|---|---|---|
| `daily` | 15 Oct 2026 | `15 Oct 2026` |
| `mtd` | 1 Oct 2026 → 15 Oct 2026 | `1 Oct – 15 Oct 2026` |
| `monthly` | 1 Sep 2026 → 30 Sep 2026 | `1 Sep – 30 Sep 2026` |

The average is rounded to one decimal in SQL. An empty period returns `count: 0`, null stats and
an empty list, and the client shows an empty state instead of zeroes.

Dates are calendar dates (`YYYY-MM-DD`) handled in UTC, so a date never shifts across timezones.

Pagination:

```json
{
  "readings": [ … ],
  "pagination": { "page": 2, "limit": 10, "total": 83, "totalPages": 9 }
}
```

`page` must be at least 1 and `limit` between 1 and 100. Readings are ordered newest first, then
by slot.

Report responses are cached under `sweety:reports:<userId>:<type>:<date>` for 300 seconds. Every
reading write deletes `sweety:reports:<userId>:*`. If Redis is unavailable the API reads from
PostgreSQL and continues.

## Notes

Assumptions:

1. A reading is a calendar day, not an instant. Dates are `YYYY-MM-DD` and PostgreSQL `DATE`
   values are parsed back as strings. "Today" is the server's UTC date; a real product would use
   each user's timezone.
2. The four-per-day limit is redundant with four unique slots, but it is implemented because the
   assignment asks for it, and the UI uses it to disable adding.
3. The monthly report is the whole previous month, not the last 30 days.
4. A reading has no clock time. The slot is the time context.
5. The JWT is stored in `localStorage`. That is simple and testable, but readable by injected
   JavaScript; production would use an httpOnly cookie, refresh tokens and CSRF protection.
6. Session restore calls `/auth/me` once. The role in the token is not trusted.
7. Doctor assignment is by email, done by a doctor. There is no invitation flow or admin role.
8. Seed dates are relative to today so reports are never empty. Re-running the seed recreates the
   three demo accounts.

With more time I would:

- Move auth to httpOnly cookies with refresh rotation, and add rate limiting and lockout on login.
- Share types between client and server, with TypeScript and Zod, instead of hand-written contracts.
- Add a paginated "all readings" screen; the API already supports it but the UI fetches one day.
- Test the cache against a real Redis, including hit and miss behaviour.
- Add Playwright tests for login, add reading and report, and run them in CI with the unit tests.
- Give each user a timezone and make "today" depend on it.

## Documentation

- [`docs/DOCUMENTATION.md`](docs/DOCUMENTATION.md): architecture, data model, endpoint
  reference, decisions and tradeoffs.
- [`docs/Sweety-Documentation.pdf`](docs/Sweety-Documentation.pdf): the same material as a PDF.

Regenerate the PDF after changing code or docs:

```bash
npm run docs:pdf    # HTML and PDF
npm run docs:html   # HTML only
```

It prints the HTML to PDF with the installed Microsoft Edge or Chrome.

To refresh the screenshots, with the API and Vite running:

```bash
npm run screenshots
```
