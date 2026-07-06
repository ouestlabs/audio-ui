import { DEFAULT_CONFIG } from "@/hooks/use-config";
import type { source } from "@/lib/source";

export type PageTreeNode = (typeof source.pageTree)["children"][number];
export type PageTreeFolder = Extract<PageTreeNode, { type: "folder" }>;
export type PageTreePage = Extract<PageTreeNode, { type: "page" }>;

const COMPONENTS_BASE_PATH_REGEX = /\/docs\/components\/(radix|base)(?:\/|$)/;
const DOCS_BASE_PATH_REGEX = /\/docs\/(radix|base)(?:\/|$)/;

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

// Find the pages inside the base subfolder (radix/base) matching currentBase.
function findBaseSubfolderPages(
  folder: PageTreeFolder,
  currentBase: string
): PageTreePage[] | null {
  for (const child of folder.children) {
    if (child.type !== "folder") {
      continue;
    }

    // Match by $id or by name.
    const isRadix = child.$id === "radix" || child.name === "Radix UI";
    const isBase = child.$id === "base" || child.name === "Base UI";

    if (
      (currentBase === "radix" && isRadix) ||
      (currentBase === "base" && isBase)
    ) {
      return child.children.filter((c): c is PageTreePage => c.type === "page");
    }
  }

  return null;
}

// Get the pages from a folder, handling nested base folders (radix/base).
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

// Get current base (radix or base) from pathname.
// Component docs: /docs/components/radix/alert | /docs/components/base/alert
export function getCurrentBase(pathname: string): string {
  const baseMatch =
    pathname.match(COMPONENTS_BASE_PATH_REGEX) ??
    pathname.match(DOCS_BASE_PATH_REGEX);
  return baseMatch ? baseMatch[1] : DEFAULT_CONFIG.base;
}
