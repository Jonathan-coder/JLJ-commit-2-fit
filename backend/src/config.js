import dotenv from "dotenv";

dotenv.config();

const LOCAL_DB = "postgresql://postgres:pw@localhost:5432/commit2fit";
const LOCAL_TEST_DB = "postgresql://postgres:pw@localhost:5432/commit2fit_test";

/**
 * Settings from environment variables, with local defaults.
 * A function (instead of reading process.env directly) so every default can be tested (T082).
 */
export function loadConfig(env, warn = console.warn) {
  const mode = env.NODE_ENV || "development";

  if (!env.JWT_SECRET && mode !== "test") {
    warn("JWT_SECRET not set, using a local fallback. Configure .env before production use.");
  }

  const databaseUrl = env.DATABASE_URL || LOCAL_DB;
  const testDatabaseUrl = env.TEST_DATABASE_URL || LOCAL_TEST_DB;

  return {
    mode,
    port: Number(env.PORT || 3000),
    jwtSecret: env.JWT_SECRET || (mode === "test" ? "test-secret" : "development-secret"),
    jwtExpiresIn: env.JWT_EXPIRES_IN || "7d",
    databaseUrl,
    testDatabaseUrl,
    // Tests always use the separate test database.
    connectionString: mode === "test" ? testDatabaseUrl : databaseUrl,
  };
}

export const config = loadConfig(process.env);
