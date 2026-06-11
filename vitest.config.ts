import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "tests/**/*.steps.ts",
      "tests/**/*.test.ts",
      "tests/**/*.spec.ts",
    ],
    testTimeout: 15000,
  },
});
