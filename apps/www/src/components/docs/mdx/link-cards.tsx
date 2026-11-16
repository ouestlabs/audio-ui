import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

/** A grid of cards that lead to other pages. */
export function LinkCards({ children }: { children: ReactNode }) {
  return (
    <div className="not-prose my-4 grid gap-3 sm:grid-cols-2">{children}</div>
  );
}

/** One card: a title, and a sentence on what is there. */
export function LinkCard({
  children,
  href,
  title,
}: {
  children: ReactNode;
  href: string;
  title: string;
}) {
  const className =
    "flex flex-col gap-1 rounded-lg border bg-card p-4 text-card-foreground no-underline transition-colors hover:bg-muted/50";
  const content = (
    <>
      <span className="font-medium">{title}</span>
      <span className="text-muted-foreground text-sm">{children}</span>
    </>
  );
  // A file of the site, such as llms.txt, is not a page of the router.
  return href.includes(".") ? (
    <a className={className} data-not-typeset="" href={href}>
      {content}
    </a>
  ) : (
    <Link className={className} data-not-typeset="" to={href as never}>
      {content}
    </Link>
  );
}
