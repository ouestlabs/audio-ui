import {
  createFileRoute,
  Link,
  useHydrated,
  useNavigate,
} from "@tanstack/react-router";
import { cn } from "cn";
import { useCallback } from "react";
import { GalleryFilters } from "@/components/site/gallery/filters";
import { FrameContent, frameClassName } from "@/components/site/layout/frame";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  DEVICES,
  type DeviceFilter,
  filterDevices,
  groupByCategory,
} from "@/lib/devices";
import { absoluteUrl, jsonLd, pageHead, SITE, websiteJsonLd } from "../lib/seo";

const NO_FILTER: DeviceFilter = {};
/** A filter's value from the address: a word, or nothing when it is absent or empty. */
const text = (value: unknown) =>
  typeof value === "string" && value !== "" ? value : undefined;

export const Route = createFileRoute("/")({
  component: Home,
  // The gallery's filters live in the address, so a filtered view can be shared: `/?collection=shadcn-styles`.
  validateSearch: (search: Record<string, unknown>): DeviceFilter => ({
    category: text(search.category),
    collection: text(search.collection),
    q: text(search.q),
  }),
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
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  // The page is prerendered with no filter: until it hydrates, it shows what the HTML shows, then the address's filter.
  const filter = useHydrated() ? search : NO_FILTER;
  const devices = filterDevices(filter);
  const filtered = Boolean(filter.q || filter.category || filter.collection);

  const setFilter = useCallback(
    (next: DeviceFilter) =>
      navigate({
        replace: true,
        resetScroll: false,
        search: {
          category: next.category,
          collection: next.collection,
          q: next.q || undefined,
        },
      }),
    [navigate]
  );
  const clear = useCallback(() => setFilter(NO_FILTER), [setFilter]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-semibold text-2xl">audio/ui lab</h1>
        <p className="max-w-2xl text-muted-foreground">
          Devices built with audio/ui, running on the sources of this
          repository.
        </p>
      </div>
      <GalleryFilters filter={filter} onChange={setFilter} />
      <div className="flex items-center gap-3 text-muted-foreground text-sm">
        <p role="status">
          {filtered
            ? `${devices.length} of ${DEVICES.length} devices`
            : `${DEVICES.length} devices`}
        </p>
        {filtered ? (
          <Button onClick={clear} size="sm" variant="link">
            Clear filters
          </Button>
        ) : null}
      </div>
      {devices.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No device matches</EmptyTitle>
            <EmptyDescription>
              Try other words, or another collection or category.
            </EmptyDescription>
          </EmptyHeader>
          <Button onClick={clear} size="sm" variant="outline">
            Clear filters
          </Button>
        </Empty>
      ) : null}
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {groupByCategory(devices).flatMap((group) =>
          group.devices.map((device) => (
            <li className="flex" key={device.slug}>
              <Link
                className={cn(
                  frameClassName,
                  "flex flex-1 flex-col transition-[filter] duration-200 hover:drop-shadow-lg"
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
                <span className="flex flex-1 flex-col gap-1 p-3">
                  <span className="text-muted-foreground text-xs">
                    {device.collection
                      ? `${group.category} · ${device.collection}`
                      : group.category}
                  </span>
                  <span className="font-medium">{device.title}</span>
                  <span className="text-muted-foreground text-sm">
                    {device.description}
                  </span>
                  {device.uses.length > 0 ? (
                    <span className="mt-auto flex flex-wrap gap-1 pt-1">
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
          ))
        )}
      </ul>
    </div>
  );
}
