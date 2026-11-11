import { DOCS_MENU_UPDATES, shownMarks } from "@/lib/docs/menu/menu-updates";

export const PAGES_NEW = shownMarks(DOCS_MENU_UPDATES).map(([page]) => page);
const PATTERN_REGEX = /[?#]/;
function getDocsComponentKey(value: string) {
  const [path = ""] = value.split(PATTERN_REGEX);
  const normalized = path.replace(/^\/+|\/+$/g, "");

  if (!normalized) {
    return "";
  }

  const segments = normalized.split("/");

  if (segments[0] === "docs") {
    segments.shift();
  }

  if (segments[0] === "base") {
    segments.shift();
  }

  return segments.at(-1) ?? "";
}

const docsMenuUpdates = new Map(
  shownMarks(DOCS_MENU_UPDATES).map(([componentName, hint]) => [
    getDocsComponentKey(componentName),
    hint,
  ])
);

/** The marks name component pages: a hook or a lib named like a component, such as the `arrangement` lib, has none. */
function markKey(path: string) {
  return path.startsWith("/docs/components/") ? getDocsComponentKey(path) : "";
}

export function isDocsPageUpdated(path: string) {
  return docsMenuUpdates.has(markKey(path));
}

export function getDocsPageUpdateHint(path: string) {
  return docsMenuUpdates.get(markKey(path));
}
