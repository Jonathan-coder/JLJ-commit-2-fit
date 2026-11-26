-- T092: fasting sessions per user, so the fasting timer is the same on every device (F07, F11, US11).
-- Interval fasting (16:8, 18:6, 20:4): start + planned end.
-- Ramadan (T077): first and last day plus the daily fasting window (from/to), no planned end.
-- ended_at IS NULL = the session is still running; a user can have only one running session.
-- All required fields are checked with IS NOT NULL, because a CHECK with NULL would pass.
-- Up Migration
CREATE TABLE IF NOT EXISTS fasting_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  planned_end TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  ramadan_first_day DATE,
  ramadan_last_day DATE,
  fast_from TIME,
  fast_to TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fasting_sessions_model_check CHECK (model IN ('16:8', '18:6', '20:4', 'Ramadan')),
  CONSTRAINT fasting_sessions_fields_check CHECK (
    (model = 'Ramadan'
      AND planned_end IS NULL
      AND ramadan_first_day IS NOT NULL AND ramadan_last_day IS NOT NULL
      AND ramadan_last_day >= ramadan_first_day
      AND fast_from IS NOT NULL AND fast_to IS NOT NULL AND fast_to > fast_from)
    OR
    (model <> 'Ramadan'
      AND planned_end IS NOT NULL AND planned_end > started_at
      AND ramadan_first_day IS NULL AND ramadan_last_day IS NULL
      AND fast_from IS NULL AND fast_to IS NULL)
  ),
  CONSTRAINT fasting_sessions_end_check CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS fasting_sessions_one_active_idx
  ON fasting_sessions (user_id)
  WHERE ended_at IS NULL;

CREATE INDEX IF NOT EXISTS fasting_sessions_user_started_idx
  ON fasting_sessions (user_id, started_at DESC);

-- Down Migration
DROP TABLE IF EXISTS fasting_sessions;
