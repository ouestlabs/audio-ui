import { createFileRoute, notFound } from "@tanstack/react-router";
import { Suspense } from "react";
import { DEVICES } from "../devices.ts";

export const Route = createFileRoute("/$device")({
  component: DevicePage,
  head: ({ params }) => {
    const device = DEVICES.find((item) => item.slug === params.device);
    return {
      links: device?.style ? [{ href: device.style, rel: "stylesheet" }] : [],
      meta: [{ title: device?.title ?? "audio/ui lab" }],
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
