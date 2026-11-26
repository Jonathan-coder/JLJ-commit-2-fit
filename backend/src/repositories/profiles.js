// T091: database access for user profiles (body data for the daily target, F06, US07).
// The field names are the ones the frontend already uses (frontend/js/api.js, T097):
// { sex: "male" | "female", age, height, weight, activityLevel: 0-3, goal: "lose" | "maintain" | "gain" }
import { pool } from "../db.js";

export const SEXES = ["male", "female"];
export const GOALS = ["lose", "maintain", "gain"];
// Same limits as the database constraints (migration 1794336400000) and the frontend.
const LIMITS = {
  age: [12, 100],
  height: [120, 230],
  weight: [35, 250],
  activityLevel: [0, 3],
};

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function inRange(value, [min, max]) {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function mapProfile(row) {
  return {
    sex: row.sex,
    age: row.age,
    height: Number(row.height_cm),
    weight: Number(row.weight_kg),
    activityLevel: row.activity_level,
    goal: row.goal,
    updatedAt: row.updated_at,
  };
}

/** Check a profile from the client. Throws an error with statusCode 400 for the first invalid field. */
export function validateProfile(input) {
  const p = input ?? {};
  if (!SEXES.includes(p.sex)) throw badRequest(`sex must be one of: ${SEXES.join(", ")}`);
  if (!Number.isInteger(p.age) || !inRange(p.age, LIMITS.age)) {
    throw badRequest("age must be a whole number between 12 and 100");
  }
  if (!inRange(p.height, LIMITS.height)) throw badRequest("height must be a number between 120 and 230 (cm)");
  if (!inRange(p.weight, LIMITS.weight)) throw badRequest("weight must be a number between 35 and 250 (kg)");
  if (!Number.isInteger(p.activityLevel) || !inRange(p.activityLevel, LIMITS.activityLevel)) {
    throw badRequest("activityLevel must be 0, 1, 2 or 3");
  }
  if (!GOALS.includes(p.goal)) throw badRequest(`goal must be one of: ${GOALS.join(", ")}`);
  return {
    sex: p.sex,
    age: p.age,
    height: p.height,
    weight: p.weight,
    activityLevel: p.activityLevel,
    goal: p.goal,
  };
}

/** Profile of a user, or null if the user has not saved one yet. */
export async function getProfile(userId) {
  const result = await pool.query("SELECT * FROM user_profiles WHERE user_id = $1", [userId]);
  return result.rows.length === 0 ? null : mapProfile(result.rows[0]);
}

/** Create or replace the profile of a user (one profile per user). Returns the saved profile. */
export async function saveProfile(userId, input) {
  const p = validateProfile(input);
  const result = await pool.query(
    `INSERT INTO user_profiles (user_id, sex, age, height_cm, weight_kg, activity_level, goal)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id) DO UPDATE SET
       sex = EXCLUDED.sex,
       age = EXCLUDED.age,
       height_cm = EXCLUDED.height_cm,
       weight_kg = EXCLUDED.weight_kg,
       activity_level = EXCLUDED.activity_level,
       goal = EXCLUDED.goal,
       updated_at = NOW()
     RETURNING *`,
    [userId, p.sex, p.age, p.height, p.weight, p.activityLevel, p.goal]
  );
  return mapProfile(result.rows[0]);
}
