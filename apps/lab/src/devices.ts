import { type ComponentType, lazy } from "react";

/**
 * A device is a folder of `components/devices/<slug>/`: `meta.ts` (a `title`
 * and a `description`), `index.tsx` (the device, as the default export) and
 * optionally `index.css`. Adding the folder adds the page and its link.
 */
const metas = import.meta.glob<{ description: string; title: string }>(
  "./components/devices/*/meta.ts",
  { eager: true }
);
const loaders = import.meta.glob<{ default: ComponentType }>(
  "./components/devices/*/index.tsx"
);
const styles = import.meta.glob<string>("./components/devices/*/index.css", {
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
      Component: load ? lazy(load) : null,
      description: meta.description,
      slug,
      style: styles[`${base}/index.css`],
      title: meta.title,
    };
  })
  .filter((device) => device.Component)
  .sort((a, b) => a.title.localeCompare(b.title));

export type Device = (typeof DEVICES)[number];
