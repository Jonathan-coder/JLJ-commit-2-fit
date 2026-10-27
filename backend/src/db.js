import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const defaultDatabaseUrl =
  process.env.NODE_ENV === "test"
    ? "postgresql://postgres:pw@localhost:5432/commit2fit_test"
    : "postgresql://postgres:pw@localhost:5432/commit2fit";

export const pool = new pg.Pool({
  connectionString:
    process.env.NODE_ENV === "test"
      ? process.env.TEST_DATABASE_URL || defaultDatabaseUrl
      : process.env.DATABASE_URL || defaultDatabaseUrl,
});

export async function initDb() {
  return Promise.resolve();
}

export async function resetTables() {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("resetTables() can only be used when NODE_ENV=test");
  }

  await pool.query(
    "TRUNCATE TABLE intake_logs, products, users RESTART IDENTITY CASCADE"
  );
}
