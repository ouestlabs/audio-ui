import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
} from "@phosphor-icons/react/ssr";
import fm from "front-matter";
import { findNeighbour } from "fumadocs-core/page-tree";
import { createRelativeLink } from "fumadocs-ui/mdx";
import nextDynamic from "next/dynamic";
import Link from "next/link";
import { notFound } from "next/navigation";
import z from "zod";
import { DocsBaseSwitcher } from "@/components/docs-base-switcher";
import { DocsComponentCatalogSection } from "@/components/docs-component-catalog-section";
import { DocsCopyPage } from "@/components/docs-copy-page";
import { JsonLd } from "@/components/json-ld";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/config";
import {
  buildBreadcrumbJsonLd,
  buildPageMetadata,
  getComponentDocSeo,
  isCanonicalComponentDoc,
} from "@/lib/seo";
import { getPageImage, source } from "@/lib/source";
import { absoluteUrl } from "@/lib/utils";
import { getMDXComponents } from "@/mdx-components";

const DocsTableOfContents = nextDynamic(() =>
  import("@/components/docs-toc").then((mod) => mod.DocsTableOfContents)
);

export const revalidate = false;
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string[] }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug);

  if (!page) {
    notFound();
  }

  const doc = page.data;
  const docBase =
    params.slug?.[0] === "components" &&
    (params.slug?.[1] === "base" || params.slug?.[1] === "radix")
      ? params.slug[1]
      : null;
  const componentSlug =
    params.slug?.length === 3 &&
    docBase &&
    isCanonicalComponentDoc(params.slug[2])
      ? params.slug[2]
      : null;
  const componentSeo =
    docBase && componentSlug
      ? getComponentDocSeo(componentSlug, doc.title, docBase, doc.description)
      : null;
  const metadataTitle = componentSeo?.title ?? doc.title;
  const metadataDescription =
    componentSeo?.description ?? doc.description ?? siteConfig.description;
  const canonicalPath = componentSeo?.canonicalPath ?? page.url;

  return buildPageMetadata({
    title: metadataTitle,
    titleSuffix: siteConfig.metadata.titleSuffixes.site,
    description: metadataDescription,
    path: canonicalPath,
    type: "article",
    image: getPageImage(page).url,
    robots:
      componentSeo && !componentSeo.shouldIndex
        ? {
            index: false,
            follow: true,
          }
        : undefined,
  });
}

