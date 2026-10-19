import pg from "pg";

export const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://postgres:pw@localhost:5432/commit2fit",
});

export async function initDb() {
  await pool.query(`
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    user_code UUID UNIQUE NOT NULL,
    height_cm REAL,
    weight_kg REAL,
    age INT,
    sex VARCHAR(10),
    activity_level VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT now()
  )
`);
}