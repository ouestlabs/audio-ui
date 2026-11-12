import { DOCS_SECTIONS, type DocsSection } from "@/lib/docs/content/sections";

/**
 * The frameworks a reader of the docs can say they use, as the sidebar's
 * switch lists them: what each gets of audio/ui. React has the primitives and
 * the shadcn registry; the others, the custom elements.
 */
export const FRAMEWORKS = [
  {
    description: "Primitives and the shadcn registry",
    id: "react",
    label: "React",
  },
  {
    description: "Custom elements, typed, with v-model",
    id: "vue",
    label: "Vue",
  },
  {
    description: "Custom elements, typed in its markup",
    id: "svelte",
    label: "Svelte",
  },
  {
    description: "Custom elements in plain HTML",
    id: "web",
    label: "Web",
  },
] as const;

export type Framework = (typeof FRAMEWORKS)[number];
export type FrameworkId = Framework["id"];

export function isFramework(value: unknown): value is FrameworkId {
  return FRAMEWORKS.some((framework) => framework.id === value);
}

/** The sections only a React app uses: the primitives for React, the registry and its catalog. */
const REACT_ONLY: readonly string[] = ["react", "registry", "components"];

/** Whether a section is for React alone: read there, the framework is React, whatever the reader chose. */
export const needsReact = (section: string) => REACT_ONLY.includes(section);

/** Where Elements starts for a reader of each framework: its own guide, or the elements themselves. */
export const ELEMENTS_GUIDE: Record<FrameworkId, string> = {
  react: "/docs/elements",
  svelte: "/docs/elements/svelte",
  vue: "/docs/elements/vue",
  web: "/docs/elements",
};

/** A section as a reader of a framework sees it: where its link goes, and whether it needs React. */
export type FrameworkSection = Omit<DocsSection, "href"> & {
  href: string;
  /** Shown to a reader of another framework, marked: it needs React. */
  reactOnly: boolean;
};

/**
 * The sections in the order a reader of `framework` wants them: the Docs, then
 * what works with it, then the rest. For React, the primitives and the
 * registry come next; for the others, the elements, from their framework's
 * guide, then the core and the engine, and the React sections last, marked.
 * With no framework chosen, the stack's own order.
 */
export function sectionsFor(framework: FrameworkId | null): FrameworkSection[] {
  const sections = DOCS_SECTIONS.map((section) => ({
    ...section,
    href:
      section.id === "elements" && framework
        ? ELEMENTS_GUIDE[framework]
        : section.href,
    reactOnly:
      framework !== null &&
      framework !== "react" &&
      REACT_ONLY.includes(section.id),
  }));
  if (!framework) {
    return sections;
  }
  const first =
    framework === "react" ? ["docs", ...REACT_ONLY] : ["docs", "elements"];
  const rank = (id: string) => {
    const at = first.indexOf(id);
    if (at >= 0) {
      return at;
    }
    // React's sections go last for the others, in the stack's order.
    return first.length + (REACT_ONLY.includes(id) ? DOCS_SECTIONS.length : 0);
  };
  return sections
    .map((section, index) => ({ index, section }))
    .sort(
      (a, b) => rank(a.section.id) - rank(b.section.id) || a.index - b.index
    )
    .map(({ section }) => section);
}
