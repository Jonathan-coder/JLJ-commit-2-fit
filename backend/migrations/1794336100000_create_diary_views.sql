-- T050: diary views. Nutrition values in products are stored per 100 g,
-- so the intake of an entry is value * amount_g / 100.
-- Days are calculated in the Europe/Vienna time zone (consumed_at is TIMESTAMPTZ).
-- Up Migration
CREATE OR REPLACE VIEW intake_entries AS
SELECT
  l.id,
  l.user_id,
  l.product_id,
  p.name AS product_name,
  p.brand,
  l.meal,
  l.amount_g,
  l.consumed_at,
  (l.consumed_at AT TIME ZONE 'Europe/Vienna')::date AS day,
  ROUND(p.kcal    * l.amount_g / 100, 1) AS kcal,
  ROUND(p.protein * l.amount_g / 100, 1) AS protein,
  ROUND(p.carbs   * l.amount_g / 100, 1) AS carbs,
  ROUND(p.fat     * l.amount_g / 100, 1) AS fat
FROM intake_logs l
JOIN products p ON p.id = l.product_id;

CREATE OR REPLACE VIEW daily_intake_totals AS
SELECT
  user_id,
  day,
  COUNT(*)::int AS entries,
  ROUND(SUM(kcal), 1)    AS kcal,
  ROUND(SUM(protein), 1) AS protein,
  ROUND(SUM(carbs), 1)   AS carbs,
  ROUND(SUM(fat), 1)     AS fat
FROM intake_entries
GROUP BY user_id, day;

-- Down Migration
DROP VIEW IF EXISTS daily_intake_totals;
DROP VIEW IF EXISTS intake_entries;
