-- T090: body data per user for the daily target and the warnings (F06, US07).
-- One row per user; the value ranges are the same as in the frontend (state.js).
-- Up Migration
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  sex TEXT NOT NULL,
  age INTEGER NOT NULL,
  height_cm NUMERIC(5,1) NOT NULL,
  weight_kg NUMERIC(5,1) NOT NULL,
  activity_level SMALLINT NOT NULL,
  goal TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_profiles_sex_check CHECK (sex IN ('male', 'female')),
  CONSTRAINT user_profiles_age_check CHECK (age BETWEEN 12 AND 100),
  CONSTRAINT user_profiles_height_check CHECK (height_cm BETWEEN 120 AND 230),
  CONSTRAINT user_profiles_weight_check CHECK (weight_kg BETWEEN 35 AND 250),
  CONSTRAINT user_profiles_activity_check CHECK (activity_level BETWEEN 0 AND 3),
  CONSTRAINT user_profiles_goal_check CHECK (goal IN ('lose', 'maintain', 'gain'))
);

-- Down Migration
DROP TABLE IF EXISTS user_profiles;
