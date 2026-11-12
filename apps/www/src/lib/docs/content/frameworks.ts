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

/** Where Elements starts for a reader of each framework: its own guide, or the elements themselves. */
export const ELEMENTS_GUIDE: Record<FrameworkId, string> = {
  react: "/docs/elements",
  svelte: "/docs/elements/svelte",
  vue: "/docs/elements/vue",
  web: "/docs/elements",
};

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

/** A section as the switcher lists it: its link, the framework's guide for Elements. */
export interface FrameworkSection {
  description: string;
  folders: readonly string[];
  href: string;
  id: DocsSection["id"];
  label: string;
}

/**
 * The switcher's four sections: the Docs, one set of primitives, the core
 * with the engine, and the registry. The primitives are the section being
 * read when it is one of them, else the framework's: React's for React and
 * for no framework chosen, the elements for the others, from their guide.
 * Either is named Primitives: the framework menu under it names the framework.
 */
export function menuSections(
  framework: FrameworkId | null,
  reading: string
): FrameworkSection[] {
  const framed = framework && framework !== "react" ? "elements" : "react";
  const primitives =
    reading === "react" || reading === "elements" ? reading : framed;
  return ["docs", primitives, "core", "registry"].flatMap((id) => {
    const section = DOCS_SECTIONS.find((each) => each.id === id);
    if (!section) {
      return [];
    }
    const guide =
      id === "elements" && framework ? ELEMENTS_GUIDE[framework] : null;
    return [{ ...section, ...PRIMITIVES[id], href: guide ?? section.href }];
  });
}
