// T054: REST endpoints for the intake log (US08) on top of the diary repository (T050).
import express from "express";
import { requireAuth, asyncHandler } from "../middleware/auth.js";
import { addEntry, getEntriesForDay, deleteEntry } from "../repositories/diary.js";
import { todayInVienna } from "../utils/date.js";

const router = express.Router();
const MAX_INT4 = 2147483647;

router.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { productId, amountG, meal, consumedAt } = req.body || {};
    const entry = await addEntry(req.userId, { productId, amountG, meal, consumedAt });
    return res.status(201).json(entry);
  })
);

router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const date = req.query.date === undefined ? todayInVienna() : req.query.date;
    const items = await getEntriesForDay(req.userId, date);
    return res.json({ date, items });
  })
);

router.delete(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const raw = String(req.params.id);
    const id = Number(raw);
    if (!/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(id) || id > MAX_INT4) {
      return res.status(400).json({ error: "id must be a positive integer" });
    }

    const deleted = await deleteEntry(req.userId, id);
    if (!deleted) {
      return res.status(404).json({ error: "Entry not found" });
    }
    return res.status(204).end();
  })
);

export default router;
