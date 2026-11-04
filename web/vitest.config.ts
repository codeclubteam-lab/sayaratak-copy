import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/animation-event.ts", "tests/setup.ts"],
    // The form-step tests are slow when 40 files run at once.
    testTimeout: 15_000,
  },
})
