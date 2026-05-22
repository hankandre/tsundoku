import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

const env = loadEnv("", process.cwd(), "");
const apiTarget = env.PUBLIC_API_URL;
if (!apiTarget) {
  throw new Error(
    "PUBLIC_API_URL is not set. Copy .env.example to .env and set it (e.g. http://localhost:6060).",
  );
}

// Why bits-ui / @lucide/svelte need optimizeDeps + ssr tweaks:
//   Both packages ship `.svelte` files via barrel exports. In this monorepo,
//   those deps are hoisted to the workspace root (`/node_modules/`), and Vite's
//   default optimizeDeps invokes esbuild on bare-specifier imports — esbuild
//   can't handle `.svelte` files and aborts. shadcn-svelte's own docs/vite.config.ts
//   solves this the same way (ssr.noExternal: Object.keys(devDependencies)).
//   Both packages are at latest (bits-ui 2.18+, @lucide/svelte 1.16+); this is
//   a monorepo hoisting interaction, not a library-staleness issue.
//   A non-monorepo SvelteKit app (e.g. shadcn-svelte's registry-template) needs
//   no such config.
export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  optimizeDeps: {
    exclude: ["bits-ui", "@lucide/svelte"],
  },
  ssr: {
    noExternal: ["bits-ui", "@lucide/svelte"],
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
      },
      "/ws": {
        target: apiTarget,
        ws: true,
        changeOrigin: true,
      },
    },
  },
  test: {
    include: ["src/**/*.{test,spec}.{js,ts}"],
  },
});
