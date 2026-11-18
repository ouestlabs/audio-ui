/**
 * Writes the site's own ui components from what the registry publishes for the
 * `ui-sdk-nova` style: the files a project gets from `shadcn add`, so the site
 * is the first project to use them, and a component is written once.
 *
 * Run after `bun run registry:build`: `bun run ui:sync`.
 */

import { $ } from "bun";

const WEB = `${import.meta.dir}/..`;
const PUBLISHED = `${WEB}/public/r/styles/ui-sdk-nova`;

// What the site draws its chrome with.
const COMPONENTS = [
  "toolbar",
  "toggle-group",
  "toggle",
  "slider",
  "context-menu",
  "accordion",
  "alert-dialog",
  "badge",
  "collapsible",
  "sheet",
  "button",
  "button-group",
  "dialog",
  "dropdown-menu",
  "empty",
  "input",
  "input-group",
  "item",
  "kbd",
  "popover",
  "select",
  "separator",
  "tabs",
  "textarea",
  "tooltip",
];

const OWN = "@audio-ui/";

interface Published {
  files: { content: string; path: string; target: string }[];
  name: string;
  registryDependencies?: string[];
}

const written = new Set<string>();

async function write(name: string): Promise<string[]> {
  const file = Bun.file(`${PUBLISHED}/${name}.json`);
  if (!(await file.exists())) {
    throw new Error(`${name} is not published for ui-sdk-nova`);
  }
  const item: Published = await file.json();
  const targets = await Promise.all(
    item.files.map(async ({ content, target }) => {
      const path = `src/${target}`;
      await Bun.write(`${WEB}/${path}`, `${content}\n`);
      return path;
    })
  );
  written.add(name);
  const dependencies = (item.registryDependencies ?? [])
    .filter((dependency) => dependency.startsWith(OWN))
    .map((dependency) => dependency.slice(OWN.length))
    .filter((dependency) => !written.has(dependency));
  const nested = await Promise.all(dependencies.map(write));
  return [...targets, ...nested.flat()];
}

const paths = (await Promise.all(COMPONENTS.map(write))).flat();
await $`bunx biome check --write ${[...new Set(paths)]}`
  .cwd(WEB)
  .quiet()
  .nothrow();
console.log(`Wrote ${new Set(paths).size} files from ${written.size} items`);
