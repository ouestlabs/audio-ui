import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    tanstackStart({
      // Every page is built to HTML once and served as a static file; the lab's pages are found from its links.
      pages: [{ path: "/" }, { path: "/robots.txt" }, { path: "/sitemap.xml" }],
      prerender: {
        autoSubfolderIndex: false,
        crawlLinks: true,
        enabled: true,
        failOnError: true,
      },
    }),
    viteReact(),
  ],
});

export default config;
