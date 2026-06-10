import { defineConfig } from "vitest/config";
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.test.toml" },
        miniflare: {
          bindings: { JWT_SECRET: "test-jwt-secret-32-bytes-padding!!" },
        },
      },
    },
    include: ["tests/**/*.test.ts"],
  },
});
