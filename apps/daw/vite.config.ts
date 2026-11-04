import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    tanstackStart({
      // The app is one page, built to HTML once; everything after it runs in the browser.
      pages: [{ path: "/" }],
      prerender: {
        autoSubfolderIndex: false,
        enabled: true,
        failOnError: true,
      },
    }),
    viteReact(),
  ],
  server: {
    // As in production (public/_headers): isolated, so the engine shares memory with its worklets.
    headers: {
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin",
    },
  },
});

export default config;
