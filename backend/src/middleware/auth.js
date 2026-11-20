import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { findUserById } from "../repositories/users.js";

export function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }

  // Node trims trailing spaces of header values, so "Bearer " always carries a token here.
  const token = header.slice(7).trim();

  let decoded;
  try {
    decoded = jwt.verify(token, config.jwtSecret);
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  // A database error is not hidden as 401: it goes to the error handler (500).
  const user = await findUserById(decoded.sub);
  if (!user) {
    return res.status(401).json({ error: "Authentication failed" });
  }

  req.user = user;
  req.userId = user.id;
  return next();
});
