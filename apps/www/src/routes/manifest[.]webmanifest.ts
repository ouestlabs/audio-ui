import { createFileRoute } from "@tanstack/react-router";
import { META_THEME_COLORS, siteConfig } from "@/lib/config";

const manifest = {
  background_color: META_THEME_COLORS.light,
  description: siteConfig.description,
  display: "standalone",
  icons: [
    { purpose: "any", sizes: "32x32", src: "/icon.png", type: "image/png" },
    {
      purpose: "maskable",
      sizes: "512x512",
      src: "/icon-512.png",
      type: "image/png",
    },
  ],
  name: siteConfig.name,
  scope: "/",
  short_name: siteConfig.name,
  start_url: "/",
  theme_color: META_THEME_COLORS.dark,
};

export const Route = createFileRoute("/manifest.webmanifest")({
  server: {
    handlers: {
      GET: () =>
        new Response(JSON.stringify(manifest), {
          headers: { "Content-Type": "application/manifest+json" },
        }),
    },
  },
});
