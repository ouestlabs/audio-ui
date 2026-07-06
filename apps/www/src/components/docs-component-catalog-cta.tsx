"use client";

import Link from "next/link";
import { renderSeoLinkedText } from "@/app/(create)/components/components/component-category-seo-content";
import { cn } from "@/lib/utils";

interface DocsComponentCatalogCtaProps {
  label: string;
  componentCount: number;
  catalogHref: string;
  intro: string;
  className?: string;
}

/**
 * SEO-friendly block linking component docs to the matching catalog category.
 */
export function DocsComponentCatalogCta({
  label,
  componentCount,
  catalogHref,
  intro,
  className,
}: DocsComponentCatalogCtaProps) {
  return (
    <section
      aria-labelledby="docs-components-heading"
      className={cn("mt-14 border-site-border/70 border-t pt-10", className)}
    >
      <h2
        className="scroll-m-20 font-semibold text-2xl tracking-tight"
        id="docs-components-heading"
      >
        More Shadcn {label} components
      </h2>
      <div className="mt-4 space-y-4 text-pretty text-[1.05rem] text-site-muted-foreground leading-7 sm:text-base">
        <p>{renderSeoLinkedText(intro, "docs-components-intro")}</p>
        <p>
          <Link
            className="font-medium text-site-primary underline decoration-site-primary/60 underline-offset-[3px] hover:decoration-site-primary"
            href={catalogHref}
          >
            Browse all {componentCount} Shadcn {label} components
          </Link>{" "}
          for copy-ready layouts, dashboards, and forms built with Tailwind CSS
          in the audio/ui library.
        </p>
      </div>
    </section>
  );
}
