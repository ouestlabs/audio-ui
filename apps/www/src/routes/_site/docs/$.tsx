import { createFileRoute } from "@tanstack/react-router";
import { useFumadocsLoader } from "fumadocs-core/source/client";
import { Suspense } from "react";
import { docsLoader, loadDocPage } from "@/components/docs/page/page";
import { NotFoundContent } from "@/components/site/pages/not-found-page";
import { Route as SiteRoute } from "@/routes/_site";

export const Route = createFileRoute("/_site/docs/$")({
  component: DocsPage,
  // The framework a page is read for (`/docs/vue/...` reaches the router as `?framework=vue`): its head names it.
  loaderDeps: ({ search }) => ({
    framework: (search as { framework?: string }).framework ?? null,
  }),
  loader: async ({ params, deps }) => {
    const data = await loadDocPage({
      data: {
        framework: deps.framework,
        slugs: params._splat?.split("/") ?? [],
      },
    });
    await docsLoader.preload(data.path);
    return data;
  },
  head: ({ loaderData }) => loaderData?.head ?? {},
  notFoundComponent: NotFoundContent,
});

function DocsPage() {
  const data = Route.useLoaderData();
  const { pageTree } = useFumadocsLoader(SiteRoute.useLoaderData());
  // The page's MDX loads in the browser too, so hydration waits for it inside a boundary.
  return (
    <Suspense>{docsLoader.useContent(data.path, { data, pageTree })}</Suspense>
  );
}
