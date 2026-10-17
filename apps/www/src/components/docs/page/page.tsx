import browserCollections from "fumadocs-mdx:collections/browser";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
} from "@phosphor-icons/react/ssr";
import { Link, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { findNeighbour } from "fumadocs-core/page-tree";
import type { MDXProps } from "mdx/types";
import { lazy, Suspense } from "react";
import { DocsComponentCatalogSection } from "@/components/docs/catalog/component-catalog-section";
import { DocsCopyPage } from "@/components/docs/page/copy-page";
import { JsonLd } from "@/components/site/json-ld";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/config";
import { getPageImage, source } from "@/lib/docs/content/source";
import {
  buildBreadcrumbJsonLd,
  buildPageMetadata,
  getComponentDocSeo,
  isCanonicalComponentDoc,
  type PageHead,
} from "@/lib/seo/seo";
import { absoluteUrl } from "@/lib/utils";
import { getMDXComponents } from "@/mdx-components";

const DocsTableOfContents = lazy(() =>
  import("@/components/docs/page/toc").then((mod) => ({
    default: mod.DocsTableOfContents,
  }))
);

/** What a docs page needs from the server: where it is, how it reads and what its head says. */
export interface DocPageData {
  base: string | null;
  breadcrumbPath: string;
  componentName: string | null;
  description: string | null;
  head: PageHead;
  heading: string;
  lead: string | null;
  links: { api?: string; doc?: string } | null;
  path: string;
  url: string;
}

/** The SEO a component's docs page may have of its own, or lend to another page: only a canonical component page has any. */
function componentDocSeo(
  slugs: string[],
  doc: { base?: string; description?: string; title: string }
) {
  const slug = slugs[2] ?? "";
  const onBase = slugs[0] === "components" && slugs[1] === "base";
  if (!(onBase && slugs.length === 3 && isCanonicalComponentDoc(slug))) {
    return null;
  }
  return getComponentDocSeo(slug, doc.title, "base", doc.description);
}

/** Reads a docs page's frontmatter and works out its SEO: a component's page may be another's canonical. */
export const loadDocPage = createServerFn({ method: "GET" })
  .validator((slugs: string[]) => slugs)
  .handler(({ data: slugs }): DocPageData => {
    const page = source.getPage(slugs);
    if (!page) {
      throw notFound();
    }
    const doc = page.data;
    const seo = componentDocSeo(slugs, doc);
    const isComponentDoc = doc.component === true && doc.base !== undefined;

    return {
      base: doc.base ?? null,
      breadcrumbPath: seo?.canonicalPath ?? page.url,
      componentName: isComponentDoc ? (slugs[2] ?? null) : null,
      description: doc.description ?? null,
      head: buildPageMetadata({
        description:
          seo?.description ?? doc.description ?? siteConfig.description,
        image: getPageImage(page).url,
        path: seo?.canonicalPath ?? page.url,
        robots: seo && !seo.shouldIndex ? "noindex, follow" : undefined,
        title: seo?.title ?? doc.title,
        titleSuffix: siteConfig.metadata.titleSuffixes.site,
        type: "article",
      }),
      heading: seo?.displayTitle ?? doc.title,
      lead: seo?.leadDescription ?? doc.description ?? null,
      links: doc.links ?? null,
      path: page.path,
      url: page.url,
    };
  });

type Neighbours = ReturnType<typeof findNeighbour>;

/** The previous and next pages as icon buttons, beside the title. */
function DocsNeighbourIcons({ neighbours }: { neighbours: Neighbours }) {
  return (
    <>
      {neighbours.previous ? (
        <Button
          className="extend-touch-target ml-auto hidden shadow-none md:size-7"
          nativeButton={false}
          render={
            <Link to={neighbours.previous.url}>
              <ArrowLeftIcon />
              <span className="sr-only">Previous</span>
            </Link>
          }
          size="icon"
          variant="secondary"
        />
      ) : null}
      {neighbours.next ? (
        <Button
          className="extend-touch-target hidden shadow-none md:size-7"
          nativeButton={false}
          render={
            <Link to={neighbours.next.url}>
              <span className="sr-only">Next</span>
              <ArrowRightIcon />
            </Link>
          }
          size="icon"
          variant="secondary"
        />
      ) : null}
    </>
  );
}

/** Links to the docs and the API reference of what a page covers. */
function DocsLinks({ links }: { links: { api?: string; doc?: string } }) {
  return (
    <div className="flex items-center gap-2 pt-4">
      {links.doc ? (
        <Badge
          className="site-rounded-full"
          render={
            <a href={links.doc} rel="noreferrer" target="_blank">
              Docs <ArrowUpRightIcon />
            </a>
          }
          variant="secondary"
        />
      ) : null}
      {links.api ? (
        <Badge
          className="site-rounded-full"
          render={
            <a href={links.api} rel="noreferrer" target="_blank">
              API Reference <ArrowUpRightIcon />
            </a>
          }
          variant="secondary"
        />
      ) : null}
    </div>
  );
}

/** The previous and next pages, named, under the page. */
function DocsPager({ neighbours }: { neighbours: Neighbours }) {
  return (
    <div className="mx-auto flex h-16 w-full max-w-2xl items-center gap-2 px-4 md:px-0">
      {neighbours.previous ? (
        <Button
          className="shadow-none"
          nativeButton={false}
          render={
            <Link to={neighbours.previous.url}>
              <ArrowLeftIcon /> {neighbours.previous.name}
            </Link>
          }
          variant="secondary"
        />
      ) : null}
      {neighbours.next ? (
        <Button
          className="ml-auto shadow-none"
          nativeButton={false}
          render={
            <Link to={neighbours.next.url}>
              {neighbours.next.name} <ArrowRightIcon />
            </Link>
          }
          variant="secondary"
        />
      ) : null}
    </div>
  );
}

interface DocArticleProps {
  data: DocPageData;
  pageTree: Parameters<typeof findNeighbour>[0];
}

/** The page as it reads: the title and its tools, the MDX, the component's catalog, and the pager. */
function DocArticle({
  Mdx,
  props: { data, pageTree },
  toc,
}: {
  Mdx: React.ComponentType<MDXProps>;
  props: DocArticleProps;
  toc: Parameters<typeof DocsTableOfContents>[0]["toc"];
}) {
  const neighbours = findNeighbour(pageTree, data.url);

  return (
    <>
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: siteConfig.name, path: "/" },
          { name: "Docs", path: "/docs" },
          { name: data.heading, path: data.breadcrumbPath },
        ])}
      />
      <div className="flex items-stretch text-[1.05rem] sm:text-[15px] xl:w-full">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="h-(--top-spacing) shrink-0" />
          <div className="mx-auto flex w-full min-w-0 max-w-2xl flex-1 flex-col gap-8 px-4 py-6 text-neutral-800 md:px-0 lg:py-8 dark:text-neutral-300">
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-2">
                <div className="flex items-start justify-between">
                  <h1 className="scroll-m-20 font-semibold text-4xl tracking-tight sm:text-3xl xl:text-4xl">
                    {data.heading}
                  </h1>
                  <div className="docs-nav flex items-center gap-2 pt-1.5">
                    <DocsCopyPage url={absoluteUrl(data.url)} />

                    <DocsNeighbourIcons neighbours={neighbours} />
                  </div>
                </div>
                {data.lead ? (
                  <p className="text-[1.05rem] text-site-muted-foreground sm:text-base">
                    {data.lead}
                  </p>
                ) : null}
              </div>
              {data.links ? <DocsLinks links={data.links} /> : null}
            </div>
            <div className="hidden md:block xl:hidden">
              {toc.length ? (
                <Suspense fallback={null}>
                  <DocsTableOfContents toc={toc} />
                </Suspense>
              ) : null}
            </div>
            <div className="typeset typeset-changelog w-full flex-1 *:data-[slot=alert]:first:mt-0">
              <Mdx components={getMDXComponents()} />
            </div>
            {data.componentName && data.base ? (
              <DocsComponentCatalogSection componentSlug={data.componentName} />
            ) : null}
          </div>
          <DocsPager neighbours={neighbours} />
        </div>
        <div className="sticky top-0 z-30 ml-auto hidden h-[calc(100svh-var(--header-height)-4rem)] w-0 xl:block">
          {toc.length ? (
            <Suspense fallback={null}>
              <DocsTableOfContents className="absolute right-0" toc={toc} />
            </Suspense>
          ) : null}
        </div>
      </div>
    </>
  );
}

/** The MDX of the docs, loaded in the browser bundle and rendered inside the page. */
export const docsLoader =
  browserCollections.docs.createClientLoader<DocArticleProps>({
    component: ({ default: Mdx, toc }, props) => (
      <DocArticle Mdx={Mdx} props={props} toc={toc} />
    ),
    id: "docs",
  });
