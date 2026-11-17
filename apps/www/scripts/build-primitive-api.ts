/**
 * The manifest the primitives' API reference reads: for each primitive, its
 * options (each with its type, its default and its JSDoc), its events as every
 * framework names them, its parts with their elements and tags, and what an
 * agent can do with it. Read from the sources and the adapters, so the
 * reference never says more or less than what ships.
 *
 *   bun scripts/build-primitive-api.ts          writes the manifest
 *   bun scripts/build-primitive-api.ts --check  fails when it is stale
 */

import { readdirSync } from "node:fs";
import { join } from "node:path";

const WEB = join(import.meta.dir, "..");
const PACKAGES = join(WEB, "../../packages");
const PRIMITIVES = join(WEB, "src/registry-audio/bases/base/primitives");
const ADAPTERS = join(WEB, "src/registry-audio/bases/base/primitives");
export const MANIFEST = join(
  WEB,
  "src/lib/docs/content/primitive-api.generated.json"
);

export interface ApiOption {
  default?: string;
  description: string;
  name: string;
  optional: boolean;
  type: string;
}

export interface ApiEvent {
  /** The option that carries it, in React and Svelte: `onValueChange`. */
  callback: string;
  /** The event of the custom elements: `input`. */
  event: string | null;
  /** The event of Vue: `value-change`. */
  vue: string;
}

export interface ApiPart {
  /** What the part draws as: `div`, `svg`, `input`. A part the adapter composes of others has none. */
  element?: string;
  name: string;
  /** The props of the part besides the class and the attributes of its element. */
  props: Record<string, string>;
}

export interface PrimitiveApi {
  actions: string[];
  /** The object the adapters export the parts under: `Knob` in `Knob.Control`. */
  component: string;
  events: ApiEvent[];
  name: string;
  options: ApiOption[];
  /** The parts every adapter of React, Vue and Svelte exports, by one name. */
  parts: ApiPart[];
  /** The tags the web adapter registers. */
  tags: string[];
}

const WHITESPACE = /\s+/g;
const JSDOC_EDGES = /^\/\*\*|\*\/$/g;
const JSDOC_LINE = /^\s*\*\s?/gm;
const KEBAB = /([a-z0-9])([A-Z])/g;
const kebab = (name: string) => name.replace(KEBAB, "$1-$2").toLowerCase();
const pascal = (name: string) =>
  name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

/** Every `.ts` file under a folder, tests aside. */
function sourcesOf(folder: string): string[] {
  return readdirSync(folder, { recursive: true, withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith(".ts") &&
        !entry.name.endsWith(".test.ts")
    )
    .map((entry) => join(entry.parentPath, entry.name));
}

/** The text between the brace that opens at `start` and the one that closes it. */
function braced(text: string, start: number) {
  let depth = 0;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start + 1, index);
      }
    }
  }
  return "";
}

