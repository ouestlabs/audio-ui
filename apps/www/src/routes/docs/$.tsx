import browserCollections from "fumadocs-mdx:collections/browser";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { ReactNode } from "react";
import { source } from "@/lib/source";

interface PageData {
  description: string;
  path: string;
  title: string;
}

/** The page's data, read on the server: which file it is, and its title. */
const loadPage = createServerFn({ method: "GET" })
  .validator((slugs: string[]) => slugs)
  .handler(({ data: slugs }): PageData => {
    const page = source.getPage(slugs);
    if (!page) {
      throw notFound();
    }
    return {
      description: page.data.description ?? "",
      path: page.path,
      title: page.data.title,
    };
  });

/** Stands in for a component of ours until it is ported (step 2). */
function Pending({ name }: { name: string }) {
  return function PendingComponent({ children }: { children?: ReactNode }) {
    return (
      <div
        className="my-4 rounded-md border border-dashed p-3 text-muted-foreground text-xs"
        data-pending={name}
      >
        {name}
        {children}
      </div>
    );
  };
}

const PENDING = [
  "Accordion",
  "AccordionContent",
  "AccordionItem",
  "AccordionTrigger",
  "Alert",
  "AlertDescription",
  "AlertTitle",
  "AspectRatio",
  "Button",
  "Callout",
  "CodeBlockCommand",
  "CodeCollapsibleWrapper",
  "CodeTabs",
  "ComponentPreview",
  "ComponentSource",
  "Control",
  "DeviceControls",
  "Kbd",
  "KeyRow",
  "KeyTable",
  "LinkedCard",
  "Mermaid",
  "Step",
  "Steps",
  "Tab",
  "Tabs",
  "TabsContent",
  "TabsList",
  "TabsTrigger",
  "TypeRow",
  "TypeTable",
] as const;

const components = {
  ...defaultMdxComponents,
  ...Object.fromEntries(PENDING.map((name) => [name, Pending({ name })])),
};

const docsLoader = browserCollections.docs.createClientLoader({
  component: ({ default: Mdx }) => <Mdx components={components} />,
  id: "docs",
});

export const Route = createFileRoute("/docs/$")({
  component: DocsPage,
  loader: async ({ params }) => {
    const data = await loadPage({ data: params._splat?.split("/") ?? [] });
    await docsLoader.preload(data.path);
    return data;
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.title} - audio/ui` },
          { content: loaderData.description, name: "description" },
        ]
      : [],
  }),
});

function DocsPage() {
  const { description, path, title } = Route.useLoaderData();
  return (
    <article className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="font-semibold text-3xl">{title}</h1>
      <p className="mt-2 text-muted-foreground">{description}</p>
      <div className="typeset mt-8">{docsLoader.useContent(path)}</div>
    </article>
  );
}
