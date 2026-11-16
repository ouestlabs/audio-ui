import { useLocation, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { createKeptChoice } from "@/hooks/use-kept-choice";
import { frameworkAddressOf } from "@/lib/docs/content/framework-paths";
import { type FrameworkId, isFramework } from "@/lib/docs/content/frameworks";

/** Read from the router's address: a framework address (`/docs/vue/knob`) is rewritten to its page's own with `?framework=`, which the router alone sees. */
const framework = createKeptChoice<FrameworkId>({
  isValid: isFramework,
  key: "audio-ui-framework",
  param: "framework",
});

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
  const [value] = framework.useChoice();
  const navigate = useNavigate();
  const pathname = useLocation({ select: (location) => location.pathname });
  const choose = useCallback(
    (next: FrameworkId | null) => {
      framework.remember(next);
      // Inside the router the page keeps its own address and names the framework in a parameter, which the router writes as the framework's address.
      navigate({
        replace: true,
        search: (frameworkAddressOf(pathname, next)
          ? { framework: next }
          : {}) as never,
        to: pathname as never,
      });
    },
    [navigate, pathname]
  );
  return [value, choose] as const;
}
