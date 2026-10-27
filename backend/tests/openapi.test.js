import test from "node:test";
import SwaggerParser from "@apidevtools/swagger-parser";
import { fileURLToPath } from "node:url";

test("openapi.yaml is a valid OpenAPI document", async () => {
  const specPath = fileURLToPath(new URL("../openapi.yaml", import.meta.url));
  await SwaggerParser.validate(specPath);
});
