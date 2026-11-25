import { expect, test } from "bun:test";

/**
 * On the ui-sdk base, a ui component's part writes its own `data-slot` over the
 * one it is given: ui-sdk keeps it, since the part's behavior reads it. A
 * registry element that names a ui component it renders gives it `data-part`,
 * which both bases leave alone, so what looks it up finds it on either.
 */

// Where a built file takes a ui component from, and the two elements that hand their props to one.
const UI_IMPORT =
  /^@\/components\/(?:ui\/[a-z0-9-]+|audio-ui\/bare-(?:button|input))$/;

interface BuiltItem {
  files?: { content?: string; path?: string; target?: string }[];
  name?: string;
}

const items: BuiltItem[] = await Promise.all(
  (
    await Array.fromAsync(
      new Bun.Glob("*.json").scan({
        absolute: true,
        cwd: `${import.meta.dir}/../../public/r/styles/ui-sdk-nova`,
      })
    )
  ).map((path) => Bun.file(path).json())
);

// `import { A, B as C } from "<specifier>"`, possibly over several lines.
const NAMED_IMPORT = /import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+"([^"]+)"/g;
const ALIAS = /\s+as\s+/;
// An attribute of a tag, read where its own attributes are: `data-slot=`.
const DATA_SLOT = /(?:^|\s)data-slot=/;

/** The names a file gives the ui components it imports. */
function uiNames(content: string) {
  const names = new Set<string>();
  for (const [, list = "", specifier = ""] of content.matchAll(NAMED_IMPORT)) {
    if (UI_IMPORT.test(specifier)) {
      for (const name of list.split(",")) {
        const local = name.split(ALIAS).at(-1)?.trim();
        if (local) {
          names.add(local);
        }
      }
    }
  }
  return names;
}

/**
 * The attributes of the tag that opens at `from`, as written: what lies
 * outside braces and before the `>` that closes it. An element passed in an
 * attribute, `render={<Button … />}`, is inside braces: it is read as a tag
 * of its own.
 */
function ownAttributes(content: string, from: number) {
  let depth = 0;
  let quote = "";
  let own = "";
  for (let index = from; index < content.length; index += 1) {
    const char = content[index] ?? "";
    if (quote) {
      if (char === quote) {
        quote = "";
      }
      if (depth === 0) {
        own += char;
      }
      continue;
    }
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
    } else if (depth === 0 && (char === '"' || char === "'")) {
      quote = char;
    } else if (depth === 0 && char === ">") {
      return own;
    }
    if (depth === 0) {
      own += char;
    }
  }
  return own;
}

/** Each ui component a file gives a `data-slot`, as `<Tag data-slot>`. */
function slotsOnUi(content: string) {
  const found: string[] = [];
  for (const name of uiNames(content)) {
    for (const tag of content.matchAll(
      new RegExp(`<${name}(?=[\\s/>])`, "g")
    )) {
      const from = (tag.index ?? 0) + tag[0].length;
      if (DATA_SLOT.test(ownAttributes(content, from))) {
        found.push(`<${name} data-slot>`);
      }
    }
  }
  return found;
}

test("the registry names a ui component it renders with data-part, never data-slot", () => {
  expect(items.length).toBeGreaterThan(0);
  const given = items.flatMap((item) =>
    (item.files ?? [])
      .filter((file) => (file.target ?? file.path ?? "").endsWith(".tsx"))
      .flatMap((file) =>
        slotsOnUi(file.content ?? "").map(
          (slot) => `${item.name}: ${file.target ?? file.path} ${slot}`
        )
      )
  );
  expect([...new Set(given)]).toEqual([]);
});
