import { type ComponentType, lazy } from "react";

/**
 * A device is a folder of `components/devices/<slug>/`: `meta.json` (a `title`, a `description` and the `uses`:
 * the audio/ui components it is made of), `index.tsx` (the device, as the default export, with its own `h1`) and
 * optionally `index.css` and `og.png` (its social image, 1200x630). Adding the folder adds the page and its link.
 */
const metas = import.meta.glob<{
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
