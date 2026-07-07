import type { MetadataRoute } from "next";

import { META_THEME_COLORS, siteConfig } from "@/lib/config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: META_THEME_COLORS.light,
    description: siteConfig.description,
    display: "standalone",
    icons: [
      {
        purpose: "any",
        sizes: "32x32",
        src: "/icon",
        type: "image/png",
      },
    ],
    name: siteConfig.name,
    scope: "/",
    short_name: siteConfig.name,
    start_url: "/",
    theme_color: META_THEME_COLORS.dark,
  };
}
