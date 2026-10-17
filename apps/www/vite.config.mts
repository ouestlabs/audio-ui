import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { fumadocsMdx } from "fumadocs-mdx/vite";
import { defineConfig } from "vite";

// The TanStack Start app, run on Cloudflare's runtime in dev as in production.
// It lives beside the Next.js app (src/app) until every route has moved.
export default defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    fumadocsMdx(),
    tailwindcss(),
    tanstackStart(),
    react(),
  ],
  resolve: { tsconfigPaths: true },
  server: { port: 4300 },
});
