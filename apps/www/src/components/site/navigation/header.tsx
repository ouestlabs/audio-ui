import { Link } from "@tanstack/react-router";
import type { CommandMenuGroup } from "@/components/site/navigation/command-menu";
import { FrameworkSelect } from "@/components/site/navigation/framework-select";
import { GitHubLink } from "@/components/site/navigation/github-link";
import {
  SiteHeaderCommandMenu,
  SiteHeaderMobileNav,
  SiteHeaderModeSwitcher,
} from "@/components/site/navigation/header-client";
import { LabLink } from "@/components/site/navigation/lab-link";
import { MainNav } from "@/components/site/navigation/main-nav";
import { SectionSelect } from "@/components/site/navigation/section-select";
import { Wordmark } from "@/components/site/navigation/wordmark";
import { Separator } from "@/components/ui/separator";
import { siteConfig } from "@/lib/config";
import { source } from "@/lib/docs/content/source";
import { getCategories } from "@/lib/registry/core/registry";
import { cn } from "@/lib/utils";
import { Button } from "../../ui/button";

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
      // pl-2: the icon's built-in margin plus its round edge make 10px read wider than the right side
      className="pl-2"
      nativeButton={false}
      render={
        <Link aria-label="audio/ui home" className="flex items-center" to="/">
          <Wordmark className="text-foreground text-xl" />
        </Link>
      }
      variant="ghost"
    />
  );
}

/**
 * From `lg`, the framed layouts have no header: this is what it held, at the
 * top of the navigation sidebar: the logo, the theme, the section menu, the
 * framework menu and the search. GitHub stays in the inset's bar.
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
      <SectionSelect tree={pageTree} />
      <FrameworkSelect tree={pageTree} />
      <div className="[&>*]:w-full">
        <SiteHeaderCommandMenu
          commandGroups={commandGroups}
          componentCategories={componentCategories}
          navItems={siteConfig.navItems}
        />
      </div>
    </div>
  );
}

/**
 * What the navigation sidebar's header holds, for the bar of the inset while
 * that sidebar is shut: the section menu at the start, the search, GitHub and
 * the theme at the end.
 */
export function SiteBarContent({ part }: { part: "end" | "github" | "start" }) {
  if (part === "github") {
    return (
      <>
        <LabLink />
        <GitHubLink />
      </>
    );
  }
  if (part === "start") {
    return (
      <div className="flex items-center gap-2">
        <SectionSelect compact tree={source.getPageTree()} />
        <FrameworkSelect compact tree={source.getPageTree()} />
      </div>
    );
  }
  const pageTree = source.getPageTree();
  const componentCategories = getCategories();
  return (
    <div className="flex items-center gap-2">
      <div className="shrink-0">
        <SiteHeaderCommandMenu
          commandGroups={buildCommandMenuGroups(pageTree.children)}
          componentCategories={componentCategories}
          navItems={siteConfig.navItems}
        />
      </div>
      <SiteHeaderModeSwitcher />
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
        sticky && "sticky top-0 z-40"
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
            className="hidden pl-2 md:flex"
            nativeButton={false}
            render={
              <Link
                aria-label="audio/ui home"
                className="flex items-center"
                to="/"
              >
                <Wordmark className="text-foreground text-xl sm:text-2xl" />
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
              <LabLink />
              <GitHubLink />
              <SiteHeaderModeSwitcher />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
