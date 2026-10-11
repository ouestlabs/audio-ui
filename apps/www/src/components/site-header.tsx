import Link from "next/link";
import type { CommandMenuGroup } from "@/components/command-menu";
import { GitHubLink } from "@/components/github-link";
import { MainNav } from "@/components/main-nav";
import {
  SiteHeaderCommandMenu,
  SiteHeaderMobileNav,
  SiteHeaderModeSwitcher,
} from "@/components/site-header-client";
import { SiteNavTabs } from "@/components/site-nav-tabs";
import { Separator } from "@/components/ui/separator";
import { siteConfig } from "@/lib/config";
import { showMcpDocs } from "@/lib/flags";
import { getCategories } from "@/lib/registry";
import { source } from "@/lib/source";
import { cn } from "@/lib/utils";
import { Icons } from "./icons";
import { Button } from "./ui/button";

type PageTreeNode = ReturnType<typeof source.getPageTree>["children"][number];

function collectCommandMenuPages(
  items: PageTreeNode[],
  seen: Set<string>,
  pages: CommandMenuGroup["pages"]
) {
  for (const item of items) {
    if (item.type === "folder" && item.children) {
      collectCommandMenuPages(item.children, seen, pages);
      continue;
    }

    if (item.type !== "page") {
      continue;
    }

    if (!showMcpDocs && item.url.includes("/mcp")) {
      continue;
    }

    const name = item.name?.toString() ?? "";
    const key = name || item.url;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    pages.push({
      isComponent: item.url.includes("/components/"),
      name,
      url: item.url,
    });
  }
}

function buildCommandMenuGroup(node: PageTreeNode): CommandMenuGroup | null {
  if (node.type !== "folder") {
    return null;
  }

  const pages: CommandMenuGroup["pages"] = [];
  collectCommandMenuPages(node.children, new Set<string>(), pages);

  if (pages.length === 0) {
    return null;
  }

  const groupName = node.name?.toString() ?? "";

  return {
    id: node.$id ?? groupName,
    name: groupName,
    pages,
  };
}

function buildCommandMenuGroups(nodes: PageTreeNode[]) {
  return nodes.flatMap<CommandMenuGroup>((node) => {
    const group = buildCommandMenuGroup(node);
    return group ? [group] : [];
  });
}

function SiteLogo() {
  return (
    <Button
      nativeButton={false}
      render={
        <Link aria-label="Home" className="flex items-center" href="/">
          <div
            aria-hidden
            className="flex shrink-0 select-none items-center justify-center gap-1 text-muted-foreground"
          >
            <Icons.audioUi className="pointer-events-none size-5 text-foreground" />
            <p className="mt-[-2.3px] text-balance font-medium font-serif text-xl leading-snug">
              {siteConfig.name}
            </p>
          </div>
        </Link>
      }
      variant="ghost"
    />
  );
}

/**
 * From `lg`, the framed layouts have no header: this is what it held, at the
 * top of the navigation sidebar: the logo, the sections as tabs, the search,
 * GitHub and the theme.
 */
export function SiteSidebarHeader() {
  const pageTree = source.getPageTree();
  const componentCategories = getCategories();
  const commandGroups = buildCommandMenuGroups(pageTree.children);

  return (
    <div className="flex shrink-0 flex-col gap-2 p-2 font-site-sans">
      <div className="flex items-center justify-between gap-2">
        <SiteLogo />
        <SiteHeaderModeSwitcher />
      </div>
      <SiteNavTabs items={siteConfig.navItems} />
      <div className="flex items-center gap-2">
        <SiteHeaderCommandMenu
          commandGroups={commandGroups}
          componentCategories={componentCategories}
          navItems={siteConfig.navItems}
        />
        <GitHubLink />
      </div>
    </div>
  );
}

export function SiteHeader({
  framed = false,
  sticky = true,
}: {
  /** The page has a framed layout: from `lg` its navigation sidebar holds the header's content, so there is no header. */
  framed?: boolean;
  sticky?: boolean;
} = {}) {
  const pageTree = source.getPageTree();
  const componentCategories = getCategories();
  const commandGroups = buildCommandMenuGroups(pageTree.children);

  return (
    <header
      className={cn(
        "w-full overscroll-none bg-site-background font-site-sans",
        framed && "lg:hidden",
        sticky && "sticky top-0 z-50"
      )}
    >
      <div className="container-wrapper">
        <div className="flex h-[calc(var(--header-height)-1px)] items-center gap-3.5">
          <SiteHeaderMobileNav
            componentCategories={componentCategories}
            navItems={siteConfig.navItems}
            tree={pageTree}
          />
          <Button
            className="hidden md:flex"
            nativeButton={false}
            render={
              <Link aria-label="Home" className="flex items-center" href={"/"}>
                <div
                  aria-hidden
                  className="flex shrink-0 select-none items-center justify-center gap-1 text-muted-foreground"
                >
                  <Icons.audioUi className="pointer-events-none size-5 text-foreground" />
                  <p className="mt-[-2.3px] text-balance font-medium font-serif text-xl leading-snug sm:mt-[-3px] sm:text-2xl">
                    {siteConfig.name}
                  </p>
                </div>
              </Link>
            }
            variant="ghost"
          />
          <MainNav className="hidden lg:flex" items={siteConfig.navItems} />
          <div className="ml-auto flex items-center gap-2">
            <SiteHeaderCommandMenu
              commandGroups={commandGroups}
              componentCategories={componentCategories}
              navItems={siteConfig.navItems}
            />
            <Separator className="hidden sm:flex" orientation="vertical" />
            <div className="flex items-center gap-1">
              <GitHubLink />
              <SiteHeaderModeSwitcher />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
