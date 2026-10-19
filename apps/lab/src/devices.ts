import { type ComponentType, lazy } from "react";

/**
 * A device is a folder of `components/devices/<slug>/`: `meta.json` (a `title`, a `description`, a `category` and the `uses`:
 * the audio/ui components it is made of), `index.tsx` (the device, as the default export, with its own `h1`) and
 * optionally `index.css` and `og.png` (its social image, 1200x630). Adding the folder adds the page and its link.
 */
const metas = import.meta.glob<{
  category?: string;
  description: string;
  title: string;
  uses?: string[];
}>("./components/devices/*/meta.json", { eager: true, import: "default" });
const loaders = import.meta.glob<{ default: ComponentType }>(
  "./components/devices/*/index.tsx"
);
const styles = import.meta.glob<string>("./components/devices/*/index.css", {
  eager: true,
  import: "default",
  query: "?url",
});

const images = import.meta.glob<string>("./components/devices/*/og.png", {
  eager: true,
  import: "default",
  query: "?url",
});

const slugOf = (path: string) => path.split("/")[3] ?? "";

export const DEVICES = Object.entries(metas)
  .map(([path, meta]) => {
    const slug = slugOf(path);
    const base = `./components/devices/${slug}`;
    const load = loaders[`${base}/index.tsx`];
    return {
      category: meta.category ?? "Other",
      Component: load ? lazy(load) : null,
      description: meta.description,
      image: images[`${base}/og.png`],
      slug,
      style: styles[`${base}/index.css`],
      title: meta.title,
      uses: meta.uses ?? [],
    };
  })
  .filter((device) => device.Component)
  .sort((a, b) => a.title.localeCompare(b.title));

export type Device = (typeof DEVICES)[number];

/** The devices that match a search: in their title, description, category or components. */
export function searchDevices(query: string) {
  const words = query.toLowerCase().split(" ").filter(Boolean);
  return DEVICES.filter((device) => {
    const text =
      `${device.title} ${device.description} ${device.category} ${device.uses.join(" ")}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}

/** Devices by category, the categories in alphabetical order. */
export function groupByCategory(devices: readonly Device[]) {
  const groups = new Map<string, Device[]>();
  for (const device of devices) {
    groups.set(device.category, [
      ...(groups.get(device.category) ?? []),
      device,
    ]);
  }
  return [...groups]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, items]) => ({ category, devices: items }));
}
