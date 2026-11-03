import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  const migrations = await readD1Migrations(
    path.join(import.meta.dirname, "../../packages/db/migrations"),
  );
  return {
    plugins: [
      cloudflareTest({
        // remote bindings (Workers AI) are not available in tests
        remoteBindings: false,
        wrangler: { configPath: "../../wrangler.jsonc" },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            ENVIRONMENT: "test",
            SUPERADMIN: "super@example.com",
            BETTER_AUTH_SECRET: "test-secret-that-is-long-enough-for-better-auth",
            BETTER_AUTH_URL: "http://localhost",
            SCW_SECRET_KEY: "",
            SCW_PROJECT_ID: "",
            SCW_REGION: "",
            EMAIL_FROM: "",
          },
        },
      }),
    ],
    test: {
      setupFiles: ["./test/apply-migrations.ts"],
    },
  };
});
