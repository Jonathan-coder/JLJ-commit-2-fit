-- T057: every diary entry belongs to a meal (the frontend groups entries by meal)
-- Up Migration
ALTER TABLE intake_logs
  ADD COLUMN meal TEXT NOT NULL DEFAULT 'snack';

ALTER TABLE intake_logs
  ADD CONSTRAINT intake_logs_meal_check
  CHECK (meal IN ('breakfast', 'lunch', 'dinner', 'snack'));

-- Down Migration
ALTER TABLE intake_logs DROP CONSTRAINT IF EXISTS intake_logs_meal_check;
ALTER TABLE intake_logs DROP COLUMN IF EXISTS meal;
