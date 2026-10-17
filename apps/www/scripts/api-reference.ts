/**
 * Keeps the API reference of each component page word for word with the JSDoc
 * of the prop it documents. A `<TypeRow>` takes the JSDoc of its prop from the
 * `Props` interface of the element file that matches its section (`### Root`
 * reads `root.tsx`). A section that matches no file reads the primitive's files,
 * when one of them alone defines the prop.
 *
 *   bun scripts/api-reference.ts          check: lists the rows that differ, exits 1
 *   bun scripts/api-reference.ts --write  rewrites the descriptions
 *
 * Names, types and defaults stay as the page writes them. A row whose prop has
 * no JSDoc in those files (a state attribute, a registry component) is skipped.
 */
import { Glob } from "bun";

const WEB = `${import.meta.dir}/..`;
const PAGES = `${WEB}/src/content/docs/components/base`;
const PRIMITIVES = `${WEB}/../../packages/ui/src/primitives`;

const SECTION = /^### (.+)$/gm;
const TYPE_ROW =
  /<TypeRow name=\{"([^"]+)"\}(?: type=\{"[^"]*"\})?(?: default=\{"[^"]*"\})?>([\s\S]*?)<\/TypeRow>/g;
const JSDOC_PROP = /\/\*\*((?:(?!\*\/)[\s\S])*)\*\/\n\s*(\w+)\??\s*:/g;
const PROPS_HEAD = /export interface Props\b/;
const UNSAFE_IN_MDX = /(?<!`)[{}<](?![^`]*`)/;
const UPPER_CAMEL = /([a-z0-9])([A-Z])/g;
const WHITESPACE = /\s+/g;
const ELEMENT_FILE = /\.tsx$/;

export const norm = (text: string) => text.replace(WHITESPACE, " ").trim();

/** The body of a file's `Props` interface: the only place a part's own props are documented. */
export function propsBody(source: string): string {
  const head = PROPS_HEAD.exec(source);
  if (!head) {
    return "";
  }
  const open = source.indexOf("{", head.index);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") {
      depth += 1;
    }
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(open, index);
      }
    }
  }
  return "";
}

/** The JSDoc description of each prop of a file's `Props` interface, without its `@default` tag. */
export function propDocs(source: string): Map<string, string> {
  const docs = new Map<string, string>();
  for (const match of propsBody(source).matchAll(JSDOC_PROP)) {
    const text = norm(
      (match[1] ?? "").replace(/^\s*\*\s?/gm, "").replace(/@default[^\n]*/g, "")
    );
    if (text && !docs.has(match[2] ?? "")) {
      docs.set(match[2] ?? "", text);
    }
  }
  return docs;
}

/** The element files of a primitive; none when it has no elements, as for a page about a block. */
async function elementFiles(dir: string): Promise<string[]> {
  try {
    return await Array.fromAsync(new Glob("*.tsx").scan(dir));
  } catch {
    return [];
  }
}

/** `### Root` is `root.tsx`, `### RegionHandle` is `region-handle.tsx`. */
const kebab = (heading: string) =>
  heading
    .trim()
    .replace(UPPER_CAMEL, "$1-$2")
    .toLowerCase()
    .replace(WHITESPACE, "-");

export interface Mismatch {
  from: string;
  name: string;
  page: string;
  section: string;
  to: string;
}

/** The source of a row's prop: the section's own file, else the one file of the primitive that defines it. */
function sourceOf(
  names: string[],
  own: Map<string, string> | undefined,
  wide: Map<string, Set<string>>
) {
  const sources = names.map((name) => {
    if (own) {
      return own.get(name);
    }
    const all = wide.get(name);
    return all && all.size === 1 ? [...all][0] : undefined;
  });
  const [source] = sources;
  return source !== undefined && sources.every((other) => other === source)
    ? source
    : undefined;
}

/** Each primitive's files, by file name, with the JSDoc of their props. */
async function filesOf(primitive: string) {
  const dir = `${PRIMITIVES}/${primitive}/elements`;
  const names = await elementFiles(dir);
  const sources = await Promise.all(
    names.map((file) => Bun.file(`${dir}/${file}`).text())
  );
  return new Map(
    names.map((file, index) => [
      file.replace(ELEMENT_FILE, ""),
      propDocs(sources[index] ?? ""),
    ])
  );
}

/** The rows of a page, with the description each should have; `undefined` for a row with no source. */
function rowsOf(
  page: string,
  text: string,
  files: Map<string, Map<string, string>>
) {
  const wide = new Map<string, Set<string>>();
  for (const docs of files.values()) {
    for (const [name, description] of docs) {
      wide.set(name, new Set([...(wide.get(name) ?? []), description]));
    }
  }
  const headings = [...text.matchAll(SECTION)];
  return headings.flatMap((heading, index) => {
    const start = (heading.index ?? 0) + heading[0].length;
    const end = headings[index + 1]?.index ?? text.length;
    const section = heading[1] ?? "";
    const own = files.get(kebab(section));
    return [...text.slice(start, end).matchAll(TYPE_ROW)].map((row) => ({
      content: row[2] ?? "",
      names: (row[1] ?? "").split(",").map((name) => name.trim()),
      page,
      section,
      source: sourceOf(
        (row[1] ?? "").split(",").map((name) => name.trim()),
        own,
        wide
      ),
      row: row[0],
    }));
  });
}

/** Every row whose description is not the JSDoc of its prop. Rewrites them when `write` is set. */
export async function sync(write: boolean) {
  const mismatches: Mismatch[] = [];
  const skipped: string[] = [];
  for await (const page of new Glob("**/*.mdx").scan(PAGES)) {
    const files = await filesOf(
      page.split("/").pop()?.replace(".mdx", "") ?? ""
    );
    if (files.size === 0) {
      continue;
    }
    const path = `${PAGES}/${page}`;
    let text = await Bun.file(path).text();
    for (const row of rowsOf(page, text, files)) {
      const label = `${page} / ${row.section} / ${row.names.join(", ")}`;
      if (row.source === undefined) {
        skipped.push(label);
      } else if (norm(row.content) !== row.source) {
        mismatches.push({
          from: norm(row.content),
          name: row.names.join(", "),
          page,
          section: row.section,
          to: row.source,
        });
        if (UNSAFE_IN_MDX.test(row.source)) {
          skipped.push(`${label}: braces or angle brackets outside code`);
        } else {
          text = text.replace(
            row.row,
            row.row.replace(
              `>${row.content}</TypeRow>`,
              `>${row.source}</TypeRow>`
            )
          );
        }
      }
    }
    if (write) {
      await Bun.write(path, text);
    }
  }
  return { mismatches, skipped };
}

if (import.meta.main) {
  const write = Bun.argv.includes("--write");
  const { mismatches, skipped } = await sync(write);
  console.log(
    `${mismatches.length} description(s) ${write ? "rewritten" : "differ from the JSDoc"}; ${skipped.length} skipped`
  );
  if (!write) {
    for (const item of mismatches.slice(0, 15)) {
      console.log(`- ${item.page} / ${item.section} / ${item.name}`);
    }
    process.exit(mismatches.length === 0 ? 0 : 1);
  }
}
