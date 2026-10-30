import { createRouter } from "@tanstack/react-router";
import { ErrorPage } from "@/components/site/pages/error-page";
import { NotFoundPage } from "@/components/site/pages/not-found-page";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({
    defaultErrorComponent: ErrorPage,
    defaultNotFoundComponent: NotFoundPage,
    defaultPreload: "intent",
    routeTree,
    scrollRestoration: true,
    // The page scrolls in the frame's panel, not the window (framed-layout.tsx).
    scrollToTopSelectors: ['[data-scroll-restoration-id="page"]'],
  });
}
