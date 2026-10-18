"use client";

import { CaretDownIcon } from "@phosphor-icons/react/ssr";
import { Link } from "@tanstack/react-router";
import * as React from "react";
import { GroupIcon, PageIcon } from "@/components/site/navigation/group-icon";
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

/** The docs' links, by section: the list a sidebar shows on the docs and on the home. */
export function DocsNavigation({
  tree,
}: {
  tree: ReturnType<typeof source.getPageTree>;
}) {
  const { groups, pathname, setOpen } = useSidebarGroups(tree);

  return (
    <div className="no-scrollbar scroll-fade-y min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 pb-12">
      <div className="h-(--top-spacing) shrink-0" />
      {groups.map((group) => (
        <SidebarGroup key={group.title}>
          <GroupLabel
            collapsible={group.collapsible}
            current={group.current}
            onOpenChange={setOpen}
            open={group.open}
            title={group.title ?? ""}
          />
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
    </div>
  );
}
