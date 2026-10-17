/*
 * The docs' custom MDX components as plain Markdown, for the pages served to
 * agents (/llm/*, /llms-full.txt). Code fences are left untouched.
 */

const FENCE_SPLIT_REGEX = /(^```[^\n]*\n[\s\S]*?^```[ \t]*$)/m;
const FENCE_META_REGEX = /^(```\w+) component\b/;
const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---\n*/;

/** The attributes of a tag: a name, a value as `"x"`, `{"x"}` (JSON) or `{x}`, or a bare name. */
const ATTRS =
  '(?:\\s+[\\w-]+(?:=(?:\\{"(?:[^"\\\\]|\\\\.)*"\\}|"[^"]*"|\\{[^}]*\\}))?)*';
const ATTR_REGEX =
  /([\w-]+)(?:=(?:\{("(?:[^"\\]|\\.)*")\}|"([^"]*)"|\{([^}]*)\}))?/g;

const TYPE_TABLE_REGEX = new RegExp(
  `<TypeTable(${ATTRS})\\s*>([\\s\\S]*?)</TypeTable>`,
  "g"
);
const TYPE_ROW_REGEX = new RegExp(
  `<TypeRow(${ATTRS})\\s*>([\\s\\S]*?)</TypeRow>`,
  "g"
);
const KEY_TABLE_REGEX = new RegExp(
  `<KeyTable(${ATTRS})\\s*>([\\s\\S]*?)</KeyTable>`,
  "g"
);
const KEY_ROW_REGEX = new RegExp(
  `<KeyRow(${ATTRS})\\s*>([\\s\\S]*?)</KeyRow>`,
  "g"
);
const TABS_LIST_REGEX = /<TabsList>([\s\S]*?)<\/TabsList>\n*/g;
const TABS_TRIGGER_REGEX =
  /<TabsTrigger\s+value="([^"]+)"\s*>([\s\S]*?)<\/TabsTrigger>/g;
const TABS_CONTENT_REGEX = /<TabsContent\s+value="([^"]+)"\s*>\n*/g;
const TABS_WRAPPER_REGEX = /<\/?(?:Code)?Tabs(?:\s[^>]*)?>\n*/g;
const STEP_REGEX = /<Step>([\s\S]*?)<\/Step>/g;
const ATTRIBUTE_REGEX = /attribute/i;
const KEYS_REGEX = /keys/i;
const QUOTED_REGEX = /^(["'])(.*)\1$/;
const ICON_REGEX = /<Icons\.\w+\s*\/>\s*/g;

type Attrs = Record<string, string | true>;

export function parseAttrs(source: string): Attrs {
  const attrs: Attrs = {};
  for (const [, name, json, quoted, expression] of source.matchAll(
    ATTR_REGEX
  )) {
    if (!name) {
      continue;
    }
    if (json === undefined) {
      attrs[name] = quoted ?? expression ?? true;
    } else {
      attrs[name] = JSON.parse(json) as string;
    }
  }
  return attrs;
}

/** The text of a table cell: one line, with the pipes escaped. */
function cell(text: string | true | undefined) {
  return typeof text === "string"
    ? text
        .trim()
        .replace(/\s*\n\s*/g, " ")
        .replaceAll("|", "\\|")
    : "";
}

const code = (text: string | true | undefined) =>
  typeof text === "string" && text ? `\`${cell(text)}\`` : "";

function table(header: string[], rows: string[][]) {
  return [
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

function typeTable(attrsSource: string, body: string) {
  const { title } = parseAttrs(attrsSource);
  const rows = [...body.matchAll(TYPE_ROW_REGEX)].map(
    ([, rowAttrs = "", text = ""]) => ({
      attrs: parseAttrs(rowAttrs),
      text: text.trim(),
    })
  );
  const detailed = rows.some(
    ({ attrs }) => attrs.type || attrs.default || attrs.required
  );
  const caption = typeof title === "string" ? `**${title}**\n\n` : "";
  if (!detailed) {
    const header = ATTRIBUTE_REGEX.test(String(title)) ? "Attribute" : "Name";
    return `${caption}${table(
      [header, "Description"],
      rows.map(({ attrs, text }) => [code(attrs.name), cell(text)])
    )}`;
  }
  return `${caption}${table(
    ["Prop", "Type", "Default", "Description"],
    rows.map(({ attrs, text }) => [
      attrs.required ? `${code(attrs.name)} (required)` : code(attrs.name),
      code(attrs.type),
      code(attrs.default),
      cell(text),
    ])
  )}`;
}

function keyTable(attrsSource: string, body: string) {
  const { title } = parseAttrs(attrsSource);
  const rows = [...body.matchAll(KEY_ROW_REGEX)].map(
    ([, rowAttrs = "", text = ""]) => [
      cell(parseAttrs(rowAttrs).gesture),
      cell(text),
    ]
  );
  const caption = typeof title === "string" ? `**${title}**\n\n` : "";
  const header = KEYS_REGEX.test(String(title)) ? "Key" : "Gesture";
  return `${caption}${table([header, "Effect"], rows)}`;
}

/** The text the page's frontmatter gives, or nothing. */
function frontmatterField(frontmatter: string, field: string) {
  const line = frontmatter.match(new RegExp(`^${field}:\\s*(.+)$`, "m"))?.[1];
  return line?.trim().replace(QUOTED_REGEX, "$2");
}

/** The page's title and description as a heading and a quote, in place of its frontmatter. */
export function replaceFrontmatter(content: string) {
  const match = content.match(FRONTMATTER_REGEX);
  if (!match) {
    return content;
  }
  const title = frontmatterField(match[1] ?? "", "title");
  const description = frontmatterField(match[1] ?? "", "description");
  const head = [title && `# ${title}`, description && `> ${description}`]
    .filter(Boolean)
    .join("\n\n");
  return `${head ? `${head}\n\n` : ""}${content.slice(match[0].length)}`;
}

/**
 * The reference tables as Markdown tables, the tabs as labelled sections, the
 * steps as numbered lines. What has no Markdown form (icons) is dropped.
 */
export function mdxToMarkdown(content: string) {
  let labels = new Map<string, string>();
  let step = 0;
  return content
    .split(FENCE_SPLIT_REGEX)
    .map((segment, index) => {
      if (index % 2 === 1) {
        return segment.replace(FENCE_META_REGEX, "$1");
      }
      return segment
        .replace(TYPE_TABLE_REGEX, (_, attrs, body) => typeTable(attrs, body))
        .replace(KEY_TABLE_REGEX, (_, attrs, body) => keyTable(attrs, body))
        .replace(TABS_LIST_REGEX, (_, list: string) => {
          labels = new Map(
            [...list.matchAll(TABS_TRIGGER_REGEX)].map(([, value, label]) => [
              value ?? "",
              (label ?? "").replace(ICON_REGEX, "").trim(),
            ])
          );
          return "";
        })
        .replace(
          TABS_CONTENT_REGEX,
          (_, value: string) => `**${labels.get(value) ?? value}**\n\n`
        )
        .replace(/<\/TabsContent>\n*/g, "")
        .replace(TABS_WRAPPER_REGEX, "")
        .replace(/<Steps>\n*/g, () => {
          step = 0;
          return "";
        })
        .replace(/<\/Steps>\n*/g, "")
        .replace(STEP_REGEX, (_, text: string) => {
          step += 1;
          return `**${step}. ${text.trim()}**`;
        })
        .replace(ICON_REGEX, "")
        .replace(/\n{3,}/g, "\n\n");
    })
    .join("");
}
