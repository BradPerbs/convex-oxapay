import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test"] } },
    onConsoleLog(log) {
      if (log.startsWith("Convex functions should not directly call other Convex functions")) {
        return false;
      }
      return undefined;
    },
    coverage: {
      provider: "v8",
      include: ["src/component/**", "src/client/**"],
      exclude: [
        "src/**/_generated/**",
        "src/component/convex.config.ts",
        "**/*.d.ts",
        "**/*.test.ts",
      ],
    },
  },
});
