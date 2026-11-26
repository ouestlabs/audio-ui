import { compile } from "tailwindcss";

/**
 * An element's look as plain CSS on its parts, for a style: what Vue, Svelte
 * and custom elements read where React reads classes. Each part's classes
 * (`knobParts`) become a rule on its `data-slot`, its `cn-*` hooks replaced by
 * the style's utilities, and a size's classes a rule on the root's
 * `data-size`. Tailwind compiles them, so the sheet needs no Tailwind.
 */

/** The parts of an element, by `data-slot`; the first is its root. */
export type Parts = Readonly<Record<string, string>>;
/** The classes of the parts a size changes, by part, then by size. */
export type Sizes = Readonly<Record<string, Readonly<Record<string, string>>>>;

const GROUP_NAME = /^(?:group|peer)\/[\w-]+$/;
const GROUP_SELECTOR = /\.group\\\/([\w-]+)/g;
const HOOK = /^cn-[\w-]+$/;
const WHITESPACE = /\s+/;
const COMMENT = /\/\*[\s\S]*?\*\//g;

/** A part's classes as utilities: the style's hooks expanded, the group names dropped (a part is found by its slot). */
function utilities(classes: string, hooks: ReadonlyMap<string, string>) {
  return classes
    .split(WHITESPACE)
    .filter((name) => name && !GROUP_NAME.test(name))
    .map((name) => (HOOK.test(name) ? (hooks.get(name) ?? "") : name))
    .filter(Boolean)
    .join(" ");
}

const rule = (selector: string, applied: string) =>
  applied ? `${selector} { @apply ${applied}; }` : "";

/** The rules of an element, before Tailwind compiles them. */
export function partRules(
  parts: Parts,
  sizes: Sizes,
  hooks: ReadonlyMap<string, string>
) {
  const [root] = Object.keys(parts);
  const at = (slot: string, scope: string) =>
    slot === root
      ? `[data-slot=${root}]${scope}`
      : `[data-slot=${root}]${scope} [data-slot=${slot}]`;
  return [
    ...Object.entries(parts).map(([slot, classes]) =>
      rule(`[data-slot=${slot}]`, utilities(classes, hooks))
    ),
    ...Object.entries(sizes).flatMap(([slot, bySize]) =>
      Object.entries(bySize).map(([size, classes]) =>
        rule(
          // A root with no size is the default one; :where keeps it as specific as the others.
          size === "default"
            ? at(slot, ":where(:not([data-size]), [data-size=default])")
            : at(slot, `[data-size=${size}]`),
          utilities(classes, hooks)
        )
      )
    ),
  ]
    .filter(Boolean)
    .join("\n");
}

/** The theme's tokens the utilities read: the sheet points them at the page's variables (`--foreground`…), which the theme's own sheet sets. */
const COLORS = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "destructive-foreground",
  "success",
  "success-foreground",
  "info",
  "info-foreground",
  "warning",
  "warning-foreground",
  "invert",
  "invert-foreground",
  "border",
  "input",
  "ring",
];

const THEME = `@theme inline {
${COLORS.map((name) => `  --color-${name}: var(--${name});`).join("\n")}
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}`;

const SOURCES: Record<string, string> = {
  "shadcn/tailwind.css": Bun.resolveSync(
    "shadcn/tailwind.css",
    import.meta.dir
  ),
  "tailwindcss/theme": Bun.resolveSync(
    "tailwindcss/theme.css",
    import.meta.dir
  ),
  "tailwindcss/utilities": Bun.resolveSync(
    "tailwindcss/utilities.css",
    import.meta.dir
  ),
};

async function loadStylesheet(id: string, base: string) {
  const path = SOURCES[id] ?? Bun.resolveSync(id, base);
  return {
    base: path.slice(0, path.lastIndexOf("/")),
    content: await Bun.file(path).text(),
    path,
  };
}

/** CSS written as an object, as a registry item's `css` is: a rule's body is its declarations, or rules of its own (`@keyframes`). */
export interface CssObject {
  readonly [key: string]: string | CssObject;
}

