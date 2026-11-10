// T054: helpers for calendar days. A "day" is a calendar day in Europe/Vienna (see diary views).
const VIENNA_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Vienna",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today in Vienna as YYYY-MM-DD. */
export function todayInVienna(now = new Date()) {
  return VIENNA_DAY.format(now);
}
