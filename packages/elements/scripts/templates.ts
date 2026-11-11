/**
 * Writes `src/templates.generated.ts`: for every element, the attributes it
 * observes, the properties it can be given (its setters) and the event map
 * its `addEventListener` is typed with. The Vue and Svelte declarations
 * (`src/vue.ts`, `src/svelte.ts`) type templates from it.
 *
 *   bun scripts/templates.ts          # write it
 *   bun scripts/templates.ts --check  # fail when it is stale
 */
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();
await import("../src/index.ts");

const SRC = `${import.meta.dir}/../src`;
const OUT = `${SRC}/templates.generated.ts`;

const TAG_ENTRY = /"(audio-ui-[a-z-]+)": (\w+);/g;
const CLASS = /^(?:export )?(?:abstract )?class (\w+)/;
const TYPED_LISTENER = /K extends keyof (\w+EventMap)/;

/** The sources matching `pattern`, tests left out. */
async function sources(pattern: string): Promise<string[]> {
  const paths = await Array.fromAsync(new Bun.Glob(pattern).scan(SRC));
  return Promise.all(
    paths
      .filter((path) => !path.endsWith(".test.ts"))
      .map((path) => Bun.file(`${SRC}/${path}`).text())
  );
}

/** Each tag's class, from the `HTMLElementTagNameMap` every entry declares. */
async function tagClasses(): Promise<Map<string, string>> {
  const tags = new Map<string, string>();
  for (const source of await sources("*/index.ts")) {
    for (const [, tag, name] of source.matchAll(TAG_ENTRY)) {
      tags.set(tag as string, name as string);
    }
  }
  return tags;
}

/** Each class's event map: the one its `addEventListener` is typed with. */
async function eventMaps(): Promise<Map<string, string>> {
  const maps = new Map<string, string>();
  for (const source of await sources("*/*.ts")) {
    let current: string | undefined;
    for (const line of source.split("\n")) {
      const [, declared] = line.match(CLASS) ?? [];
      current = declared ?? current;
      const [, typed] = line.match(TYPED_LISTENER) ?? [];
      if (typed && current) {
        maps.set(current, typed);
      }
    }
  }
  return maps;
}

/** The properties an element can be given: the setters of its class and of the classes it extends, short of `HTMLElement`. */
function settersOf(element: CustomElementConstructor): string[] {
  const names = new Set<string>();
  for (
    let proto = element.prototype;
    proto && proto !== HTMLElement.prototype;
    proto = Object.getPrototypeOf(proto)
  ) {
    for (const [name, descriptor] of Object.entries(
      Object.getOwnPropertyDescriptors(proto)
    )) {
      if (descriptor.set) {
        names.add(name);
      }
    }
  }
  return [...names].sort();
}

/** The attributes an element observes that are its own: `aria-*` ones are every element's already. */
function attributesOf(element: CustomElementConstructor): string[] {
  const observed =
    (element as unknown as { observedAttributes?: readonly string[] })
      .observedAttributes ?? [];
  return [...new Set(observed)]
    .filter((name) => !name.startsWith("aria-"))
    .sort();
}

const union = (names: readonly string[]) =>
  names.length === 0 ? "never" : names.map((name) => `"${name}"`).join(" | ");

const tags = await tagClasses();
const maps = await eventMaps();
const used = new Set<string>();
const entries = [...tags.entries()]
  .sort(([a], [b]) => (a < b ? -1 : 1))
  .map(([tag, name]) => {
    const element = customElements.get(tag);
    if (!element) {
      throw new Error(`${tag} is not registered by the package's root`);
    }
    const map = maps.get(name);
    if (map) {
      used.add(map);
    }
    return `  "${tag}": {
    attributes: ${union(attributesOf(element))};
    events: ${map ?? "HTMLElementEventMap"};
    properties: ${union(settersOf(element))};
  };`;
  });

const output = `// Written by \`bun scripts/templates.ts\` from the elements themselves. Do not edit.
import type {
${[...used]
  .sort()
  .map((map) => `  ${map},`)
  .join("\n")}
} from "./index.ts";

/** What a template can give each element, and hear from it: the attributes it observes, the properties it has a setter for, and its events. */
export interface ElementTemplates {
${entries.join("\n")}
}
`;

const formatted =
  await Bun.$`bunx biome format --stdin-file-path=${OUT} < ${Buffer.from(output)}`.text();

if (process.argv.includes("--check")) {
  const current = await Bun.file(OUT)
    .text()
    .catch(() => "");
  if (current !== formatted) {
    console.error(
      "src/templates.generated.ts is stale: run bun scripts/templates.ts"
    );
    process.exit(1);
  }
} else {
  await Bun.write(OUT, formatted);
  console.log(`${tags.size} elements written to src/templates.generated.ts`);
}