export function cssOf(rules: CssObject, indent = ""): string {
  return Object.entries(rules)
    .map(([key, value]) =>
      typeof value === "string"
        ? `${indent}${key}: ${value};`
        : `${indent}${key} {\n${cssOf(value, `${indent}  `)}\n${indent}}`
    )
    .join("\n");
}

/** An element's sheet for a style: plain CSS on its parts' slots and attributes, then what its item's `css` adds (an envelope's keyframes). */
export async function portableSheet(
  name: string,
  parts: Parts,
  sizes: Sizes,
  hooks: ReadonlyMap<string, string>,
  extra: CssObject = {}
) {
  const input = [
    '@import "tailwindcss/theme" theme(reference);',
    '@import "shadcn/tailwind.css" reference;',
    '@import "tailwindcss/utilities" source(none);',
    "@custom-variant dark (&:is(.dark *));",
    THEME,
    partRules(parts, sizes, hooks),
  ].join("\n");
  const compiler = await compile(input, {
    base: import.meta.dir,
    loadModule: () => Promise.reject(new Error("no plugins")),
    loadStylesheet,
  });
  // A group is found by the slot of its root: the markup of another framework has no `group/<name>` class.
  const css = compiler
    .build([])
    .replace(COMMENT, "")
    .replace(GROUP_SELECTOR, "[data-slot=$1]")
    .trim();
  const [root] = Object.keys(parts);
  // What a page with Tailwind gets from its base layer, for the element alone: a page without it has none. :where keeps it under every rule.
  const reset = `:where([data-slot=${root}], [data-slot=${root}] *) {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  border: 0 solid var(--border);
}
:where([data-slot=${root}] svg) {
  display: block;
  vertical-align: middle;
}
:where([data-slot=${root}] :is(input, button)) {
  font: inherit;
  color: inherit;
  background-color: transparent;
}`;
  const added = cssOf(extra);
  return `/* The ${name} as plain CSS on its parts, generated by registry:build. */\n${reset}\n${css}\n${added ? `${added}\n` : ""}`;
}

/** The tokens audio/ui adds to a shadcn theme, as Tailwind palette colors, in each color scheme. */
const EXTENDED = {
  dark: {
    "destructive-foreground": "red-600",
    info: "violet-500",
    "info-foreground": "violet-600",
    invert: "zinc-700",
    "invert-foreground": "zinc-50",
    success: "emerald-500",
    "success-foreground": "emerald-600",
    warning: "yellow-500",
    "warning-foreground": "yellow-600",
  },
  light: {
    "destructive-foreground": "red-800",
    info: "violet-500",
    "info-foreground": "violet-900",
    invert: "zinc-900",
    "invert-foreground": "zinc-50",
    success: "emerald-500",
    "success-foreground": "emerald-900",
    warning: "yellow-500",
    "warning-foreground": "yellow-900",
  },
} as const;

const PALETTE_COLOR = /--color-([a-z]+-\d+):\s*([^;]+);/g;

/**
 * A theme's tokens as a sheet of its own, for a page that has no shadcn theme:
 * the light scheme on `:root`, the dark one under `.dark`, with the tokens
 * audio/ui adds. A page with a shadcn theme already has them.
 */
export async function themeSheet(
  name: string,
  cssVars: { dark?: Record<string, string>; light?: Record<string, string> }
) {
  const palette = new Map(
    [
      ...(await Bun.file(SOURCES["tailwindcss/theme"]).text()).matchAll(
        PALETTE_COLOR
      ),
    ].map(([, color, value]) => [color, value.trim()] as const)
  );
  const block = (selector: string, scheme: "dark" | "light") => {
    const tokens = {
      ...cssVars[scheme],
      ...Object.fromEntries(
        Object.entries(EXTENDED[scheme]).map(([token, color]) => [
          token,
          palette.get(color) ?? "",
        ])
      ),
    };
    const body = Object.entries(tokens)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([token, value]) => `  --${token}: ${value};`)
      .join("\n");
    return `${selector} {\n${body}\n}`;
  };
  return `/* The ${name} theme's tokens, generated by registry:build. */\n${block(":root", "light")}\n\n${block(".dark", "dark")}\n`;
}
