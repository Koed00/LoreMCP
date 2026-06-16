/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  mutate: [
    "src/core/classify-structure.ts",
    "src/core/format-response.ts",
  ],
  testRunner: "vitest",
  vitest: {
    configFile: "vitest.config.ts",
  },
  reporters: ["progress", "clear-text"],
  coverageAnalysis: "perTest",
  thresholds: { high: 80, low: 60, break: 80 },
  timeoutMS: 60000,
  concurrency: 2,
};
