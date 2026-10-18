/**
 * The styling reference of the headless primitives, read from their source: for
 * each primitive, the state each part exposes as `data-*` attributes and the
 * CSS variables each part sets. The page `headless-styling.mdx` holds the
 * output between its markers, and test/headless-reference.test.ts checks it.
 *
 *   bun scripts/headless-reference.ts          prints the reference
 *   bun scripts/headless-reference.ts --write  writes it into the page
 */
import { Glob } from "bun";

const WEB = `${import.meta.dir}/..`;
const PRIMITIVES = `${WEB}/../../packages/ui/src/primitives`;
const CORE_PRIMITIVES = `${WEB}/../../packages/core/src/primitives`;
const PAGE = `${WEB}/src/content/docs/(root)/headless-styling.mdx`;
export const START = "{/* reference:start */}";
export const END = "{/* reference:end */}";

const DATA_ATTRIBUTE = /"(data-[a-z][a-z-]*)"/g;
const CSS_VARIABLE = /"(--[a-z][a-z0-9-]*)"/g;
const STATE_HEAD = /export (?:interface|type) State\b[^{]*\{/;
const STATE_KEY = /^(\w+)\??:\s*([^;,]*)/;
const PRIMITIVE_TYPE = /^(boolean|number|string|"[^"]*")$/;
const MAPPING = /[A-Z_]*STATE_ATTRIBUTES(?:_MAPPING)? = \{([\s\S]*?)\};/g;
const DROPPED = /(\w+): \(\) => null/g;
const KEBAB = /([a-z0-9])([A-Z])/g;
const TSX_FILE = /\.tsx$/;

const kebab = (key: string) => key.replace(KEBAB, "$1-$2").toLowerCase();
const sorted = (values: Iterable<string>) => [...new Set(values)].sort();

/** The part name of an element file: `root.tsx` is Root, `region-handle.tsx` is RegionHandle. */
const partName = (file: string) =>
  file
    .replace(TSX_FILE, "")
    .split("-")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join("");

/** The keys of the object a `State` type is, at its own level (not those of nested objects). */
function topLevelKeys(source: string): { key: string; type: string }[] {
  const head = STATE_HEAD.exec(source);
  if (!head) {
    return [];
  }
  const keys: { key: string; type: string }[] = [];
  let depth = 0;
  for (const line of source.slice(head.index + head[0].length).split("\n")) {
    const match = depth === 0 ? STATE_KEY.exec(line.trim()) : null;
    if (match) {
      keys.push({ key: match[1] ?? "", type: match[2] ?? "" });
    }
    depth +=
      (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;
    if (depth < 0) {
      break;
    }
  }
  return keys;
}

/** The keys of a Root's `State` that a primitive exposes as data attributes; the mappings of its UI and core sources drop some. */
function stateAttributesOf(files: Map<string, string>, sources: string[]) {
  const keys = topLevelKeys(files.get("root.tsx") ?? "");
  const mapping = sources
    .flatMap((source) =>
      [...source.matchAll(MAPPING)].map((match) => match[1] ?? "")
    )
    .join("");
  const dropped = new Set(
    [...mapping.matchAll(DROPPED)].map((match) => match[1] ?? "")
  );
  // Only a key of a plain type is an attribute: a callback or a config object is not.
  const plain = (type: string) =>
    type
      .split("|")
      .map((part) => part.trim())
      .filter((part) => part && part !== "undefined" && part !== "null")
      .every((part) => PRIMITIVE_TYPE.test(part));
  return sorted(
    keys
      .filter(({ key, type }) => !dropped.has(key) && plain(type))
      .map(({ key }) => `data-${kebab(key)}`)
  );
}

/** The text of every source file under a folder, tests aside. */
async function sourcesIn(dir: string): Promise<string[]> {
  try {
    const found = await Array.fromAsync(new Glob("**/*.{ts,tsx}").scan(dir));
    return await Promise.all(
      found
        .filter((file) => !file.includes("test"))
        .map((file) => Bun.file(`${dir}/${file}`).text())
    );
  } catch {
    return [];
  }
}

export async function reference() {
  const primitives = sorted(
    await Array.fromAsync(new Glob("*/elements/*.tsx").scan(PRIMITIVES)).then(
      (found) => found.map((file) => file.split("/")[0] ?? "")
    )
  );
  const loaded = await Promise.all(
    sorted(primitives).map(async (primitive) => {
      const dir = `${PRIMITIVES}/${primitive}/elements`;
      const names = await Array.fromAsync(new Glob("*.tsx").scan(dir));
      const texts = await Promise.all(
        names.map((file) => Bun.file(`${dir}/${file}`).text())
      );
      const sources = [
        ...(await sourcesIn(`${PRIMITIVES}/${primitive}`)),
        ...(await sourcesIn(`${CORE_PRIMITIVES}/${primitive}`)),
      ];
      return {
        files: new Map(names.map((file, index) => [file, texts[index] ?? ""])),
        primitive,
        sources,
      };
    })
  );
  const lines: string[] = [];
  for (const { files, primitive, sources } of loaded) {
    lines.push(`### ${primitive[0]?.toUpperCase()}${primitive.slice(1)}`, "");
    const state = stateAttributesOf(files, sources);
    if (state.length > 0) {
      lines.push(
        `State on every part that takes it: ${state.map((name) => `\`${name}\``).join(", ")}.`,
        ""
      );
    }
    lines.push(
      "| Part | Data attributes | CSS variables |",
      "| --- | --- | --- |"
    );
    for (const [file, source] of [...files].sort(([a], [b]) =>
      a.localeCompare(b)
    )) {
      const attributes = sorted(
        [...source.matchAll(DATA_ATTRIBUTE)].map((match) => match[1] ?? "")
      );
      const variables = sorted(
        [...source.matchAll(CSS_VARIABLE)].map((match) => match[1] ?? "")
      );
      if (attributes.length === 0 && variables.length === 0) {
        continue;
      }
      const cell = (values: string[]) =>
        values.length ? values.map((value) => `\`${value}\``).join(", ") : "";
      lines.push(
        `| \`${partName(file)}\` | ${cell(attributes)} | ${cell(variables)} |`
      );
    }
    lines.push("");
  }
  return lines.join("\n");
}

if (import.meta.main) {
  const text = await reference();
  if (Bun.argv.includes("--write")) {
    const page = await Bun.file(PAGE).text();
    const from = page.indexOf(START);
    const to = page.indexOf(END);
    await Bun.write(
      PAGE,
      `${page.slice(0, from + START.length)}\n\n${text}\n${page.slice(to)}`
    );
  } else {
    console.log(text);
  }
}
