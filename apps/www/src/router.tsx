import { createRouter } from "@tanstack/react-router";
import { ErrorPage } from "@/components/site/pages/error-page";
import { NotFoundPage } from "@/components/site/pages/not-found-page";
import { addressOfPage, pageOfAddress } from "@/lib/docs/content/addresses";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({
    defaultErrorComponent: ErrorPage,
    defaultNotFoundComponent: NotFoundPage,
    defaultPreload: "intent",
    // A page read for a framework or a base has an address for it: inside the router it is the page's own, with `framework` and `base` in a search the reader never sees.
    rewrite: {
      input: ({ url }) => pageOfAddress(url),
      output: ({ url }) => addressOfPage(url),
    },
    routeTree,
    scrollRestoration: true,
    // The page scrolls in the frame's panel, not the window (framed-layout.tsx).
    scrollToTopSelectors: ['[data-scroll-restoration-id="page"]'],
  });
}
