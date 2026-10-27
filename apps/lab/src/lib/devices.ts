import { type ComponentType, lazy } from "react";

/**
 * A device is a folder of `components/devices/<slug>/`. Adding the folder adds
 * its page, its link, its card and its place in the sitemap.
 *
 * What the lab reads, at the root of the folder:
 * - `meta.json`: a `title`, a `description`, a `category`, the `uses` (the
 *   audio/ui components it is made of) and, optionally, the `collection` it
 *   belongs to (a series, such as the devices named after the shadcn styles)
 * - `index.tsx`: the device, as the default export, with its own `h1`; it only
 *   composes the panel
 * - `index.css` (optional): its style
 * - `preview.png` (optional): a capture of the device, 1200x630: the gallery
 *   shows it, and the social image generated at build frames it
 *
 * What a device keeps for itself, by role, with the same names in each one:
 * - `audio/`: the sound, with no React (`engine.ts`, and what it plays, such as `presets.ts`)
 * - `ui/`: the pieces of the panel (a dial, a slider, a screen)
 * - `use-<name>.ts`: what the panel reads and calls, which joins `ui/` to `audio/`
 */
const metas = import.meta.glob<{
  category?: string;
  collection?: string;
  description: string;
  title: string;
  uses?: string[];
}>("../components/devices/*/meta.json", { eager: true, import: "default" });
const loaders = import.meta.glob<{ default: ComponentType }>(
  "../components/devices/*/index.tsx"
);
const styles = import.meta.glob<string>("../components/devices/*/index.css", {
  eager: true,
  import: "default",
  query: "?url",
});

const previews = import.meta.glob<string>(
  "../components/devices/*/preview.png",
  {
    eager: true,
    import: "default",
    query: "?url",
  }
);

const slugOf = (path: string) => path.split("/")[3] ?? "";

export const DEVICES = Object.entries(metas)
  .map(([path, meta]) => {
    const slug = slugOf(path);
    const base = `../components/devices/${slug}`;
    const load = loaders[`${base}/index.tsx`];
    return {
      category: meta.category ?? "Other",
      collection: meta.collection ?? null,
      Component: load ? lazy(load) : null,
      description: meta.description,
      image: `/og/${slug}.png`,
      preview: previews[`${base}/preview.png`],
      slug,
      style: styles[`${base}/index.css`],
      title: meta.title,
      uses: meta.uses ?? [],
    };
  })
  .filter((device) => device.Component)
  .sort((a, b) => a.title.localeCompare(b.title));

export type Device = (typeof DEVICES)[number];

/** The devices that match a search: in their title, description, category, collection or components. */
export function searchDevices(query: string) {
  const words = query.toLowerCase().split(" ").filter(Boolean);
  return DEVICES.filter((device) => {
    const text =
      `${device.title} ${device.description} ${device.category} ${device.collection ?? ""} ${device.uses.join(" ")}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}

/** A category or a collection as it reads in an address: `Drum machines` is `drum-machines`. */
export const paramOf = (name: string) =>
  name.toLowerCase().replaceAll(" ", "-");

const unique = (names: readonly (string | null)[]) =>
  [...new Set(names.filter((name) => name !== null))].sort((a, b) =>
    a.localeCompare(b)
  );
/** The categories and the collections the devices have, in alphabetical order. */
export const CATEGORIES = unique(DEVICES.map((device) => device.category));
export const COLLECTIONS = unique(DEVICES.map((device) => device.collection));

/** What the gallery is filtered by: words, a category and a collection, each as its address form. */
export interface DeviceFilter {
  category?: string;
  collection?: string;
  q?: string;
}

/** The devices that pass every filter that is set. */
export function filterDevices({ category, collection, q }: DeviceFilter) {
  return searchDevices(q ?? "").filter(
    (device) =>
      (!category || paramOf(device.category) === category) &&
      (!collection ||
        (device.collection !== null &&
          paramOf(device.collection) === collection))
  );
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

/** Every code file of every device, loaded as text only when its source is opened. */
const sources = import.meta.glob<string>(
  "../components/devices/*/**/*.{ts,tsx,css,json}",
  { import: "default", query: "?raw" }
);

export interface SourceFile {
  language: string;
  load: () => Promise<string>;
  /** Its path in the device's folder, such as `audio/engine.ts`. */
  name: string;
}

const LANGUAGES: Record<string, string> = {
  css: "css",
  json: "json",
  ts: "ts",
  tsx: "tsx",
};

/** The code files of a device, its entry points first, then by folder and name. */
export function sourceFiles(slug: string): SourceFile[] {
  const prefix = `../components/devices/${slug}/`;
  const rank = (name: string) =>
    ["index.tsx", "index.css", "meta.json"].indexOf(name);
  return Object.entries(sources)
    .filter(([path]) => path.startsWith(prefix))
    .map(([path, load]) => ({
      language: LANGUAGES[path.split(".").pop() ?? ""] ?? "plaintext",
      load,
      name: path.slice(prefix.length),
    }))
    .sort((a, b) => {
      const [ra, rb] = [rank(a.name), rank(b.name)];
      if (ra !== -1 || rb !== -1) {
        return (ra === -1 ? 99 : ra) - (rb === -1 ? 99 : rb);
      }
      return a.name.localeCompare(b.name);
    });
}
