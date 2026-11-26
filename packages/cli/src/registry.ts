import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Framework } from "./project.ts";

export const DEFAULT_REGISTRY = "https://www.audio-ui.dev";

/** The registry's base: every framework's items are written over the ui-sdk kernel. */
const BASE = "ui-sdk";

export interface RegistryFile {
  content?: string;
  path: string;
  target?: string;
  type: string;
}

export interface RegistryItem {
  dependencies?: string[];
  files?: RegistryFile[];
  name: string;
  registryDependencies?: string[];
  type: string;
}

const REMOTE = /^https?:\/\//;
const TRAILING_SLASH = /\/$/;

/**
 * A file of the registry, or nothing when it has none by that path: read
 * from its site, or from a folder that holds a copy (`apps/www/public`).
 */
export async function readRegistryFile(
  registry: string,
  path: string
): Promise<string | undefined> {
  if (REMOTE.test(registry)) {
    const response = await fetch(
      `${registry.replace(TRAILING_SLASH, "")}${path}`
    );
    if (response.status === 404) {
      return;
    }
    if (!response.ok) {
      throw new Error(`${path}: the registry answered ${response.status}`);
    }
    return response.text();
  }
  const file = join(registry, path);
  return existsSync(file) ? readFileSync(file, "utf8") : undefined;
}

async function readRegistryJson<T>(registry: string, path: string) {
  const text = await readRegistryFile(registry, path);
  return text === undefined ? undefined : (JSON.parse(text) as T);
}

/** The registry of one style: the names of its items, and each item with its files. */
export class Registry {
  readonly #items = new Map<string, Promise<RegistryItem | undefined>>();
  #names: Promise<Set<string>> | undefined;
  readonly #registry: string;
  readonly #style: string;

  constructor(registry: string, style: string) {
    this.#registry = registry;
    this.#style = style;
  }

  names() {
    this.#names ??= readRegistryJson<{ items: { name: string }[] }>(
      this.#registry,
      `/r/styles/${BASE}-${this.#style}/registry.json`
    ).then((index) => {
      if (!index) {
        throw new Error(`The registry has no style "${this.#style}".`);
      }
      return new Set(index.items.map((item) => item.name));
    });
    return this.#names;
  }

  item(name: string) {
    let item = this.#items.get(name);
    if (!item) {
      item = readRegistryJson<RegistryItem>(
        this.#registry,
        `/r/styles/${BASE}-${this.#style}/${name}.json`
      );
      this.#items.set(name, item);
    }
    return item;
  }
}

/**
 * The item that gives a component in a framework: React's styled component
 * is the item of its name, another framework's is `<name>-element-<framework>`,
 * and a headless primitive is `<name>-<framework>`. An item of no framework
 * (a lib of the engine) is its own name.
 */
export function candidates(
  name: string,
  framework: Framework,
  headless: boolean
): string[] {
  if (framework === "react") {
    return headless ? [`${name}-react`] : [name];
  }
  if (framework === "web") {
    return [`${name}-web`, name];
  }
  return headless
    ? [`${name}-${framework}`]
    : [`${name}-element-${framework}`, `${name}-${framework}`, name];
}

export async function itemFor(
  registry: Registry,
  name: string,
  framework: Framework,
  headless: boolean
): Promise<string> {
  const names = await registry.names();
  const found = candidates(name, framework, headless).find((candidate) =>
    names.has(candidate)
  );
  if (!found) {
    throw new Error(
      `The registry has no "${name}" for ${framework}${headless ? " (headless)" : ""}.`
    );
  }
  return found;
}

const OURS = /^@audio-ui\/(.+)$/;

/** Every item a set of items needs, each before the items that need it, and what they need from other registries. */
export async function resolveTree(registry: Registry, roots: string[]) {
  const items: RegistryItem[] = [];
  const external = new Set<string>();
  const visits = new Map<string, Promise<void>>();
  // An item is listed once its own needs are: `path` breaks a cycle, which would wait on itself.
  const visit = (name: string, path: ReadonlySet<string>): Promise<void> => {
    let visited = visits.get(name);
    if (!visited) {
      visited = (async () => {
        const item = await registry.item(name);
        if (!item) {
          throw new Error(`The registry has no item "${name}".`);
        }
        const within = new Set([...path, name]);
        const ours: string[] = [];
        for (const dependency of item.registryDependencies ?? []) {
          const own = OURS.exec(dependency)?.[1];
          if (!own) {
            external.add(dependency);
          } else if (!within.has(own)) {
            ours.push(own);
          }
        }
        await Promise.all(ours.map((own) => visit(own, within)));
        items.push(item);
      })();
      visits.set(name, visited);
    }
    return visited;
  };
  await Promise.all(roots.map((root) => visit(root, new Set())));
  return { external: [...external], items };
}

const REACT_IMPORT = /from\s+["']react(?:-dom)?(?:\/[^"']*)?["']/;

/** The items of a tree that are written for React. */
export const reactItems = (items: RegistryItem[]) =>
  items
    .filter((item) =>
      (item.files ?? []).some((file) => REACT_IMPORT.test(file.content ?? ""))
    )
    .map((item) => item.name);
