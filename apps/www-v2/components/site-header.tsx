import Link from "next/link";
import type { CommandMenuGroup } from "@/components/command-menu";
import { GitHubLink } from "@/components/github-link";
import { MainNav } from "@/components/main-nav";
import {
  SiteHeaderCommandMenu,
  SiteHeaderMobileNav,
  SiteHeaderModeSwitcher,
} from "@/components/site-header-client";
import { Separator } from "@/components/ui/separator";
import { XLink } from "@/components/x-link";
import { siteConfig } from "@/lib/config";
import { showMcpDocs } from "@/lib/flags";
import { getCategories } from "@/lib/registry";
import { source } from "@/lib/source";
import { cn } from "@/lib/utils";
import { Icons } from "./icons";
import { Button } from "./ui/button";

type PageTreeNode = ReturnType<typeof source.getPageTree>["children"][number];

function buildCommandMenuGroups(nodes: PageTreeNode[]) {
  return nodes.flatMap<CommandMenuGroup>((node) => {
    if (node.type !== "folder") {
      return [];
    }

    const pages: CommandMenuGroup["pages"] = [];
    const seen = new Set<string>();

    const walk = (items: PageTreeNode[]) => {
      for (const item of items) {
        if (item.type === "page") {
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
            url: item.url,
            name,
            isComponent: item.url.includes("/components/"),
          });
          continue;
        }

        if (item.type === "folder" && item.children) {
          walk(item.children);
        }
      }
    };

    walk(node.children);

    if (pages.length === 0) {
      return [];
    }

    const groupName = node.name?.toString() ?? "";

    return [
      {
        id: node.$id ?? groupName,
        name: groupName,
        pages,
      },
    ];
  });
}

export function SiteHeader({ sticky = true }: { sticky?: boolean } = {}) {
  const pageTree = source.getPageTree();
  const componentCategories = getCategories();
  const commandGroups = buildCommandMenuGroups(pageTree.children);

  return (
    <header
      className={cn(
        "w-full overscroll-none border-transparent border-b bg-site-background font-site-sans",
        sticky && "sticky top-0 z-50"
      )}
    >
      <div className="container-wrapper">
        <div className="flex h-[calc(var(--header-height)-1px)] items-center gap-3.5 **:data-[slot=separator]:h-4!">
          <Button asChild className="hidden md:flex" variant="ghost">
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
          </Button>
          <SiteHeaderMobileNav
            componentCategories={componentCategories}
            navItems={siteConfig.navItems}
            tree={pageTree}
          />
          <div className="ml-auto flex items-center gap-1 md:flex-1 md:justify-end">
            <div className="mr-2 hidden w-full flex-1 md:flex md:w-auto md:flex-none">
              <SiteHeaderCommandMenu
                commandGroups={commandGroups}
                componentCategories={componentCategories}
                navItems={siteConfig.navItems}
              />
            </div>

            <MainNav className="hidden lg:flex" items={siteConfig.navItems} />

            <Separator className="hidden lg:flex" orientation="vertical" />

            <div className="flex items-center gap-0">
              <GitHubLink />
              <XLink />
              <SiteHeaderModeSwitcher />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
