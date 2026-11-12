"use client";

import { CaretUpDownIcon, CheckIcon } from "@phosphor-icons/react/ssr";
import { Link } from "@tanstack/react-router";
import { SectionIcon } from "@/components/site/navigation/group-icon";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type SiteSection, useSiteSections } from "@/hooks/use-sidebar-groups";
import type { source } from "@/lib/docs/content/source";

/** A section's glyph in a small bordered square. */
function SectionBadge({ current, id }: { current: boolean; id: string }) {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background">
      <SectionIcon current={current} id={id} />
    </span>
  );
}

/** A section's name over what it holds; marked React when the reader's framework is another. */
function SectionText({ section }: { section: SiteSection }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="truncate font-medium text-foreground text-sm">
          {section.label}
        </span>
        {section.reactOnly ? (
          <Badge className="shrink-0" variant="outline">
            React
          </Badge>
        ) : null}
      </span>
      <span className="truncate text-muted-foreground text-xs">
        {section.description}
      </span>
    </span>
  );
}

/**
 * The site's sections as one menu: the docs by the layers of the stack, then
 * the components catalog, in the order the reader's framework wants them, the
 * React ones marked for a reader of another. Its button shows the section
 * being read, and each item is a link to a section's landing page. `compact` draws the button on
 * one line, for the bar of the inset while the sidebar is shut.
 */
export function SectionSelect({
  compact = false,
  tree,
}: {
  compact?: boolean;
  tree: ReturnType<typeof source.getPageTree>;
}) {
  const sections = useSiteSections(tree);
  const current = sections.find((section) => section.current) ?? sections[0];
  if (!current) {
    return null;
  }
  return (
    <DropdownMenu>
      {compact ? (
        <DropdownMenuTrigger
          aria-label={`Section: ${current.label}`}
          className="flex h-8 items-center gap-1.5 rounded-md border bg-muted/50 px-2 font-medium text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring data-popup-open:bg-muted"
        >
          <SectionIcon current id={current.id} />
          {current.label}
          <CaretUpDownIcon
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground"
          />
        </DropdownMenuTrigger>
      ) : (
        <DropdownMenuTrigger
          aria-label={`Section: ${current.label}`}
          className="flex w-full items-center gap-2 rounded-lg border bg-muted/50 p-1.5 text-start outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring data-popup-open:bg-muted"
        >
          <SectionBadge current id={current.id} />
          <SectionText section={current} />
          <CaretUpDownIcon
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground"
          />
        </DropdownMenuTrigger>
      )}
      <DropdownMenuContent className={compact ? "w-64" : undefined}>
        {sections.map((section) => (
          <DropdownMenuItem
            className="gap-2 p-1.5"
            key={section.id}
            render={<Link preload={false} to={section.href} />}
          >
            <SectionBadge current={section.current} id={section.id} />
            <SectionText section={section} />
            {section.current ? (
              <CheckIcon aria-hidden="true" className="size-4 shrink-0" />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
