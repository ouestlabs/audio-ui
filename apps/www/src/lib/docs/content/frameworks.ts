import { DOCS_SECTIONS, type DocsSection } from "@/lib/docs/content/sections";

/**
 * The frameworks a reader of the docs can say they use, as the sidebar's
 * switch lists them: what each gets of audio/ui. React has the primitives and
 * the shadcn registry; the others, the custom elements.
 */
export const FRAMEWORKS = [
  {
    description: "The headless package and the shadcn registry",
    id: "react",
    label: "React",
  },
  {
    description: "Typed templates and v-model",
    id: "vue",
    label: "Vue",
  },
  {
    description: "Typed markup, value and oninput",
    id: "svelte",
    label: "Svelte",
  },
  {
    description: "Plain HTML and a module script",
    id: "web",
    label: "Web",
  },
] as const;

export type Framework = (typeof FRAMEWORKS)[number];
export type FrameworkId = Framework["id"];

export function isFramework(value: unknown): value is FrameworkId {
  return FRAMEWORKS.some((framework) => framework.id === value);
}

/** The sections only a React app uses: the primitives for React, and the registry with its catalog. */
const REACT_ONLY: readonly string[] = ["react", "registry"];

/** Whether a section is for React alone: read there, the framework is React, whatever the reader chose. */
export const needsReact = (section: string) => REACT_ONLY.includes(section);

/** The addresses only a React app uses: React's primitives, the registry with its catalog, its guides and its API. */
const REACT_ADDRESSES = [
  "/components",
  "/docs/api",
  "/docs/components",
  "/docs/devices",
  "/docs/guides",
  "/docs/hooks",
  "/docs/lib",
  "/docs/react",
  "/docs/registry",
  "/docs/styling",
];

const under = (url: string, prefix: string) =>
  url === prefix || url.startsWith(`${prefix}/`);

/**
 * Whether a page is one a reader of `framework` is shown, in the search as in
 * the sidebar: for React, all but the elements; for the others, all but what
 * only a React app uses; every page with no framework chosen.
 */
export function shownTo(url: string, framework: FrameworkId | null): boolean {
  if (!framework) {
    return true;
  }
  if (framework === "react") {
    return !under(url, "/docs/elements");
  }
  return !REACT_ADDRESSES.some((prefix) => under(url, prefix));
}

/** The elements' overview, whose tabs show a reader the setup of their framework. */
export const ELEMENTS = "/docs/elements";
/** React's primitives, the elements' twins. */
const REACT_PRIMITIVES = "/docs/react";
/** The primitives with a page in both Elements and React, by their last segment, the overviews with them. */
const TWINS = new Set([
  "",
  "envelope",
  "fader",
  "knob",
  "meter",
  "pad",
  "piano",
  "piano-roll",
  "plot",
  "sequencer",
  "timeline",
  "waveform",
  "xypad",
]);

/**
 * The same primitive's page as the framework reads it, when `pathname` is its
 * twin in the other: React's for React, the elements' for the others. Null
 * when the page is already the framework's own, has no twin, or no framework
 * is chosen.
 */
export function twinPage(
  pathname: string,
  framework: FrameworkId | null
): string | null {
  if (!framework) {
    return null;
  }
  const [from, to] =
    framework === "react"
      ? [ELEMENTS, REACT_PRIMITIVES]
      : [REACT_PRIMITIVES, ELEMENTS];
  if (!under(pathname, from)) {
    return null;
  }
  const slug = pathname.slice(from.length + 1);
  if (!TWINS.has(slug)) {
    return null;
  }
  return slug ? `${to}/${slug}` : to;
}

/** How the switcher names the primitives, whichever they are: the framework is the other menu's to name. */
const PRIMITIVES: Record<string, { description: string; label: string }> = {
  elements: {
    description: "Custom elements, their parts and events",
    label: "Primitives",
  },
  react: {
    description: "Headless components, their parts and props",
    label: "Primitives",
  },
};

/** A section as the switcher lists it. */
export interface FrameworkSection {
  description: string;
  folders: readonly string[];
  href: string;
  id: DocsSection["id"];
  label: string;
}

/**
 * The switcher's sections: the Docs, one set of primitives, the core with the
 * engine, the registry, for React or no framework chosen, and the icons. The primitives are the section being
 * read when it is one of them, else the framework's: React's for React and
 * for no framework chosen, the elements for the others.
 * Either is named Primitives: the framework menu under it names the framework.
 */
export function menuSections(
  framework: FrameworkId | null,
  reading: string
): FrameworkSection[] {
  const framed = framework && framework !== "react" ? "elements" : "react";
  const primitives =
    reading === "react" || reading === "elements" ? reading : framed;
  // The registry is React's: a reader of another framework is not shown it.
  const registry = framework && framework !== "react" ? [] : ["registry"];
  return ["docs", primitives, "core", ...registry, "icons"].flatMap((id) => {
    const section = DOCS_SECTIONS.find((each) => each.id === id);
    if (!section) {
      return [];
    }
    return [{ ...section, ...PRIMITIVES[id] }];
  });
}
