// T079: database access for users. Routes and middleware call these functions and contain no SQL.
import { pool } from "../db.js";

function mapUser(row) {
  return { id: row.id, email: row.email, createdAt: row.created_at };
}

/** User by id (without password hash), or null. */
export async function findUserById(id) {
  const result = await pool.query("SELECT id, email, created_at FROM users WHERE id = $1", [id]);
  return result.rows.length === 0 ? null : mapUser(result.rows[0]);
}

/** User including the password hash for the login check, or null. E-mail is compared case-insensitively. */
export async function findUserWithPasswordByEmail(email) {
  const result = await pool.query(
    "SELECT id, email, password_hash, created_at FROM users WHERE lower(email) = lower($1)",
    [email]
  );
  if (result.rows.length === 0) return null;
  return { ...mapUser(result.rows[0]), passwordHash: result.rows[0].password_hash };
}

/** True if a user with this e-mail exists (case-insensitive). */
export async function emailExists(email) {
  const result = await pool.query("SELECT 1 FROM users WHERE lower(email) = lower($1)", [email]);
  return result.rows.length > 0;
}

/** Create a user. The caller hashes the password. */
export async function createUser(email, passwordHash) {
  const result = await pool.query(
    "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at",
    [email, passwordHash]
  );
  return mapUser(result.rows[0]);
}
