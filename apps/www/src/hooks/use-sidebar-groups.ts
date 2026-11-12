import { useLocation } from "@tanstack/react-router";
import * as React from "react";
import { useFramework } from "@/hooks/use-framework";
import { menuSections, needsReact } from "@/lib/docs/content/frameworks";
import {
  getCurrentBase,
  getGroupsFromFolder,
} from "@/lib/docs/content/page-tree";
import {
  DOCS_SECTIONS,
  type DocsSectionId,
  sectionOfFolder,
  sectionOfPath,
} from "@/lib/docs/content/sections";
import type { source } from "@/lib/docs/content/source";

const STORAGE_KEY = "docs-sidebar-collapsed";
const listeners = new Set<() => void>();

/** The titles of the collapsed groups, as JSON: kept here when storage is out of reach (a private window). */
let current: string | undefined;

function read(): string {
  if (current === undefined) {
    try {
      current = localStorage.getItem(STORAGE_KEY) ?? "[]";
    } catch {
      current = "[]";
    }
  }
  return current;
}

function write(titles: string[]) {
  current = JSON.stringify(titles);
  try {
    localStorage.setItem(STORAGE_KEY, current);
  } catch {
    // Storage is out of reach: the choice lasts until the page reloads.
  }
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function parse(json: string): string[] {
  try {
    const value: unknown = JSON.parse(json);
    return Array.isArray(value)
      ? value.filter((v) => typeof v === "string")
      : [];
  } catch {
    return [];
  }
}

/**
 * Which groups of a sidebar are folded: kept in the reader's browser and shared
 * by the docs sidebar, the components sidebar and the mobile menu, so a group
 * of one name is folded in all of them.
 */
export function useGroupFolding() {
  const json = React.useSyncExternalStore(subscribe, read, () => "[]");
  const collapsed = React.useMemo(() => new Set(parse(json)), [json]);
  const setOpen = React.useCallback((title: string, open: boolean) => {
    const titles = new Set(parse(read()));
    if (open) {
      titles.delete(title);
    } else {
      titles.add(title);
    }
    write([...titles]);
  }, []);
  return { collapsed, setOpen };
}

const EXCLUDED_FOLDERS = ["test"];
/** The landing page of each section but the Docs': named Overview in the sidebar, as the section's row names it already. */
const LANDING_PAGES = new Set<string>(
  DOCS_SECTIONS.filter((each) => each.id !== "docs").map((each) => each.href)
);

type PageTree = ReturnType<typeof source.getPageTree>;
type PageTreeNode = PageTree["children"][number];

/** Whether a node of the page tree is the page at `url`, or a folder that holds it. */
function holds(node: PageTreeNode, url: string): boolean {
  if (node.type === "page") {
    return node.url === url;
  }
  if (node.type === "folder") {
    return (
      node.index?.url === url ||
      node.children.some((child) => holds(child, url))
    );
  }
  return false;
}

/** The section of the page at `pathname`: the one of the top-level folder that holds it, or the one its address is under. */
function sectionAt(tree: PageTree, pathname: string): DocsSectionId {
  const folder = tree.children.find(
    (item) =>
      item.type === "folder" &&
      !EXCLUDED_FOLDERS.includes(item.$id ?? "") &&
      holds(item, pathname)
  );
  return folder?.type === "folder"
    ? sectionOfFolder(folder.$id ?? "")
    : sectionOfPath(pathname);
}

/** A section as the switcher lists it. */
export interface SiteSection {
  current: boolean;
  description: string;
  href: string;
  id: DocsSectionId;
  label: string;
}

/**
 * The switcher's sections, the one being read marked: the primitives of the
 * framework, React's in a section for React alone, else the one chosen.
 */
export function useSiteSections(tree: PageTree): SiteSection[] {
  const pathname = useLocation({ select: (location) => location.pathname });
  const [chosen] = useFramework();
  const reading = React.useMemo(
    () => sectionAt(tree, pathname),
    [tree, pathname]
  );
  const framework = needsReact(reading) ? "react" : chosen;
  return React.useMemo(
    () =>
      menuSections(framework, reading).map((each) => ({
        ...each,
        current: each.id === reading,
      })),
    [framework, reading]
  );
}

/**
 * The docs sidebar's groups for the section being read (the Docs, the Core,
 * the Elements, React or the Registry), with whether each is open. A space
 * folds when the reader says so, remembered in their browser and shared by the
 * desktop sidebar and the mobile menu; every group is open on a first visit
 * and on the server, and the space of the page being read opens when the
 * reader lands on it.
 */
export function useSidebarGroups(tree: PageTree) {
  const pathname = useLocation({ select: (location) => location.pathname });
  const currentBase = getCurrentBase(pathname);
  const all = React.useMemo(
    () =>
      tree.children.flatMap((item) =>
        item.type === "folder" && !EXCLUDED_FOLDERS.includes(item.$id ?? "")
          ? getGroupsFromFolder(item, currentBase).map((group) => ({
              ...group,
              section: sectionOfFolder(item.$id ?? ""),
            }))
          : []
      ),
    [currentBase, tree]
  );
  const { collapsed, setOpen } = useGroupFolding();

  const currentGroup = all.find((group) =>
    group.sections.some((part) =>
      part.pages.some((page) => page.url === pathname)
    )
  );
  const currentTitle = currentGroup?.title;
  // The section of the page being read: the sidebar shows its groups alone.
  const reading = React.useMemo(
    () => sectionAt(tree, pathname),
    [tree, pathname]
  );
  const groups = all.filter((group) => group.section === reading);
  const sectionLabel = DOCS_SECTIONS.find((each) => each.id === reading)?.label;
  React.useEffect(() => {
    if (currentTitle) {
      setOpen(currentTitle, true);
    }
  }, [currentTitle, setOpen]);

  return {
    groups: groups.map((group) => {
      // Only a group that folds has a heading, and only when it is not named as its section: the switcher names the section, and a heading that does nothing reads as a button.
      const titled = group.collapsible && group.title !== sectionLabel;
      return {
        ...group,
        collapsible: group.collapsible && titled,
        current: group.title === currentTitle,
        open: !(
          titled &&
          group.collapsible &&
          group.title &&
          collapsed.has(group.title)
        ),
        sections: group.sections.map((part) => ({
          ...part,
          pages: part.pages.map((page) =>
            LANDING_PAGES.has(page.url) ? { ...page, name: "Overview" } : page
          ),
        })),
        titled,
      };
    }),
    pathname,
    setOpen,
  };
}
