import { DEFAULT_CONFIG } from "@/hooks/use-config";
import type { source } from "@/lib/source";

export type PageTreeNode = (typeof source.pageTree)["children"][number];
export type PageTreeFolder = Extract<PageTreeNode, { type: "folder" }>;
export type PageTreePage = Extract<PageTreeNode, { type: "page" }>;

const COMPONENTS_BASE_PATH_REGEX = /\/docs\/components\/(base)(?:\/|$)/;
const DOCS_BASE_PATH_REGEX = /\/docs\/(base)(?:\/|$)/;

// Recursively find all pages in a folder tree.
export function getAllPagesFromFolder(folder: PageTreeFolder): PageTreePage[] {
  const pages: PageTreePage[] = [];

  for (const child of folder.children) {
    if (child.type === "page") {
      pages.push(child);
    } else if (child.type === "folder") {
      pages.push(...getAllPagesFromFolder(child));
    }
  }

  return pages;
}

// Find the children inside the base subfolder (base) matching currentBase.
function findBaseSubfolderChildren(
  folder: PageTreeFolder,
  currentBase: string
): PageTreeFolder["children"] | null {
  for (const child of folder.children) {
    if (child.type !== "folder") {
      continue;
    }

    // Match by $id or by name.
    const isBase = child.$id === "base" || child.name === "Base UI";

    if (currentBase === "base" && isBase) {
      return child.children;
    }
  }

  return null;
}

// Find the pages inside the base subfolder (base) matching currentBase.
function findBaseSubfolderPages(
  folder: PageTreeFolder,
  currentBase: string
): PageTreePage[] | null {
  const children = findBaseSubfolderChildren(folder, currentBase);
  return children?.filter((c): c is PageTreePage => c.type === "page") ?? null;
}

// Get the pages from a folder, handling nested base folders (base).
export function getPagesFromFolder(
  folder: PageTreeFolder,
  currentBase: string
): PageTreePage[] {
  // For the components folder, find the base subfolder.
  if (folder.$id === "components" || folder.name === "Components") {
    const basePages = findBaseSubfolderPages(folder, currentBase);
    if (basePages) {
      return basePages;
    }

    // Fallback: return all pages from nested folders.
    return getAllPagesFromFolder(folder).filter(
      (page) => !page.url.endsWith("/components")
    );
  }

  // For other folders, return direct page children.
  return folder.children.filter(
    (child): child is PageTreePage => child.type === "page"
  );
}

export type PageTreeSection = { pages: PageTreePage[]; title?: string };

// Get a folder's pages grouped under the separators of its meta.json: pages
// before the first separator come first, with no title.
export function getSectionsFromFolder(
  folder: PageTreeFolder,
  currentBase: string
): PageTreeSection[] {
  const isComponents =
    folder.$id === "components" || folder.name === "Components";
  const children = isComponents
    ? findBaseSubfolderChildren(folder, currentBase)
    : folder.children;

  if (!children) {
    return [{ pages: getPagesFromFolder(folder, currentBase) }];
  }

  const sections: PageTreeSection[] = [];
  for (const child of children) {
    if (child.type === "separator") {
      sections.push({ pages: [], title: child.name?.toString() });
    } else if (child.type === "page") {
      if (sections.length === 0) {
        sections.push({ pages: [] });
      }
      sections.at(-1)?.pages.push(child);
    }
  }
  return sections.filter((section) => section.pages.length > 0);
}

// Get the current base from pathname.
// Component docs: /docs/components/base/alert
export function getCurrentBase(pathname: string): string {
  const baseMatch =
    pathname.match(COMPONENTS_BASE_PATH_REGEX) ??
    pathname.match(DOCS_BASE_PATH_REGEX);
  return baseMatch ? baseMatch[1] : DEFAULT_CONFIG.base;
}
