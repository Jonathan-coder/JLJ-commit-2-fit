import pg from "pg";
import { config } from "./config.js";

export const pool = new pg.Pool({ connectionString: config.connectionString });

/** Empty all tables. Only allowed in tests, so development data cannot be deleted by mistake. */
export async function resetTables(mode = process.env.NODE_ENV) {
  if (mode !== "test") {
    throw new Error("resetTables() can only be used when NODE_ENV=test");
  }

  await pool.query("TRUNCATE TABLE intake_logs, products, users RESTART IDENTITY CASCADE");
}
