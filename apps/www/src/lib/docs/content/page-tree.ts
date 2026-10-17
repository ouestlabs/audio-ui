import { isValidElement, type ReactNode } from "react";
import { DEFAULT_CONFIG } from "@/hooks/use-config";
import type { source } from "@/lib/docs/content/source";

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
    const isBase = child.$id === "base" || nodeText(child.name) === "Base UI";

    if (currentBase === "base" && isBase) {
      return child.children;
    }
  }

  return null;
}

// Find the pages inside the base subfolder (base) matching currentBase, in
// its space folders too.
function findBaseSubfolderPages(
  folder: PageTreeFolder,
  currentBase: string
): PageTreePage[] | null {
  const children = findBaseSubfolderChildren(folder, currentBase);
  return children
    ? children.flatMap((child) => {
        if (child.type === "page") {
          return [child];
        }
        return child.type === "folder" ? getAllPagesFromFolder(child) : [];
      })
    : null;
}

// Get the pages from a folder, handling nested base folders (base).
export function getPagesFromFolder(
  folder: PageTreeFolder,
  currentBase: string
): PageTreePage[] {
  // For the components folder, find the base subfolder.
  if (isComponentsFolder(folder)) {
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
export type PageTreeGroup = {
  /** Whether the reader may fold it: the spaces, not Get started. */
  collapsible: boolean;
  sections: PageTreeSection[];
  title?: string;
};

/** What an HTML string reads as: everything outside its tags, so no tag can survive in the result. */
function textOfHtml(html: string) {
  let text = "";
  let inTag = false;
  for (const char of html) {
    if (char === "<") {
      inTag = true;
    } else if (char === ">" && inTag) {
      inTag = false;
    } else if (!inTag) {
      text += char;
    }
  }
  return text;
}

/** The words of a tree node's name: a string, or the text inside the element a serialized tree turns it into. */
export function nodeText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(nodeText).join("");
  }
  if (
    isValidElement<{
      children?: ReactNode;
      dangerouslySetInnerHTML?: { __html: string };
    }>(node)
  ) {
    // A serialized tree gives a name back as a span holding its HTML.
    const html = node.props.dangerouslySetInnerHTML?.__html;
    return html === undefined
      ? nodeText(node.props.children)
      : textOfHtml(html).replaceAll("&amp;", "&");
  }
  return "";
}

const isComponentsFolder = (folder: PageTreeFolder) =>
  folder.$id === "components" || nodeText(folder.name) === "Components";

// Get a folder's groups, each a heading of the sidebar. The components' base
// folder holds one folder per space (Elements, Workstation, Devices), and
// each is a group of its own; any other folder is one group, a space too
// (the Audio engine) unless it is the root one (Get started).
export function getGroupsFromFolder(
  folder: PageTreeFolder,
  currentBase: string
): PageTreeGroup[] {
  const spaces = isComponentsFolder(folder)
    ? findBaseSubfolderChildren(folder, currentBase)?.filter(
        (child): child is PageTreeFolder => child.type === "folder"
      )
    : undefined;
  if (spaces?.length) {
    return spaces.map((space) => ({
      collapsible: true,
      sections: sectionsOf(space.children),
      title: nodeText(space.name),
    }));
  }
  // Any other folder but the root one (Get started) is a space of its own, such as the Audio engine.
  return [
    {
      collapsible: folder.root !== true,
      sections: getSectionsFromFolder(folder, currentBase),
      title: nodeText(folder.name),
    },
  ];
}

// Get a folder's pages grouped under the separators of its meta.json: pages
// before the first separator come first, with no title.
function getSectionsFromFolder(
  folder: PageTreeFolder,
  currentBase: string
): PageTreeSection[] {
  const children = isComponentsFolder(folder)
    ? findBaseSubfolderChildren(folder, currentBase)
    : folder.children;

  if (!children) {
    return [{ pages: getPagesFromFolder(folder, currentBase) }];
  }
  return sectionsOf(children);
}

function sectionsOf(children: PageTreeFolder["children"]): PageTreeSection[] {
  const sections: PageTreeSection[] = [];
  for (const child of children) {
    if (child.type === "separator") {
      sections.push({ pages: [], title: nodeText(child.name) });
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
