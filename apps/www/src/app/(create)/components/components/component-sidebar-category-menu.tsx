"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import {
  serializeDesignSystemSearchParams,
  useDesignSystemSearchParams,
} from "@/app/(create)/lib/search-params";
import { ComponentUpdateIndicator } from "@/components/component-update-indicator";
import { SidebarGroup, SidebarGroupContent } from "@/components/ui/sidebar";
import { getCategoryInfo } from "@/lib/registry";
import { cn, formatLabel, normalizeSlug } from "@/lib/utils";
import { categoryGroups } from "@/registry-audio/bases/categories";

import { useComponents } from "./components-context";

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
    const pathname = usePathname();
    const [params] = useDesignSystemSearchParams();

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
            href={buildHref("/components")}
            onClick={onSelect}
            prefetch={false}
          >
            <span>All components</span>
            <span className="text-site-muted-foreground text-xs">
              {totalCount}
            </span>
          </Link>
          {categoryGroups.map((group) => (
            <React.Fragment key={group.label}>
              <p className="mt-3 mb-1 px-2 text-site-muted-foreground text-xs">
                {group.label}
              </p>
              {group.names.map((category) => {
                const basePath = `/components/${normalizeSlug(category)}`;

                return (
                  <Link
                    className={cn(
                      linkClassName,
                      pathname === basePath && activeClassName
                    )}
                    href={buildHref(basePath)}
                    key={category}
                    onClick={onSelect}
                    prefetch={false}
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
              })}
            </React.Fragment>
          ))}
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }
);
