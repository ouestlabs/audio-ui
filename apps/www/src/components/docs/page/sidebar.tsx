"use client";

import {
  CaretDownIcon,
  CaretUpDownIcon,
  CheckIcon,
} from "@phosphor-icons/react/ssr";
import { Link } from "@tanstack/react-router";
import * as React from "react";
import {
  GroupIcon,
  PageIcon,
  SectionIcon,
} from "@/components/site/navigation/group-icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSidebarGroups } from "@/hooks/use-sidebar-groups";
import { getDocsPageUpdateHint } from "@/lib/docs/content/docs";
import type { source } from "@/lib/docs/content/source";
import { cn, isFileUrl } from "@/lib/utils";

const EXCLUDED_PAGES = ["test"];

function DocsUpdateIndicator({ path }: { path: string }) {
  const hint = getDocsPageUpdateHint(path);

  if (!hint) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span className="inline-flex shrink-0 cursor-help">
            <span className="sr-only">{hint}</span>
            <span
              aria-hidden="true"
              className="site-rounded-md flex size-2 bg-blue-500"
            />
          </span>
        }
      />
      <TooltipContent side="right" sideOffset={8}>
        {hint}
      </TooltipContent>
    </Tooltip>
  );
}

/** A group's title; a space's folds its pages away and back. */
export function GroupLabel({
  collapsible,
  current,
  onOpenChange,
  open,
  title,
}: {
  collapsible: boolean;
  current: boolean;
  onOpenChange: (title: string, open: boolean) => void;
  open: boolean;
  title: string;
}) {
  const toggle = React.useCallback(
    () => onOpenChange(title, !open),
    [onOpenChange, open, title]
  );
  if (!collapsible) {
    return (
      <SidebarGroupLabel className="gap-2 font-semibold text-site-foreground">
        <GroupIcon current={current} title={title} />
        {title}
      </SidebarGroupLabel>
    );
  }
  return (
    <SidebarGroupLabel
      className="w-full cursor-pointer justify-between font-semibold text-site-foreground hover:bg-site-muted"
      render={<button aria-expanded={open} onClick={toggle} type="button" />}
    >
      <span className="flex items-center gap-2">
        <GroupIcon current={current} title={title} />
        {title}
      </span>
      <CaretDownIcon
        aria-hidden="true"
        className={cn(
          "text-site-muted-foreground transition-transform",
          !open && "-rotate-90"
        )}
      />
    </SidebarGroupLabel>
  );
}

/** A section of the docs, as the switcher lists it. */
interface SectionOption {
  current: boolean;
  description: string;
  href: string;
  id: string;
  label: string;
}

/** A section's glyph in a small bordered square, as the switcher shows it. */
function SectionBadge({ current, id }: { current: boolean; id: string }) {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background">
      <SectionIcon current={current} id={id} />
    </span>
  );
}

/** A section's name over what it holds. */
function SectionText({ section }: { section: SectionOption }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="truncate font-medium text-foreground text-sm">
        {section.label}
      </span>
      <span className="truncate text-muted-foreground text-xs">
        {section.description}
      </span>
    </span>
  );
}

/**
 * The docs' sections, by the layers of the stack, as one menu at the top of
 * the sidebar: its button shows the section being read, and each of its items
 * is a link to a section's landing page.
 */
export function DocsSectionSelect({
  sections,
}: {
  sections: readonly SectionOption[];
}) {
  const current = sections.find((section) => section.current) ?? sections[0];
  if (!current) {
    return null;
  }
  return (
    <DropdownMenu>
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
      <DropdownMenuContent>
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

/** The docs' links, by section: the list a sidebar shows on the docs and on the home. */
export function DocsNavigation({
  tree,
}: {
  tree: ReturnType<typeof source.getPageTree>;
}) {
  const { docsSections, groups, pathname, setOpen } = useSidebarGroups(tree);

  return (
    // A navigation landmark: screen readers jump to it, and crawlers read it as the site's chrome, not its content.
    <nav
      aria-label="Docs"
      className="no-scrollbar scroll-fade-y min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 pb-12"
    >
      <div className="h-(--top-spacing) shrink-0" />
      <div className="px-2 pb-2">
        <DocsSectionSelect sections={docsSections} />
      </div>
      {groups.map((group) => (
        <SidebarGroup key={group.title}>
          {group.titled ? (
            <GroupLabel
              collapsible={group.collapsible}
              current={group.current}
              onOpenChange={setOpen}
              open={group.open}
              title={group.title ?? ""}
            />
          ) : null}
          {group.open ? (
            <SidebarGroupContent>
              {group.sections.map((section) => (
                <div
                  className="not-first:mt-3"
                  key={section.title ?? "untitled"}
                >
                  {section.title ? (
                    <p className="px-2 pb-1 text-site-muted-foreground text-xs">
                      {section.title}
                    </p>
                  ) : null}
                  <SidebarMenu className="gap-0.5">
                    {section.pages.map((page) => {
                      if (EXCLUDED_PAGES.includes(page.url)) {
                        return null;
                      }

                      return (
                        <SidebarMenuItem key={page.url}>
                          <SidebarMenuButton
                            className="after:site-rounded-md after:-inset-y-1 relative h-[30px] 3xl:fixed:w-full w-fit 3xl:fixed:max-w-48 overflow-visible border border-transparent font-medium text-[0.8rem] after:absolute after:inset-x-0 after:z-0 data-[active=true]:border-site-accent data-[active=true]:bg-site-accent"
                            isActive={page.url === pathname}
                            render={
                              <Link
                                preload={false}
                                reloadDocument={isFileUrl(page.url)}
                                to={page.url}
                              >
                                <span className="pointer-events-none absolute inset-0 flex w-(--sidebar-width) bg-transparent" />
                                <span className="relative z-10 inline-flex items-center gap-2">
                                  <PageIcon url={page.url} />
                                  <span>{page.name}</span>
                                  <DocsUpdateIndicator path={page.url} />
                                </span>
                              </Link>
                            }
                          />
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </div>
              ))}
            </SidebarGroupContent>
          ) : null}
        </SidebarGroup>
      ))}
    </nav>
  );
}
