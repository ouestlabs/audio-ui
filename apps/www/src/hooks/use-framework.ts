import { useLocation, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { keptBase } from "@/hooks/use-config";
import { createKeptChoice } from "@/hooks/use-kept-choice";
import { baseAddressOf } from "@/lib/docs/content/base-paths";
import { frameworkAddressOf } from "@/lib/docs/content/framework-paths";
import {
  type FrameworkId,
  frameworkOfPage,
  isFramework,
  shownTo,
} from "@/lib/docs/content/frameworks";

/** Read from the router's address: a framework address (`/docs/vue/knob`) is rewritten to its page's own with `?framework=`, which the router alone sees. */
const framework = createKeptChoice<FrameworkId>({
  isValid: isFramework,
  key: "audio-ui-framework",
  // The class the document got before its first paint (root route), so the switch never shows none for a kept choice.
  onChange: (next) => {
    if (typeof document === "undefined") {
      return;
    }
    for (const id of ["react", "svelte", "vue", "web"]) {
      document.documentElement.classList.toggle(`framework-${id}`, id === next);
    }
  },
  param: "framework",
});

/** The framework kept in the browser, null on the server or when none was. */
export const keptFramework = () =>
  typeof window === "undefined" ? null : framework.read();

/** Keeps a framework in the browser and tells every reader of it, the address left as it is: a choice that goes to another page is kept for it. */
export const rememberFramework = framework.remember;

/**
 * The framework the reader uses: the one in the address when the page has one
 * for it (`/docs/vue/knob`), else the one they chose in the sidebar or a
 * framework's tab, kept in their browser. Choosing goes to the page's address
 * for that framework when it has one, and the address never carries a query
 * parameter for it. Null until they choose, and on the server: the pages are
 * prerendered for any framework.
 */
export function useFramework() {
  const [kept] = framework.useChoice();
  const navigate = useNavigate();
  // The router sees the framework of a framework address on the server too, so it is read from there first: the page is drawn for it from the first paint.
  const named = useLocation({
    select: (location) =>
      (location.search as { framework?: unknown }).framework,
  });
  const pathname = useLocation({ select: (location) => location.pathname });
  // A page that has nothing for the framework kept is read as React.
  const value = frameworkOfPage(
    pathname,
    isFramework(named) ? named : (kept ?? "react")
  );
  const choose = useCallback(
    (next: FrameworkId) => {
      framework.remember(next);
      // A page the framework chosen has no word for leaves for the docs' first page, which every framework has.
      if (!shownTo(pathname, next) && frameworkAddressOf("/docs", next)) {
        navigate({
          search: { framework: next } as never,
          to: "/docs" as never,
        });
        return;
      }
      // The base kept goes with it, or a component page would read as the default base's and replace the choice.
      const base = keptBase();
      const search: Record<string, string> = {};
      if (frameworkAddressOf(pathname, next)) {
        search.framework = next;
        if (base && baseAddressOf(pathname, base)) {
          search.base = base;
        }
      }
      // Inside the router the page keeps its own address and names the framework in a parameter, which the router writes as the framework's address.
      navigate({
        replace: true,
        search: search as never,
        to: pathname as never,
      });
    },
    [navigate, pathname]
  );
  return [value, choose] as const;
}
