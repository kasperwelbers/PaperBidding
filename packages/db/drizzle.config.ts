import { defineConfig } from "drizzle-kit";

// Generates SQL migrations from src/schema.ts into ./migrations.
// They are applied with wrangler (see apps/api: db:migrate:local / db:migrate:remote)
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/schema.ts",
  out: "./migrations",
});
