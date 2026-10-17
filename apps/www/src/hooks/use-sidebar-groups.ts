import { useLocation } from "@tanstack/react-router";
import * as React from "react";
import { getCurrentBase, getGroupsFromFolder } from "@/lib/page-tree";
import type { source } from "@/lib/source";

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

const EXCLUDED_FOLDERS = ["test"];

/**
 * The docs sidebar's groups (Get started, then each space), with whether each
 * is open. A space folds when the reader says so, remembered in their browser
 * and shared by the desktop sidebar and the mobile menu; every group is open
 * on a first visit and on the server, and the space of the page being read
 * opens when the reader lands on it.
 */
export function useSidebarGroups(tree: ReturnType<typeof source.getPageTree>) {
  const pathname = useLocation({ select: (location) => location.pathname });
  const currentBase = getCurrentBase(pathname);
  const groups = React.useMemo(
    () =>
      tree.children.flatMap((item) =>
        item.type === "folder" && !EXCLUDED_FOLDERS.includes(item.$id ?? "")
          ? getGroupsFromFolder(item, currentBase)
          : []
      ),
    [currentBase, tree]
  );
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

  const currentTitle = groups.find((group) =>
    group.sections.some((section) =>
      section.pages.some((page) => page.url === pathname)
    )
  )?.title;
  React.useEffect(() => {
    if (currentTitle) {
      setOpen(currentTitle, true);
    }
  }, [currentTitle, setOpen]);

  return {
    groups: groups.map((group) => ({
      ...group,
      open: !(group.collapsible && group.title && collapsed.has(group.title)),
    })),
    pathname,
    setOpen,
  };
}
