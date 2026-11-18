import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import vue from "@vitejs/plugin-vue";
import { fumadocsMdx } from "fumadocs-mdx/vite";
import { defineConfig } from "vite";
import { prerenderPages } from "./scripts/site-paths.mts";

// The TanStack Start app, run on Cloudflare's runtime in dev as in production.
// It lives beside the Next.js app (src/app) until every route has moved.
// Changes on every build, so the registry's addresses are a new cache key on every deploy.
// The REST API and its catalog answer from the Worker, with their own headers:
// the crawler follows the docs' links to them, and must not bake them into files.
const WORKER_ONLY = /^\/(api|\.well-known\/api-catalog)(\/|$)/;

const deploymentId =
  process.env.GITHUB_SHA ??
  process.env.WORKERS_CI_COMMIT_SHA ??
  Date.now().toString(36);

const SDK_VARIANTS = ["parameter-field", "rocker-switch"];

export default defineConfig({
  define: {
    "import.meta.env.VITE_DEPLOYMENT_ID": JSON.stringify(deploymentId),
  },
  plugins: [
    // The console is not piped to the server: its stream stays open and the tab never reads as loaded.
    devtools({ consolePiping: { enabled: false } }),
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    fumadocsMdx(),
    svelte(),
    vue(),
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
        filter: ({ path }) => !WORKER_ONLY.test(path),
        retryCount: 2,
      },
    }),
    react(),
  ],
  // The source is public, so its maps can be too: served beside the chunks, they
  // let PostHog read an error's frames with no upload step. Only an open DevTools loads them.
  environments: { client: { build: { sourcemap: true } } },
  // Every route is an entry, so Vite finds all the dependencies at start, not one page at a time.
  optimizeDeps: {
    entries: ["src/router.tsx", "src/routes/**/*.tsx"],
  },
  resolve: {
    // The demos of Vue and Svelte are not read by the TypeScript paths the dependency scan uses.
    alias: [
      // The site is built on ui-sdk: the items that name a behavior library resolve to its variants.
      ...SDK_VARIANTS.map((name) => ({
        find: `@/components/audio-ui/${name}`,
        replacement: fileURLToPath(
          new URL(
            `./src/registry/bases/ui-sdk/audio/elements/${name}.tsx`,
            import.meta.url
          )
        ),
      })),
      {
        find: "@/registry",
        replacement: fileURLToPath(new URL("./src/registry", import.meta.url)),
      },
    ],
    dedupe: ["react", "react-dom"],
    tsconfigPaths: true,
  },
  server: { port: 4000 },
});
