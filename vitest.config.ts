import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// Dedicated Vitest config — intentionally minimal to avoid loading the full
// Vite app plugin chain (lovable-tagger, PWA, etc.) which caused worker OOM.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    css: false,
    // Single forked process — avoids tinypool spawning multiple heavy workers
    // and keeps memory usage bounded in CI containers.
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
        minForks: 1,
        maxForks: 1,
      },
    },
    isolate: false,
    maxConcurrency: 1,
    fileParallelism: false,
    server: {
      deps: {
        // Inline these to prevent jsdom/transform memory spikes from
        // re-resolving large ESM graphs per test file.
        inline: [
          "embla-carousel-react",
          "embla-carousel-autoplay",
          "@testing-library/react",
        ],
      },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
