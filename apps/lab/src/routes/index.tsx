import { createFileRoute, Link } from "@tanstack/react-router";
import { DEVICES } from "../devices.ts";
import {
  absoluteUrl,
  jsonLd,
  pageHead,
  SITE,
  websiteJsonLd,
} from "../lib/seo.ts";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    ...pageHead("/", {
      description: SITE.description,
      title: "Audio interfaces you can play",
    }),
    scripts: [
      jsonLd(websiteJsonLd),
      jsonLd({
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        isPartOf: { "@id": SITE.url },
        mainEntity: {
          "@type": "ItemList",
          itemListElement: DEVICES.map((device, index) => ({
            "@type": "ListItem",
            name: device.title,
            position: index + 1,
            url: absoluteUrl(`/${device.slug}`),
          })),
        },
        name: SITE.name,
        url: SITE.url,
      }),
    ],
  }),
});

function Home() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 p-10">
      <h1 className="font-semibold text-2xl">audio/ui lab</h1>
      <p className="text-white/60">
        Devices built with audio/ui, running on the sources of this repository.
      </p>
      <ul className="grid gap-3">
        {DEVICES.map((device) => (
          <li key={device.slug}>
            <Link
              className="block rounded-lg border border-white/10 p-4 transition-colors hover:bg-white/5"
              params={{ device: device.slug }}
              to="/$device"
            >
              <span className="block font-medium">{device.title}</span>
              <span className="block text-sm text-white/60">
                {device.description}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
