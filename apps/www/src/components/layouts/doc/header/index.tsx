import { ArrowLeftIcon, ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";
import type { Item } from "fumadocs-core/page-tree";
import type { InferPageType } from "fumadocs-core/source";
import Link from "next/link";
import { absoluteUrl } from "@/lib/config";
import type { source } from "@/lib/source";
import { getGitHubUrl, getMarkdownUrl } from "@/lib/source";
import { Button } from "@/registry/default/ui/button";
import { DocsCopyPage } from "./copy-page";

type DocHeaderProps = {
  doc: InferPageType<typeof source>["data"];
  page: InferPageType<typeof source>;
  rawContent: string;
  neighbours: {
    previous?: Item;
    next?: Item;
  };
};

export function DocHeader({
  doc,
  page,
  rawContent,
  neighbours,
}: DocHeaderProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex grow items-start justify-between">
        <h1 className="scroll-m-20 font-heading text-3xl xl:text-4xl">
          {doc.title}
        </h1>
        <div className="docs-nav fixed inset-x-0 bottom-0 isolate z-50 flex items-center gap-2 border-border/50 border-t bg-background/80 px-6 py-4 backdrop-blur-sm lg:static lg:z-0 lg:border-t-0 lg:bg-transparent lg:px-0 lg:pt-1.5 lg:backdrop-blur-none">
          <DocsCopyPage
            githubUrl={getGitHubUrl(page)}
            markdownUrl={getMarkdownUrl(page)}
            page={rawContent}
            url={absoluteUrl(page.url)}
          />
          {neighbours.previous && (
            <DocNavButton
              className="extend-touch-target ml-auto"
              direction="previous"
              href={neighbours.previous.url}
            />
          )}
          {neighbours.next && (
            <DocNavButton
              className="extend-touch-target"
              direction="next"
              href={neighbours.next.url}
            />
          )}
        </div>
      </div>
      {doc.description && (
        <p className="text-muted-foreground sm:text-lg">{doc.description}</p>
      )}
    </div>
  );
}

function DocNavButton({
  href,
  direction,
  className,
}: {
  href: string;
  direction: "previous" | "next";
  className?: string;
}) {
  return (
    <Button
      className={className}
      nativeButton={false}
      render={<Link href={href} />}
      size="icon"
      variant="outline"
    >
      {direction === "previous" ? <ArrowLeftIcon /> : <ArrowRightIcon />}
    </Button>
  );
}
