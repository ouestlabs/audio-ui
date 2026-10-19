import { createFileRoute, notFound } from "@tanstack/react-router";
import { Suspense } from "react";
import { DEVICES } from "@/lib/devices";
import { absoluteUrl, jsonLd, pageHead, SITE } from "../lib/seo";

export const Route = createFileRoute("/$device")({
  component: DevicePage,
  head: ({ params }) => {
    const device = DEVICES.find((item) => item.slug === params.device);
    if (!device) {
      return pageHead(`/${params.device}`, {
        description: "This address is not a device of the lab.",
        robots: "noindex",
        title: "Device not found",
      });
    }
    const path = `/${device.slug}`;
    const head = pageHead(path, {
      description: device.description,
      image: device.image,
      title: device.title,
    });
    return {
      ...head,
      links: [
        ...head.links,
        ...(device.style ? [{ href: device.style, rel: "stylesheet" }] : []),
      ],
      scripts: [
        jsonLd({
          "@context": "https://schema.org",
          "@type": "WebPage",
          breadcrumb: {
            "@type": "BreadcrumbList",
            itemListElement: [
              {
                "@type": "ListItem",
                item: SITE.url,
                name: SITE.name,
                position: 1,
              },
              {
                "@type": "ListItem",
                item: absoluteUrl(path),
                name: device.title,
                position: 2,
              },
            ],
          },
          description: device.description,
          isPartOf: { "@id": SITE.url },
          name: device.title,
          url: absoluteUrl(path),
        }),
      ],
    };
  },
  loader: ({ params }) => {
    if (!DEVICES.some((item) => item.slug === params.device)) {
      throw notFound();
    }
  },
});

function DevicePage() {
  const { device } = Route.useParams();
  const Component = DEVICES.find((item) => item.slug === device)?.Component;
  return Component ? (
    <Suspense>
      <Component />
    </Suspense>
  ) : null;
}
