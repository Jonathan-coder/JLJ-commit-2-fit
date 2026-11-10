// T050: database access for the food diary (US17).
// Nutrition values of products are stored per 100 g; the views intake_entries and
// daily_intake_totals (migration 1794336100000) calculate the intake per entry and per day.
// A "day" is a calendar day in Europe/Vienna.
import { pool } from "../db.js";

export const MEALS = ["breakfast", "lunch", "dinner", "snack"];
const DAY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
// ISO 8601 date-time with time zone, e.g. 2026-11-10T07:30:00+01:00 or ...Z
const TIMESTAMP_REGEX = /^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;
const MAX_INT4 = 2147483647;

// Start and end of a Vienna calendar day as timestamptz, so the index on
// (user_id, consumed_at) can be used.
const DAY_RANGE = `
  consumed_at >= ($2::date::timestamp AT TIME ZONE 'Europe/Vienna')
  AND consumed_at < (($2::date + 1)::timestamp AT TIME ZONE 'Europe/Vienna')`;

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

// Date.parse() is lenient (it accepts 2026-02-30 and rolls it over to 2 March), but PostgreSQL rejects
// such a date with an error that would end up as HTTP 500. So the date is checked with a round trip.
function isRealDay(day) {
  if (typeof day !== "string" || !DAY_REGEX.test(day)) return false;
  const parsed = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day;
}

function isValidTimestamp(value) {
  if (typeof value !== "string") return false;
  const match = TIMESTAMP_REGEX.exec(value);
  return match !== null && isRealDay(match[1]) && !Number.isNaN(Date.parse(value));
}

function assertDay(day, name = "date") {
  if (!isRealDay(day)) {
    throw badRequest(`${name} must be a date in the format YYYY-MM-DD`);
  }
}

function toNumber(value) {
  return value === null || value === undefined ? 0 : Number(value);
}

function formatDay(value) {
  if (typeof value === "string") return value.slice(0, 10);
  const pad = (n) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function mapEntry(row) {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    brand: row.brand,
    meal: row.meal,
    amountG: toNumber(row.amount_g),
    consumedAt: row.consumed_at,
    day: formatDay(row.day),
    kcal: toNumber(row.kcal),
    protein: toNumber(row.protein),
    carbs: toNumber(row.carbs),
    fat: toNumber(row.fat),
  };
}

function mapTotals(row, day) {
  return {
    day: row ? formatDay(row.day) : day,
    entries: row ? row.entries : 0,
    kcal: toNumber(row?.kcal),
    protein: toNumber(row?.protein),
    carbs: toNumber(row?.carbs),
    fat: toNumber(row?.fat),
  };
}

/** Add an entry to the diary of a user. Returns the entry including calculated nutrients. */
export async function addEntry(userId, { productId, amountG, meal = "snack", consumedAt } = {}) {
  if (!Number.isInteger(productId) || productId <= 0 || productId > MAX_INT4) {
    throw badRequest("productId must be a positive integer");
  }
  if (typeof amountG !== "number" || !Number.isFinite(amountG) || amountG <= 0) {
    throw badRequest("amountG must be a positive number");
  }
  if (!MEALS.includes(meal)) {
    throw badRequest(`meal must be one of: ${MEALS.join(", ")}`);
  }
  if (consumedAt !== undefined && !isValidTimestamp(consumedAt)) {
    throw badRequest("consumedAt must be an ISO 8601 date/time with time zone, e.g. 2026-11-10T07:30:00+01:00");
  }

  const product = await pool.query("SELECT 1 FROM products WHERE id = $1", [productId]);
  if (product.rows.length === 0) {
    const error = new Error("Product not found");
    error.statusCode = 404;
    throw error;
  }

  const inserted = await pool.query(
    `INSERT INTO intake_logs (user_id, product_id, amount_g, meal, consumed_at)
     VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, NOW()))
     RETURNING id`,
    [userId, productId, amountG, meal, consumedAt ?? null]
  );
  const result = await pool.query("SELECT * FROM intake_entries WHERE id = $1", [inserted.rows[0].id]);
  return mapEntry(result.rows[0]);
}

/** All entries of one day, ordered by time. */
export async function getEntriesForDay(userId, day) {
  assertDay(day);
  const result = await pool.query(
    `SELECT * FROM intake_entries
     WHERE user_id = $1 AND ${DAY_RANGE}
     ORDER BY consumed_at ASC, id ASC`,
    [userId, day]
  );
  return result.rows.map(mapEntry);
}

/** Sum of kcal and macros for one day (zeros if nothing was logged). */
export async function getDailyTotals(userId, day) {
  assertDay(day);
  const result = await pool.query(
    "SELECT * FROM daily_intake_totals WHERE user_id = $1 AND day = $2::date",
    [userId, day]
  );
  return mapTotals(result.rows[0], day);
}

/** Totals per day for a period (inclusive), e.g. for the weekly history. Days without entries are omitted. */
export async function getTotalsForRange(userId, from, to) {
  assertDay(from, "from");
  assertDay(to, "to");
  if (from > to) throw badRequest("from must not be after to");
  const result = await pool.query(
    `SELECT * FROM daily_intake_totals
     WHERE user_id = $1 AND day BETWEEN $2::date AND $3::date
     ORDER BY day ASC`,
    [userId, from, to]
  );
  return result.rows.map((row) => mapTotals(row));
}

/** Diary of one day: entries grouped by meal plus the day totals. */
export async function getDiary(userId, day) {
  const [entries, totals] = await Promise.all([getEntriesForDay(userId, day), getDailyTotals(userId, day)]);
  const meals = Object.fromEntries(MEALS.map((meal) => [meal, entries.filter((e) => e.meal === meal)]));
  return { day, totals, meals };
}

/** Delete an entry. Only the owner can delete it. Returns true if an entry was deleted. */
export async function deleteEntry(userId, entryId) {
  const result = await pool.query("DELETE FROM intake_logs WHERE id = $1 AND user_id = $2", [entryId, userId]);
  return result.rowCount === 1;
}
