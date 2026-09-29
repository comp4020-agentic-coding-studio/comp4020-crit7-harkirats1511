import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        // Engine/seed/service unit tests: each file uses its own temp DB, no server.
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
        },
      },
      {
        // Black-box spec: all files share one temp DB and one built server, so run one file at a time.
        test: {
          name: "spec",
          include: ["spec/**/*.test.ts"],
          globalSetup: ["./spec/global-setup.ts"],
          fileParallelism: false,
        },
      },
    ],
  },
});
