import { findNeighbour } from "fumadocs-core/page-tree";
import { notFound } from "next/navigation";
import { DocFooter } from "@/components/layouts/doc/footer";
import { DocHeader } from "@/components/layouts/doc/header";
import { DocsTableOfContents } from "@/components/layouts/doc/toc";
import { SiteFooter } from "@/components/layouts/global/footer";
import { createMetadata } from "@/lib/metadata";
import { getPageImage, source } from "@/lib/source";
import { getMDXComponents } from "@/mdx-components";
export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata({
  params,
}: PageProps<"/docs/[[...slug]]">) {
  const { slug = [] } = await params;
  const page = source.getPage(slug);
  if (!page) {
    return createMetadata({
      title: "Not Found",
    });
  }

  const doc = page.data;

  const description =
    doc.description ?? "A collection of composable Audio UI components";

  const image = {
    url: getPageImage(page).url,
  };

  return createMetadata({
    title: doc.title,
    description,
    openGraph: {
      url: page.url,
      images: [image],
    },
    twitter: {
      images: [image],
    },
  });
}

export default async function Page(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) {
    notFound();
  }

  const doc = page.data;
  const rawContent = await page.data.getText("raw");
  const MDX = doc.body;
  const neighbours = findNeighbour(source.pageTree, page.url, {
    separateRoot: false,
  });

  return (
    <div
      className="flex min-h-[calc(100vh-var(--header-height)+5px)] items-stretch sm:text-[.9375rem] xl:w-full"
      data-slot="docs"
    >
      <div className="relative mb-16 flex min-w-0 flex-1 flex-col bg-muted/50 sm:mb-15 lg:my-8 lg:mr-4 lg:rounded-4xl lg:border">
        <div className="-m-px flex flex-1 flex-col bg-background p-6 lg:rounded-4xl lg:border">
          <div className="mx-auto flex w-full flex-1 flex-col lg:max-w-4xl">
            <div className="flex flex-1 flex-col gap-8 pb-16 sm:pb-0">
              <DocHeader
                doc={doc}
                neighbours={neighbours}
                page={page}
                rawContent={rawContent}
              />
              <div className="w-full flex-1 *:data-[slot=alert]:first:mt-0">
                <MDX components={getMDXComponents()} />
              </div>
            </div>
            {page.data.lastModified && (
              <p className="text-muted-foreground text-sm">
                Last updated{" "}
                {new Date(page.data.lastModified).toLocaleDateString()}
              </p>
            )}
            <DocFooter neighbours={neighbours} />
          </div>
        </div>
        <div className="px-4 py-6 lg:rounded-b-2xl lg:px-8">
          <SiteFooter />
        </div>
      </div>
      <div className="sticky top-(--header-height) z-30 ms-auto hidden h-[calc(100svh-var(--header-height))] w-72 flex-col overflow-hidden overscroll-none xl:flex">
        <div className="no-scrollbar flex min-h-0 flex-col gap-2 overflow-y-auto py-2">
          <div className="h-(--top-spacing) shrink-0" />
          {doc.toc?.length ? <DocsTableOfContents toc={doc.toc} /> : null}
        </div>
      </div>
    </div>
  );
}
