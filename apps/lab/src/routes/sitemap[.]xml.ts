import { createFileRoute } from "@tanstack/react-router";
import { DEVICES } from "../devices.ts";
import { absoluteUrl } from "../lib/seo.ts";

/** The home and every device: a new device folder is listed with no other change. */
function sitemap() {
  const urls = ["/", ...DEVICES.map((device) => `/${device.slug}`)]
    .map((path) => `  <url><loc>${absoluteUrl(path)}</loc></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: () =>
        new Response(sitemap(), {
          headers: { "Content-Type": "application/xml; charset=utf-8" },
        }),
    },
  },
});
