export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  if (err && err.statusCode) {
    return res.status(err.statusCode).json({ error: err.message || "Request failed" });
  }

  if (err && err.code === "23505") {
    return res.status(409).json({ error: "Resource already exists" });
  }

  console.error(err);
  return res.status(500).json({ error: "Internal server error" });
}
