/**
 * The site's sections: the Docs (what the reader learns first, and what makes
 * the sound: the guides, the hooks, the libraries, the engine and webgl), the
 * components, with the primitives they install for each framework, and the
 * icons, with theirs.
 * The switcher at the top of the sidebar lists them. A section gathers top-level folders of the
 * content whatever their addresses, so a component page keeps its URL under
 * the Registry.
 */
export const DOCS_SECTIONS = [
  {
    description: "Get started, guides, hooks, libraries and the engine",
    folders: ["(root)", "guides", "hooks", "lib", "engine", "webgl"],
    href: "/docs",
    id: "docs",
    label: "Docs",
  },
  {
    description: "Elements, workstation and devices",
    folders: ["components", "(overview)"],
    href: "/docs/components",
    id: "registry",
    label: "Components",
  },
  {
    description: "Audio glyphs, in four weights",
    folders: ["icons"],
    href: "/icons",
    id: "icons",
    label: "Icons",
  },
] as const;

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
  const under = DOCS_SECTIONS.filter(
    (section) =>
      section.href !== "/docs" &&
      (pathname === section.href || pathname.startsWith(`${section.href}/`))
  );
  return under[0]?.id ?? "docs";
}
