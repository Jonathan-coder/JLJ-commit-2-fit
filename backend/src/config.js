import dotenv from "dotenv";

dotenv.config();

const envMode = process.env.NODE_ENV || "development";
const fallbackJwtSecret = envMode === "test" ? "test-secret" : "development-secret";
const jwtSecret = process.env.JWT_SECRET || fallbackJwtSecret;

if (!process.env.JWT_SECRET && envMode !== "test") {
  console.warn("JWT_SECRET not set, using a local fallback. Configure .env before production use.");
}

export const config = {
  port: Number(process.env.PORT || 3000),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  databaseUrl: process.env.DATABASE_URL || "postgresql://postgres:pw@localhost:5432/commit2fit",
  testDatabaseUrl: process.env.TEST_DATABASE_URL || "postgresql://postgres:pw@localhost:5432/commit2fit_test",
};
