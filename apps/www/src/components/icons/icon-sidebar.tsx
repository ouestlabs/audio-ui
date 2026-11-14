import { catalog, categories } from "@audio-ui/icons";
import { Link, useLocation } from "@tanstack/react-router";
import * as React from "react";
import { GroupLabel } from "@/components/docs/page/sidebar";
import { categoryId } from "@/components/icons/icon-grid";
import { useIcons } from "@/components/icons/icons-context";
import { SidebarGroup, SidebarGroupContent } from "@/components/ui/sidebar";
import { useGroupFolding } from "@/hooks/use-sidebar-groups";
import { cn } from "@/lib/utils";

/** The pages of the Icons section: the catalog, then how to use the package. */
export const ICON_PAGES: { count?: number; href: string; label: string }[] = [
  { count: catalog.length, href: "/icons", label: "All icons" },
  { href: "/docs/icons", label: "Usage" },
];

/** The categories of the catalog, each a group of the page the sidebar jumps to. */
export const ICON_CATEGORIES = categories.map((category) => ({
  count: catalog.filter((entry) => entry.category === category).length,
  hash: categoryId(category),
  label: category,
}));

/** The title of the categories' group, folded by the reader like the catalog's groups. */
export const ICON_CATEGORIES_TITLE = "Categories";

/**
 * Which link of the Icons section is the place being read: the category its
 * address ends on, or the page. A jump to a category shows every icon first, so
 * a search does not hide the group it leads to.
 */
export function useIconLinks() {
  const { pathname, hash } = useLocation({
    select: (location) => ({
      hash: location.hash,
      pathname: location.pathname,
    }),
  });
  const { setQuery } = useIcons();
  const showAll = React.useCallback(() => setQuery(""), [setQuery]);
  const inCatalog = pathname === "/icons";
  return {
    isCurrentCategory: (each: string) => inCatalog && hash === each,
    isCurrentPage: (href: string) => href === pathname && !(inCatalog && hash),
    showAll,
  };
}

const linkClassName =
  "flex h-[30px] items-center justify-between gap-2 rounded-md border border-transparent px-2 font-medium text-[0.8rem] text-site-foreground transition-colors hover:bg-site-muted";

const activeClassName = "border-site-accent bg-site-accent";

function Count({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-site-muted-foreground text-xs tabular-nums">
      {children}
    </span>
  );
}

/** The sidebar of the Icons section: the catalog and the usage page, then the catalog's categories. */
export function IconSidebarContent() {
  const { isCurrentCategory, isCurrentPage, showAll } = useIconLinks();
  const { collapsed, setOpen } = useGroupFolding();
  const open = !collapsed.has(ICON_CATEGORIES_TITLE);

  return (
    <nav
      aria-label="Icons"
      className="no-scrollbar scroll-fade-y min-h-0 flex-1 overflow-y-auto px-2 pt-2 pb-12"
    >
      <SidebarGroup>
        <SidebarGroupContent className="flex flex-col gap-0.5">
          {ICON_PAGES.map((page) => (
            <Link
              aria-current={isCurrentPage(page.href) ? "page" : undefined}
              className={cn(
                linkClassName,
                isCurrentPage(page.href) && activeClassName
              )}
              key={page.href}
              preload={false}
              to={page.href}
            >
              {page.label}
              {page.count ? <Count>{page.count}</Count> : null}
            </Link>
          ))}
          <GroupLabel
            collapsible
            onOpenChange={setOpen}
            open={open}
            title={ICON_CATEGORIES_TITLE}
          />
          {open
            ? ICON_CATEGORIES.map((category) => (
                <Link
                  className={cn(
                    linkClassName,
                    isCurrentCategory(category.hash) && activeClassName
                  )}
                  hash={category.hash}
                  key={category.hash}
                  onClick={showAll}
                  preload={false}
                  to="/icons"
                >
                  {category.label}
                  <Count>{category.count}</Count>
                </Link>
              ))
            : null}
        </SidebarGroupContent>
      </SidebarGroup>
    </nav>
  );
}
