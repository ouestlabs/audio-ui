import { createRouter } from "@tanstack/react-router";
import { ErrorPage } from "@/components/error-page";
import { NotFoundPage } from "@/components/not-found-page";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({
    defaultErrorComponent: ErrorPage,
    defaultNotFoundComponent: NotFoundPage,
    defaultPreload: "intent",
    routeTree,
    scrollRestoration: true,
  });
}
