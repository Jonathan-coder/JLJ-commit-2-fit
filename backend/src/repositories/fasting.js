// T092: database access for fasting sessions (F07, US11), so the timer is the same on every device (F11).
// Interval fasting (16:8, 18:6, 20:4) has a start and a planned end. Ramadan (T077) has a first and
// a last day plus the daily fasting window. A user can have only one running session at a time.
import { pool } from "../db.js";

export const INTERVAL_HOURS = { "16:8": 16, "18:6": 18, "20:4": 20 };
export const MODELS = [...Object.keys(INTERVAL_HOURS), "Ramadan"];
const DAY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
// ISO 8601 date-time with time zone, e.g. 2026-11-26T20:00:00+01:00 or ...Z
const TIMESTAMP_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

// A real calendar day (rejects e.g. 2027-02-30, which Date.parse would roll over).
function isRealDay(day) {
  if (typeof day !== "string" || !DAY_REGEX.test(day)) return false;
  const parsed = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day;
}

function isValidTimestamp(value) {
  return typeof value === "string" && TIMESTAMP_REGEX.test(value) && !Number.isNaN(Date.parse(value));
}

// pg returns DATE as a Date object (local midnight) and TIME as "HH:MM:SS".
function formatDay(value) {
  if (value === null) return null;
  const pad = (n) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function formatTime(value) {
  return value === null ? null : value.slice(0, 5);
}

function mapSession(row) {
  return {
    id: row.id,
    model: row.model,
    startedAt: row.started_at,
    plannedEnd: row.planned_end,
    endedAt: row.ended_at,
    active: row.ended_at === null,
    ramadanFirstDay: formatDay(row.ramadan_first_day),
    ramadanLastDay: formatDay(row.ramadan_last_day),
    from: formatTime(row.fast_from),
    to: formatTime(row.fast_to),
  };
}

function validateRamadan({ firstDay, lastDay, from, to }) {
  if (!isRealDay(firstDay) || !isRealDay(lastDay)) {
    throw httpError(400, "firstDay and lastDay must be dates in the format YYYY-MM-DD");
  }
  if (lastDay < firstDay) throw httpError(400, "lastDay must not be before firstDay");
  if (!TIME_REGEX.test(from ?? "") || !TIME_REGEX.test(to ?? "")) {
    throw httpError(400, "from and to must be times in the format HH:MM");
  }
  if (to <= from) throw httpError(400, "to must be after from");
}

/**
 * Start a fasting session.
 * Interval: { model: "16:8" | "18:6" | "20:4", startedAt? } – the planned end is start + 16/18/20 hours.
 * Ramadan:  { model: "Ramadan", firstDay, lastDay, from, to, startedAt? }.
 * startedAt is optional (default: now). A second running session is rejected with statusCode 409.
 */
export async function startSession(userId, input = {}) {
  const { model, startedAt } = input;
  if (!MODELS.includes(model)) throw httpError(400, `model must be one of: ${MODELS.join(", ")}`);
  if (startedAt !== undefined && !isValidTimestamp(startedAt)) {
    throw httpError(400, "startedAt must be an ISO 8601 date/time with time zone");
  }
  const ramadan = model === "Ramadan";
  if (ramadan) validateRamadan(input);

  try {
    const result = await pool.query(
      `INSERT INTO fasting_sessions
         (user_id, model, started_at, planned_end, ramadan_first_day, ramadan_last_day, fast_from, fast_to)
       VALUES ($1, $2, COALESCE($3::timestamptz, NOW()),
               CASE WHEN $4::int IS NULL THEN NULL
                    ELSE COALESCE($3::timestamptz, NOW()) + make_interval(hours => $4::int) END,
               $5::date, $6::date, $7::time, $8::time)
       RETURNING *`,
      [
        userId,
        model,
        startedAt ?? null,
        ramadan ? null : INTERVAL_HOURS[model],
        ramadan ? input.firstDay : null,
        ramadan ? input.lastDay : null,
        ramadan ? input.from : null,
        ramadan ? input.to : null,
      ]
    );
    return mapSession(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") throw httpError(409, "A fasting session is already running");
    throw error;
  }
}

/** The running session of a user, or null. */
export async function getActiveSession(userId) {
  const result = await pool.query(
    "SELECT * FROM fasting_sessions WHERE user_id = $1 AND ended_at IS NULL",
    [userId]
  );
  return result.rows.length === 0 ? null : mapSession(result.rows[0]);
}

/** Stop the running session (endedAt optional, default now). Returns the ended session or null if none was running. */
export async function endSession(userId, endedAt) {
  if (endedAt !== undefined && !isValidTimestamp(endedAt)) {
    throw httpError(400, "endedAt must be an ISO 8601 date/time with time zone");
  }
  const result = await pool.query(
    `UPDATE fasting_sessions
     SET ended_at = GREATEST(started_at, COALESCE($2::timestamptz, NOW()))
     WHERE user_id = $1 AND ended_at IS NULL
     RETURNING *`,
    [userId, endedAt ?? null]
  );
  return result.rows.length === 0 ? null : mapSession(result.rows[0]);
}

/** Past and running sessions of a user, newest first (limit 1-100, default 20). */
export async function listSessions(userId, limit = 20) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw httpError(400, "limit must be a whole number between 1 and 100");
  }
  const result = await pool.query(
    "SELECT * FROM fasting_sessions WHERE user_id = $1 ORDER BY started_at DESC, id DESC LIMIT $2",
    [userId, limit]
  );
  return result.rows.map(mapSession);
}
