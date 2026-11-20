import express from "express";
import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { asyncHandler, requireAuth } from "../middleware/auth.js";
import { emailExists, createUser, findUserWithPasswordByEmail } from "../repositories/users.js";

const router = express.Router();
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function readPassword(body) {
  return typeof body?.password === "string" ? body.password : "";
}

function session(user) {
  const token = jwt.sign({ sub: user.id }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
    jwtid: randomUUID(),
  });
  return { token, user: { id: user.id, email: user.email } };
}

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = readPassword(req.body);

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: "A valid email is required" });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters long" });
    }

    if (await emailExists(email)) {
      return res.status(409).json({ error: "User already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await createUser(email, passwordHash);
    return res.status(201).json(session(user));
  })
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = readPassword(req.body);

    const user = await findUserWithPasswordByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    return res.json(session(user));
  })
);

// requireAuth has already loaded the user from the database.
router.get("/me", requireAuth, (req, res) => {
  res.json(req.user);
});

export default router;
