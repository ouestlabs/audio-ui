/**
 * The site's sections, as the switcher at the top of the sidebar lists them:
 * the docs by the layers of the stack (what the reader learns first, the
 * framework-agnostic core, its adapters, custom elements and React, then the
 * registry they install and own), and the components catalog. A docs section
 * gathers top-level folders of the content whatever their addresses, so a
 * component page keeps its URL under the Registry.
 */
export const DOCS_SECTIONS = [
  {
    description: "Get started, guides and agents",
    folders: ["(root)", "engine"],
    href: "/docs",
    id: "docs",
    label: "Docs",
  },
  {
    description: "Framework-agnostic logic and audio",
    folders: ["core"],
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
    description: "Components, devices, hooks and libraries",
    folders: ["(registry)", "components", "hooks", "lib"],
    href: "/docs/registry",
    id: "registry",
    label: "Registry",
  },
  {
    description: "Blocks to copy, by category",
    folders: [],
    href: "/components",
    id: "components",
    label: "Components",
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