/** Splits at the commas, or semicolons, that sit at the top level of brackets. */
function topLevel(text: string, separator: string) {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index] ?? "";
    if ("({[<".includes(char) && !(char === "<" && text[index - 1] === "=")) {
      depth += 1;
    } else if (")}]>".includes(char) && text[index - 1] !== "=") {
      depth -= 1;
    } else if (char === separator && depth === 0) {
      parts.push(text.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
}

interface Declared {
  body: string;
  extends: string[];
}

/** Every `export interface` of the packages, by name. */
function interfaces() {
  const found = new Map<string, Declared>();
  const header =
    /export interface (\w+)(?:<[^{]*?>)?\s*(?:extends ([^{]+))?\{/g;
  for (const file of [
    ...sourcesOf(join(PACKAGES, "core/src")),
    ...sourcesOf(PRIMITIVES),
  ]) {
    const text = require("node:fs").readFileSync(file, "utf8") as string;
    for (const match of text.matchAll(header)) {
      const open = (match.index ?? 0) + match[0].length - 1;
      found.set(match[1] ?? "", {
        body: braced(text, open),
        extends: match[2]
          ? topLevel(match[2].trim(), ",").map((e) => e.trim())
          : [],
      });
    }
  }
  return found;
}

function docOf(jsdoc: string | undefined) {
  const text = (jsdoc ?? "")
    .replace(JSDOC_EDGES, "")
    .replace(JSDOC_LINE, "")
    .replace(WHITESPACE, " ")
    .trim();
  const tag = /\s?@default\s+(.+?)(?=\s@\w|$)/.exec(text);
  const description = text.replace(/\s?@\w+[\s\S]*$/, "").trim();
  return { default: tag?.[1]?.trim(), description };
}

/** The members of an interface body, each with the JSDoc before it. */
function membersOf(body: string): ApiOption[] {
  const members: ApiOption[] = [];
  for (const statement of topLevel(body, ";")) {
    const match =
      /^\s*(\/\*\*[\s\S]*?\*\/\s*)?(?:readonly\s+)?(\w+)(\?)?\s*:\s*([\s\S]+?)\s*$/.exec(
        statement
      );
    if (!match) {
      continue;
    }
    const { default: fallback, description } = docOf(match[1]?.trim());
    members.push({
      default: fallback,
      description,
      name: match[2] ?? "",
      optional: match[3] === "?",
      type: (match[4] ?? "").replace(WHITESPACE, " "),
    });
  }
  return members;
}

/** The members of an interface, with what it extends: an `Omit<…>` drops its keys. */
function optionsOf(
  name: string,
  all: Map<string, Declared>,
  seen = new Set<string>()
): ApiOption[] {
  const declared = all.get(name);
  if (!declared || seen.has(name)) {
    return [];
  }
  seen.add(name);
  const inherited: ApiOption[] = [];
  for (const parent of declared.extends) {
    const omit = /^Omit<\s*(\w+)\s*,\s*([^>]+)>$/.exec(parent);
    const base = omit?.[1] ?? /^(\w+)/.exec(parent)?.[1] ?? "";
    const dropped = new Set(
      (omit?.[2] ?? "").split("|").map((key) => key.trim().replace(/["']/g, ""))
    );
    inherited.push(
      ...optionsOf(base, all, seen).filter(
        (member) => !dropped.has(member.name)
      )
    );
  }
  const own = membersOf(declared.body);
  const names = new Set(own.map((member) => member.name));
  return [
    ...inherited.filter((member) => !names.has(member.name)),
    ...own,
  ].sort((a, b) => a.name.localeCompare(b.name));
}

/** The names the Vue adapter exports in its object of parts: `export const Knob = { Control: parts.Control, … }`. */
function exportsOf(adapter: string) {
  const body = /export const \w+ = \{([\s\S]*?)\};/.exec(adapter)?.[1] ?? "";
  return topLevel(body, ",")
    .map((entry) => entry.trim().split(":")[0]?.trim() ?? "")
    .filter(Boolean)
    .sort();
}

function slotsOf(name: string): Promise<Record<string, any>> {
  return import(join(PRIMITIVES, name, `${name}.ts`)).then((module) => {
    const description = Object.values(module).find(
      (value: any) => value?.options && value?.slots
    ) as { slots: Record<string, any> } | undefined;
    return description?.slots ?? {};
  });
}

export async function build(): Promise<PrimitiveApi[]> {
  const all = interfaces();
  const names = readdirSync(PRIMITIVES, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const read = (file: string) =>
    Bun.file(file)
      .text()
      .catch(() => "");
  const apis: PrimitiveApi[] = [];
  for (const name of names) {
    const source = await read(join(PRIMITIVES, name, `${name}.ts`));
    const optionsInterface = /export interface (\w+PrimitiveOptions)/.exec(
      source
    )?.[1];
    const options = optionsInterface ? optionsOf(optionsInterface, all) : [];
    const web = await read(join(ADAPTERS, name, "web/index.ts"));
    const vue = await read(join(ADAPTERS, name, "vue/index.ts"));
    // The event of the custom elements for each callback of the root: `onValueChange: "input"`.
    const eventsBlock = /events:\s*\{([^}]*)\}/.exec(web)?.[1] ?? "";
    const webEvents = new Map(
      [...eventsBlock.matchAll(/(\w+):\s*"([^"]+)"/g)].map((match) => [
        match[1] ?? "",
        match[2] ?? "",
      ])
    );
    const callbacks = new Set([
      ...options
        .filter((option) => /^on[A-Z]/.test(option.name))
        .map((option) => option.name),
      ...webEvents.keys(),
    ]);
    const events: ApiEvent[] = [...callbacks].sort().map((callback) => ({
      callback,
      event: webEvents.get(callback) ?? null,
      vue: kebab(callback.slice(2)),
    }));
    // What each part draws as, from the Vue adapter's `createParts(primitive, { control: "div" })`.
    const elementsBlock =
      /createParts\(\s*\w+,\s*\{([\s\S]*?)\}\s*\)/.exec(vue)?.[1] ?? "";
    const elements = new Map(
      [...elementsBlock.matchAll(/(\w+):\s*"([^"]+)"/g)].map((match) => [
        match[1] ?? "",
        match[2] ?? "",
      ])
    );
    const slots = await slotsOf(name);
    const exported = exportsOf(vue);
    const parts: ApiPart[] = exported.map((part) => {
      const slot = slots[part.charAt(0).toLowerCase() + part.slice(1)];
      const props = { ...((slot?.props as Record<string, string>) ?? {}) };
      delete props["data-slot"];
      return {
        element: elements.get(part.charAt(0).toLowerCase() + part.slice(1)),
        name: part,
        props,
      };
    });
    const tags = [
      ...new Set(
        [...web.matchAll(/"(audio-ui-[a-z0-9-]+)"/g)].map(
          (match) => match[1] ?? ""
        )
      ),
    ].sort();
    const actions = [
      ...(
        /agent:\s*\{\s*actions:\s*\[([^\]]*)\]/.exec(source)?.[1] ?? ""
      ).matchAll(/"([^"]+)"/g),
    ].map((match) => match[1] ?? "");
    const component = /export const (\w+) = \{/.exec(vue)?.[1] ?? pascal(name);
    apis.push({ actions, component, events, name, options, parts, tags });
  }
  return apis;
}

if (import.meta.main) {
  const text = `${JSON.stringify(await build(), null, 2)}\n`;
  if (process.argv.includes("--check")) {
    const current = await Bun.file(MANIFEST)
      .text()
      .catch(() => "");
    if (current !== text) {
      console.error(
        "primitive-api.generated.json is stale: run `bun scripts/build-primitive-api.ts`."
      );
      process.exit(1);
    }
  } else {
    await Bun.write(MANIFEST, text);
    console.log("primitive-api.generated.json written");
  }
}
