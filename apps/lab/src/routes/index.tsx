import { createFileRoute, Link } from "@tanstack/react-router";
import { cn } from "cn";
import { FrameContent, frameClassName } from "@/components/site/layout/frame";
import { DEVICES, groupByCategory } from "@/lib/devices";
import { absoluteUrl, jsonLd, pageHead, SITE, websiteJsonLd } from "../lib/seo";

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
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 p-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-semibold text-2xl">audio/ui lab</h1>
        <p className="max-w-2xl text-muted-foreground">
          Devices built with audio/ui, running on the sources of this
          repository.
        </p>
      </div>
      {groupByCategory(DEVICES).map((group) => (
        <section className="flex flex-col gap-4" key={group.category}>
          <h2 className="font-medium text-muted-foreground text-sm">
            {group.category}
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {group.devices.map((device) => (
              <li key={device.slug}>
                <Link
                  className={cn(
                    frameClassName,
                    "transition-[filter] duration-200 hover:drop-shadow-lg"
                  )}
                  params={{ device: device.slug }}
                  to="/$device"
                >
                  <FrameContent>
                    <img
                      alt={`${device.title}, preview`}
                      className="aspect-1200/630 w-full object-cover"
                      height={630}
                      loading="lazy"
                      src={device.preview ?? "/og/default.png"}
                      width={1200}
                    />
                  </FrameContent>
                  <span className="flex flex-col gap-1 p-3">
                    <span className="font-medium">{device.title}</span>
                    <span className="text-muted-foreground text-sm">
                      {device.description}
                    </span>
                    {device.uses.length > 0 ? (
                      <span className="mt-1 flex flex-wrap gap-1">
                        {device.uses.map((name) => (
                          <span
                            className="rounded-md border bg-background px-1.5 py-0.5 text-muted-foreground text-xs"
                            key={name}
                          >
                            {name}
                          </span>
                        ))}
                      </span>
                    ) : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
