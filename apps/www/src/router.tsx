import { createRouter } from "@tanstack/react-router";
import { ErrorPage } from "@/components/site/pages/error-page";
import { NotFoundPage } from "@/components/site/pages/not-found-page";
import {
  baseAddressOf,
  pageOfBaseAddress,
} from "@/lib/docs/content/base-paths";
import {
  frameworkAddressOf,
  pageOfFrameworkAddress,
} from "@/lib/docs/content/framework-paths";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({
    defaultErrorComponent: ErrorPage,
    defaultNotFoundComponent: NotFoundPage,
    defaultPreload: "intent",
    // A page read for a framework or a base has an address for it: inside the router it is the page's own, with `?framework=` and `?base=`.
    rewrite: {
      input: ({ url }) => {
        const page = pageOfFrameworkAddress(url.pathname);
        if (page) {
          url.pathname = page.pathname;
          url.searchParams.set("framework", page.framework);
        }
        const base = pageOfBaseAddress(url.pathname);
        if (base) {
          url.pathname = base.pathname;
          url.searchParams.set("base", base.base);
        }
        return url;
      },
      output: ({ url }) => {
        const baseAddress = baseAddressOf(
          url.pathname,
          url.searchParams.get("base")
        );
        if (baseAddress) {
          url.pathname = baseAddress;
          url.searchParams.delete("base");
        } else if (
          url.pathname.startsWith("/docs/components/base/") &&
          url.searchParams.get("base") === "base"
        ) {
          // The default base is the page's own address: no query for it.
          url.searchParams.delete("base");
        }
        const address = frameworkAddressOf(
          url.pathname,
          url.searchParams.get("framework")
        );
        if (address) {
          url.pathname = address;
          url.searchParams.delete("framework");
        }
        return url;
      },
    },
    routeTree,
    scrollRestoration: true,
    // The page scrolls in the frame's panel, not the window (framed-layout.tsx).
    scrollToTopSelectors: ['[data-scroll-restoration-id="page"]'],
  });
}
