import { createRouter } from "@tanstack/react-router";
import { ErrorPage } from "@/components/site/pages/error-page";
import { NotFoundPage } from "@/components/site/pages/not-found-page";
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
    // A page read for a framework has an address for it: inside the router it is the page's own, with `?framework=`.
    rewrite: {
      input: ({ url }) => {
        const page = pageOfFrameworkAddress(url.pathname);
        if (page) {
          url.pathname = page.pathname;
          url.searchParams.set("framework", page.framework);
        }
        return url;
      },
      output: ({ url }) => {
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
