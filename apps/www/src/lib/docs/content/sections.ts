/**
 * The site's sections: the Docs (what the reader learns first), the
 * primitives (custom elements, and React's), the framework-agnostic core with
 * the engine, the registry they install and own, with its catalog, and the
 * icons, with theirs. The
 * switcher at the top of the sidebar shows one set of primitives, the reader's
 * framework's (`menuSections`). A section gathers top-level folders of the
 * content whatever their addresses, so a component page keeps its URL under
 * the Registry.
 */
export const DOCS_SECTIONS = [
  {
    description: "Get started, guides and agents",
    folders: ["(root)", "guides"],
    href: "/docs",
    id: "docs",
    label: "Docs",
  },
  {
    description: "Logic, audio and drawing: core, engine and gl",
    folders: ["core", "engine", "gl"],
    href: "/docs/core",
    id: "core",
    label: "Core",
  },
  {
    description: "Custom elements, any framework",
    folders: ["elements"],
    href: "/docs/elements",
    id: "elements",
    label: "Elements",
  },
  {
    description: "Headless primitives for React",
    folders: ["react"],
    href: "/docs/react",
    id: "react",
    label: "React",
  },
  {
    description: "Components, devices, hooks and the catalog",
    folders: ["(registry)", "components", "hooks", "lib"],
    href: "/docs/registry",
    id: "registry",
    label: "Registry",
  },
  {
    description: "Audio glyphs, in four weights",
    folders: ["icons"],
    href: "/icons",
    id: "icons",
    label: "Icons",
  },
] as const;

/** The components catalog: its own page, read as part of the Registry. */
const CATALOG = "/components";

export type DocsSection = (typeof DOCS_SECTIONS)[number];
export type DocsSectionId = DocsSection["id"];

/** The section a top-level folder of the content belongs to, by its id or its last segment; the Docs for one no section names. */
export function sectionOfFolder(folder: string): DocsSectionId {
  const name = folder.split("/").at(-1) ?? folder;
  return (
    DOCS_SECTIONS.find((section) =>
      (section.folders as readonly string[]).some(
        (each) => each === folder || each === name
      )
    )?.id ?? "docs"
  );
}

/** The section an address is in when no page of the tree says so: the one whose landing page it is under, the Docs otherwise. */
export function sectionOfPath(pathname: string): DocsSectionId {
  if (pathname === CATALOG || pathname.startsWith(`${CATALOG}/`)) {
    return "registry";
  }
  const under = DOCS_SECTIONS.filter(
    (section) =>
      section.href !== "/docs" &&
      (pathname === section.href || pathname.startsWith(`${section.href}/`))
  );
  return under[0]?.id ?? "docs";
}
