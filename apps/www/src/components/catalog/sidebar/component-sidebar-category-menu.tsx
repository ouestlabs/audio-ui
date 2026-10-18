"use client";

import { GridIcon } from "@audio-ui/icons/react";
import { Link, useLocation } from "@tanstack/react-router";
import * as React from "react";
import { ComponentUpdateIndicator } from "@/components/docs/catalog/component-update-indicator";
import { GroupLabel } from "@/components/docs/page/sidebar";
import { SidebarGroup, SidebarGroupContent } from "@/components/ui/sidebar";
import { useGroupFolding } from "@/hooks/use-sidebar-groups";
import {
  serializeDesignSystemSearchParams,
  useDesignSystemSearchParams,
} from "@/lib/design-system/search-params";
import { getCategoryInfo } from "@/lib/registry/core/registry";
import { cn, formatLabel, normalizeSlug } from "@/lib/utils";
import { categoryGroups } from "@/registry-audio/bases/categories";

import { useComponents } from "../components-context";

interface ComponentSidebarCategoryMenuProps {
  onSelect?: () => void;
}

const linkClassName =
  "flex h-[30px] items-center justify-between gap-2 rounded-md border border-transparent px-2 font-medium text-[0.8rem] text-site-foreground transition-colors hover:bg-site-muted";

const activeClassName = "border-site-accent bg-site-accent";

export const ComponentSidebarCategoryMenu = React.memo(
  function _ComponentSidebarCategoryMenu({
    onSelect,
  }: ComponentSidebarCategoryMenuProps) {
    const { totalCount, categoryCounts } = useComponents();
    const pathname = useLocation({ select: (location) => location.pathname });
    const [params] = useDesignSystemSearchParams();
    const { collapsed, setOpen } = useGroupFolding();
    // The group of the category being read opens when the reader lands on it.
    const currentGroup = categoryGroups.find((group) =>
      group.names.some(
        (category) => pathname === `/components/${normalizeSlug(category)}`
      )
    )?.label;
    React.useEffect(() => {
      if (currentGroup) {
        setOpen(currentGroup, true);
      }
    }, [currentGroup, setOpen]);

    // Build href with preserved design system params
    const buildHref = React.useCallback(
      (basePath: string) => {
        const { item: _item, search: _search, ...persistedParams } = params;
        return serializeDesignSystemSearchParams(basePath, persistedParams);
      },
      [params]
    );

    return (
      <SidebarGroup>
        <SidebarGroupContent className="flex flex-col gap-0.5">
          <Link
            className={cn(
              linkClassName,
              pathname === "/components" && activeClassName
            )}
            onClick={onSelect}
            preload={false}
            to={buildHref("/components")}
          >
            <span className="flex items-center gap-2">
              <GridIcon
                className="size-3.5 shrink-0 text-site-muted-foreground"
                weight="fill"
              />
              All components
            </span>
            <span className="text-site-muted-foreground text-xs">
              {totalCount}
            </span>
          </Link>
          {categoryGroups.map((group) => {
            const open = !collapsed.has(group.label);
            return (
              <React.Fragment key={group.label}>
                <GroupLabel
                  collapsible
                  current={group.label === currentGroup}
                  onOpenChange={setOpen}
                  open={open}
                  title={group.label}
                />
                {open
                  ? group.names.map((category) => {
                      const basePath = `/components/${normalizeSlug(category)}`;

                      return (
                        <Link
                          className={cn(
                            linkClassName,
                            pathname === basePath && activeClassName
                          )}
                          key={category}
                          onClick={onSelect}
                          preload={false}
                          to={buildHref(basePath)}
                        >
                          <span>
                            {getCategoryInfo(category)?.label ??
                              formatLabel(category)}
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            <ComponentUpdateIndicator category={category} />
                            <span className="text-site-muted-foreground text-xs">
                              {categoryCounts[category] || 0}
                            </span>
                          </span>
                        </Link>
                      );
                    })
                  : null}
              </React.Fragment>
            );
          })}
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }
);
