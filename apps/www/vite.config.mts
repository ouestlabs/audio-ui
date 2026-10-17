import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { fumadocsMdx } from "fumadocs-mdx/vite";
import { defineConfig } from "vite";
import { prerenderPages } from "./scripts/site-paths";

// The TanStack Start app, run on Cloudflare's runtime in dev as in production.
// It lives beside the Next.js app (src/app) until every route has moved.
// Changes on every build, so the registry's addresses are a new cache key on every deploy.
const deploymentId =
  process.env.GITHUB_SHA ?? process.env.WORKERS_CI_COMMIT_SHA ?? Date.now().toString(36);

export default defineConfig({
  define: {
    "import.meta.env.VITE_DEPLOYMENT_ID": JSON.stringify(deploymentId),
  },
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    fumadocsMdx(),
    tailwindcss(),
    tanstackStart({
      // Every page is built to HTML once, here, and served as a static file: no Worker runs for a page.
      pages: prerenderPages(),
      prerender: {
        // knob.html, served at /knob: the address has no trailing slash, as the canonical one.
        autoSubfolderIndex: false,
        concurrency: 8,
        crawlLinks: true,
        enabled: true,
        failOnError: true,
        retryCount: 2,
      },
    }),
    react(),
  ],
  // Every route is an entry, so Vite finds all the dependencies at start, not one page at a time.
  optimizeDeps: {
    entries: ["src/router.tsx", "src/routes/**/*.tsx"],
  },
  resolve: { dedupe: ["react", "react-dom"], tsconfigPaths: true },
  server: { port: 4300 },
});
