import jwt from "jsonwebtoken";
import { pool } from "../db.js";
import { config } from "../config.js";

export function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const token = header.slice(7).trim();

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    const result = await pool.query(
      "SELECT id, email FROM users WHERE id = $1",
      [decoded.sub]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Authentication failed" });
    }

    req.user = { id: result.rows[0].id, email: result.rows[0].email };
    req.userId = result.rows[0].id;
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