export default async function Page(props: {
  params: Promise<{ slug: string[] }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) {
    notFound();
  }

  const doc = page.data;
  const MDX = doc.body;
  const toc = doc.toc;
  const neighbours = findNeighbour(source.getPageTree(), page.url);

  const raw = await page.data.getText("raw");
  const { attributes } = fm(raw);
  const { links, base, component } = z
    .object({
      links: z
        .object({
          doc: z.string().optional(),
          api: z.string().optional(),
        })
        .optional(),
      base: z.enum(["base", "radix"]).optional(),
      component: z.boolean().optional(),
    })
    .parse(attributes);

  const isComponentDoc = component === true && base !== undefined;
  const componentName =
    isComponentDoc && params.slug?.length >= 3 ? params.slug[2] : undefined;
  const componentSeo =
    isComponentDoc &&
    componentName &&
    isCanonicalComponentDoc(componentName) &&
    (base === "base" || base === "radix")
      ? getComponentDocSeo(componentName, doc.title, base, doc.description)
      : null;
  const breadcrumbPath = componentSeo?.canonicalPath ?? page.url;
  const docHeadingTitle = componentSeo?.displayTitle ?? doc.title;
  const docLead = componentSeo?.leadDescription ?? doc.description ?? undefined;

  return (
    <>
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: siteConfig.name, path: "/" },
          { name: "Docs", path: "/docs" },
          { name: docHeadingTitle, path: breadcrumbPath },
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
                    {docHeadingTitle}
                  </h1>
                  <div className="docs-nav fixed inset-x-0 bottom-0 isolate z-50 flex items-center gap-2 border-site-border/50 border-t bg-site-background/80 px-6 py-4 backdrop-blur-sm sm:static sm:z-0 sm:border-t-0 sm:bg-transparent sm:px-0 sm:pt-1.5 sm:backdrop-blur-none">
                    <DocsCopyPage page={raw} url={absoluteUrl(page.url)} />

                    {neighbours.previous && (
                      <Button
                        className="extend-touch-target ml-auto hidden shadow-none md:size-7"
                        nativeButton={false}
                        render={
                          <Link href={neighbours.previous.url}>
                            <ArrowLeftIcon />
                            <span className="sr-only">Previous</span>
                          </Link>
                        }
                        size="icon"
                        variant="secondary"
                      />
                    )}
                    {neighbours.next && (
                      <Button
                        className="extend-touch-target hidden shadow-none md:size-7"
                        nativeButton={false}
                        render={
                          <Link href={neighbours.next.url}>
                            <span className="sr-only">Next</span>
                            <ArrowRightIcon />
                          </Link>
                        }
                        size="icon"
                        variant="secondary"
                      />
                    )}
                  </div>
                </div>
                {docLead ? (
                  <p className="text-[1.05rem] text-site-muted-foreground sm:text-base">
                    {docLead}
                  </p>
                ) : null}
              </div>
              {isComponentDoc && base && componentName && (
                <DocsBaseSwitcher
                  base={base}
                  className="mt-4"
                  component={componentName}
                />
              )}
              {links ? (
                <div className="flex items-center gap-2 pt-4">
                  {links?.doc && (
                    <Badge
                      className="site-rounded-full"
                      render={
                        <a href={links.doc} rel="noreferrer" target="_blank">
                          Docs <ArrowUpRightIcon />
                        </a>
                      }
                      variant="secondary"
                    />
                  )}
                  {links?.api && (
                    <Badge
                      className="site-rounded-full"
                      render={
                        <a href={links.api} rel="noreferrer" target="_blank">
                          API Reference <ArrowUpRightIcon />
                        </a>
                      }
                      variant="secondary"
                    />
                  )}
                </div>
              ) : null}
            </div>
            <DocsTableOfContents
              className="w-fit xl:hidden"
              toc={toc}
              variant="dropdown"
            />
            <div className="w-full flex-1 *:data-[slot=alert]:first:mt-0">
              <MDX
                components={getMDXComponents({
                  // Bun resolves two peer-variant copies of fumadocs-core@16.7.7
                  // (app vs fumadocs-ui), making the two LoaderOutput types
                  // nominally incompatible while identical at runtime.
                  a: createRelativeLink(
                    source as unknown as Parameters<
                      typeof createRelativeLink
                    >[0],
                    page
                  ),
                })}
              />
            </div>
            {isComponentDoc && componentName && base ? (
              <DocsComponentCatalogSection
                componentSlug={componentName}
                docBase={base}
              />
            ) : null}
          </div>
          <div className="mx-auto hidden h-16 w-full max-w-2xl items-center gap-2 px-4 sm:flex md:px-0">
            {neighbours.previous && (
              <Button
                className="shadow-none"
                nativeButton={false}
                render={
                  <Link href={neighbours.previous.url}>
                    <ArrowLeftIcon /> {neighbours.previous.name}
                  </Link>
                }
                variant="secondary"
              />
            )}
            {neighbours.next && (
              <Button
                className="ml-auto shadow-none"
                nativeButton={false}
                render={
                  <Link href={neighbours.next.url}>
                    {neighbours.next.name} <ArrowRightIcon />
                  </Link>
                }
                variant="secondary"
              />
            )}
          </div>
        </div>
        <div className="sticky top-[calc(var(--header-height)+1px)] z-30 ml-auto hidden h-[calc(100svh-var(--footer-height)+2rem)] w-72 xl:block">
          {toc.length ? <DocsTableOfContents toc={toc} /> : null}
        </div>
      </div>
    </>
  );
}
