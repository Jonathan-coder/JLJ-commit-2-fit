// T054: REST endpoints for the daily diary (US17) on top of the diary repository (T050).
import express from "express";
import { requireAuth, asyncHandler } from "../middleware/auth.js";
import { getDiary, getTotalsForRange } from "../repositories/diary.js";
import { todayInVienna } from "../utils/date.js";

const router = express.Router();

// Diary of one day: totals + entries grouped by meal. Without ?date= it is today (Vienna).
router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const date = req.query.date === undefined ? todayInVienna() : req.query.date;
    return res.json(await getDiary(req.userId, date));
  })
);

// Totals per day for the history view (US09). Days without entries are omitted.
router.get(
  "/totals",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { from, to } = req.query;
    const days = await getTotalsForRange(req.userId, from, to);
    return res.json({ from, to, days });
  })
);

export default router;
