import { createFileRoute, notFound } from "@tanstack/react-router";
import { NotFoundContent } from "@/components/site/pages/not-found-page";

/** An address no other route claims is not found inside the site's layout, not outside it. */
export const Route = createFileRoute("/_site/$")({
  loader: () => {
    throw notFound();
  },
  notFoundComponent: NotFoundContent,
});
