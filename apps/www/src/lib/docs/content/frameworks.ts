import {
  EVERY_FRAMEWORK_PATHS,
  REACT_ADDRESSES,
  under,
} from "@/lib/docs/content/framework-paths";
import { DOCS_SECTIONS, type DocsSection } from "@/lib/docs/content/sections";

/**
 * The frameworks a reader of the docs can say they use, as the sidebar's
 * switch lists them: what each gets of audio/ui.
 */
export const FRAMEWORKS = [
  {
    description: "Headless primitives and the shadcn registry",
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

/**
 * Whether a page is one a reader of `framework` is shown, in the search as in
 * the sidebar: for React, all of them; for the others, all but what only a
 * React app uses.
 */
export function shownTo(url: string, framework: FrameworkId): boolean {
  return (
    framework === "react" ||
    EVERY_FRAMEWORK_PATHS.includes(url) ||
    !REACT_ADDRESSES.some((prefix) => under(url, prefix))
  );
}

/** A section as the switcher lists it. */
export type FrameworkSection = DocsSection;

/** The switcher's sections: the Docs, the core with the engine, the registry and the icons. */
export const menuSections = (): readonly FrameworkSection[] => DOCS_SECTIONS;
