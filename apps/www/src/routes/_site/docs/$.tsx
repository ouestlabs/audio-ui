import { createFileRoute } from "@tanstack/react-router";
import { useFumadocsLoader } from "fumadocs-core/source/client";
import { Suspense } from "react";
import { docsLoader, loadDocPage } from "@/components/docs/page/page";
import { Route as SiteRoute } from "@/routes/_site";

export const Route = createFileRoute("/_site/docs/$")({
  component: DocsPage,
  loader: async ({ params }) => {
    const data = await loadDocPage({ data: params._splat?.split("/") ?? [] });
    await docsLoader.preload(data.path);
    return data;
  },
  head: ({ loaderData }) => loaderData?.head ?? {},
});

function DocsPage() {
  const data = Route.useLoaderData();
  const { pageTree } = useFumadocsLoader(SiteRoute.useLoaderData());
  // The page's MDX loads in the browser too, so hydration waits for it inside a boundary.
  return (
    <Suspense>{docsLoader.useContent(data.path, { data, pageTree })}</Suspense>
  );
}
