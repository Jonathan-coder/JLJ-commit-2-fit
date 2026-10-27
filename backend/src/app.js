import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import YAML from "yaml";
import authRoutes from "./routes/auth.js";
import productRoutes from "./routes/products.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();
app.use(cors());
app.use(express.json());

const specPath = fileURLToPath(new URL("../openapi.yaml", import.meta.url));
const spec = YAML.parse(fs.readFileSync(specPath, "utf8"));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(spec));
app.get("/openapi.json", (_req, res) => {
  res.json(spec);
});
app.use("/auth", authRoutes);
app.use("/products", productRoutes);
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});
app.use(errorHandler);

export default app;
