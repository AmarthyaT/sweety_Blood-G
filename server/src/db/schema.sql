-- ---------------------------------------------------------------------------
-- Sweety database schema
-- Safe to run repeatedly: every object is created only when missing.
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'patient'
                  CHECK (role IN ('patient', 'doctor')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Case-insensitive uniqueness even if a caller forgets to lowercase an email.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique
  ON users (LOWER(email));

CREATE TABLE IF NOT EXISTS readings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  reading_date DATE NOT NULL,
  slot         TEXT NOT NULL
                 CHECK (slot IN ('morning', 'after_breakfast', 'after_lunch', 'after_dinner')),
  value        INTEGER NOT NULL
                 CHECK (value BETWEEN 40 AND 600),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Database-level guarantee of "one reading per slot per day".
  CONSTRAINT readings_user_date_slot_unique UNIQUE (user_id, reading_date, slot)
);

CREATE INDEX IF NOT EXISTS readings_user_date_idx
  ON readings (user_id, reading_date DESC);

-- Defence in depth for "maximum four readings per day". With only four allowed
-- slots the unique constraint already caps a day at four rows; this trigger
-- keeps the explicit rule if more slots are ever added. The API's per-user/day
-- advisory lock is the real concurrency guard.
CREATE OR REPLACE FUNCTION enforce_daily_reading_limit()
RETURNS TRIGGER AS $$
DECLARE
  reading_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO reading_count
  FROM readings
  WHERE user_id = NEW.user_id
    AND reading_date = NEW.reading_date
    AND (TG_OP = 'INSERT' OR id <> NEW.id);

  IF reading_count >= 4 THEN
    RAISE EXCEPTION 'Maximum 4 readings per day'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS readings_daily_limit ON readings;
CREATE TRIGGER readings_daily_limit
  BEFORE INSERT OR UPDATE OF user_id, reading_date ON readings
  FOR EACH ROW
  EXECUTE FUNCTION enforce_daily_reading_limit();

-- Keep updated_at accurate without relying on every caller.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS readings_set_updated_at ON readings;
CREATE TRIGGER readings_set_updated_at
  BEFORE UPDATE ON readings
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Doctor <-> patient assignment. A doctor can see the reports of the
-- patients listed here.
CREATE TABLE IF NOT EXISTS doctor_patients (
  doctor_id  UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (doctor_id, patient_id),
  CONSTRAINT doctor_patients_not_self CHECK (doctor_id <> patient_id)
);

CREATE INDEX IF NOT EXISTS doctor_patients_patient_idx
  ON doctor_patients (patient_id);

-- Output of the daily reminder background job. The unique constraint makes
-- the job idempotent if BullMQ retries it.
CREATE TABLE IF NOT EXISTS reminder_logs (
  id            BIGSERIAL PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  log_date      DATE NOT NULL,
  reading_count INTEGER NOT NULL,
  message       TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT reminder_logs_user_date_unique UNIQUE (user_id, log_date)
);

CREATE INDEX IF NOT EXISTS reminder_logs_date_idx ON reminder_logs (log_date);
